import { createHash } from 'node:crypto';
import {
  Inject,
  Logger,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConnectedSocket,
  Ack,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import {
  ChatCommands,
  PrivacyCommands,
  ServiceTokens,
  AIOrchestrationCommands,
} from '@optimistic-tanuki/constants';
import { PersonaTelosCommands } from '@optimistic-tanuki/telos-contracts';
import { ProfileCommands } from '@optimistic-tanuki/profile-contracts';
import {
  ChatConversation,
  ChatMessage,
} from '@optimistic-tanuki/chat-contracts';
import { PersonaTelosDto } from '@optimistic-tanuki/telos-contracts';
import { ProfileDto } from '@optimistic-tanuki/profile-contracts';
import { firstValueFrom } from 'rxjs';
import { AiOrchestrationReadinessInterceptor } from '../../interceptors/ai-orchestration-readiness.interceptor';
import { Server, Socket } from 'socket.io';
import { SocketSessionAuthService } from '../../auth/socket-session-auth.service';
import { gatewayWriteLimit } from '../throttler-config';

const CHAT_WRITE_TTL_MS = 60_000;
const CHAT_WRITE_PRODUCTION_LIMIT = 60;
const CHAT_WRITE_RELAXED_LIMIT = 1000;
const CHAT_WRITE_LIMIT_CEILING = 2000;

export interface PersistedChatMessageNotification {
  id: string;
  senderId: string;
  recipients?: string[];
  createdAt?: Date | string;
}

@WebSocketGateway(Number(process.env.SOCKET_PORT) || 3300, {
  namespace: 'chat',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: Boolean(process.env.CORS_ORIGIN),
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private connectedClients: { id: string; client: Socket }[] = [];
  private readonly chatWriteBuckets = new Map<
    string,
    { windowStartedAt: number; count: number }
  >();
  private lastChatWritePruneAt = 0;
  private readonly deletedSecurityAccounts = new Set<string>();

  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatCollectorClient: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiOrchestrationClient: ClientProxy,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    private readonly socketSessionAuth: SocketSessionAuthService
  ) {}

  private securityAccountKey(accountId: string): string {
    return createHash('sha256')
      .update('ot:chat-security:' + accountId.toLowerCase())
      .digest('hex');
  }
  purgeAccountSecurityState(accountId: string): void {
    const key = this.securityAccountKey(accountId);
    if (
      !this.deletedSecurityAccounts.has(key) &&
      this.deletedSecurityAccounts.size >= 10000
    )
      throw Error('CHAT_SECURITY_DELETION_BOUND');
    this.deletedSecurityAccounts.add(key);
    for (const id of this.chatWriteBuckets.keys())
      if (id.toLowerCase() === accountId.toLowerCase())
        this.chatWriteBuckets.delete(id);
  }
  readbackAccountSecurityState(accountId: string): number {
    if (!this.deletedSecurityAccounts.has(this.securityAccountKey(accountId)))
      throw Error('CHAT_SECURITY_FENCE_REQUIRED');
    return [...this.chatWriteBuckets.keys()].filter(
      (id) => id.toLowerCase() === accountId.toLowerCase()
    ).length;
  }

  private assertChatWriteAllowed(userId: string): void {
    if (this.deletedSecurityAccounts.has(this.securityAccountKey(userId)))
      throw new WsException('Account unavailable');
    const now = Date.now();
    if (now - this.lastChatWritePruneAt >= CHAT_WRITE_TTL_MS) {
      for (const [key, bucket] of this.chatWriteBuckets) {
        if (now - bucket.windowStartedAt >= CHAT_WRITE_TTL_MS) {
          this.chatWriteBuckets.delete(key);
        }
      }
      this.lastChatWritePruneAt = now;
    }

    const limit = gatewayWriteLimit(
      'THROTTLE_CHAT_WRITE_LIMIT',
      CHAT_WRITE_PRODUCTION_LIMIT,
      CHAT_WRITE_RELAXED_LIMIT,
      CHAT_WRITE_LIMIT_CEILING
    );
    let bucket = this.chatWriteBuckets.get(userId);
    if (!bucket || now - bucket.windowStartedAt >= CHAT_WRITE_TTL_MS) {
      bucket = { windowStartedAt: now, count: 0 };
      this.chatWriteBuckets.set(userId, bucket);
    }
    if (bucket.count >= limit) {
      throw new WsException('Too many chat writes. Please try again shortly.');
    }
    bucket.count += 1;
  }

  private async ensureDirectChatAllowed(
    participantIds: string[]
  ): Promise<void> {
    const [first, second] = [...new Set(participantIds)].sort();
    if (!first || !second) return;
    const [firstBlockedSecond, secondBlockedFirst] = await Promise.all([
      firstValueFrom(
        this.socialClient.send(
          { cmd: PrivacyCommands.IS_USER_BLOCKED },
          { blockerId: first, blockedId: second }
        )
      ),
      firstValueFrom(
        this.socialClient.send(
          { cmd: PrivacyCommands.IS_USER_BLOCKED },
          { blockerId: second, blockedId: first }
        )
      ),
    ]);
    if (firstBlockedSecond || secondBlockedFirst) {
      throw new WsException('Direct messaging is unavailable');
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.socketSessionAuth.authenticate(client, true);
      await client.join(user.profileId);
      this.updateConnectedSockets(user.profileId, client, 'connect');
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('new_persona_chat')
  @UseInterceptors(AiOrchestrationReadinessInterceptor)
  async handleNewPersonaChat(
    @MessageBody()
    payload: { profileId: string; personaId: string; appId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const user = this.socketSessionAuth.assertProfile(
      client,
      payload.profileId
    );
    this.assertChatWriteAllowed(user.userId);
    payload.profileId = user.profileId;
    const profile: ProfileDto = await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.Get },
        { id: payload.profileId }
      )
    );
    this.l.log('New Persona Chat Requested');
    const senderId = payload.profileId;
    // this.updateConnectedSockets(senderId, client, 'connect');
    this.l.log(
      `Creating new chat for profileId: ${payload.profileId}, personaId: ${payload.personaId}`
    );
    const persona: PersonaTelosDto = await firstValueFrom(
      this.telosDocsClient.send(
        { cmd: PersonaTelosCommands.FIND_ONE },
        { id: payload.personaId }
      )
    );
    if (!persona) {
      this.l.error(
        `Persona with ID ${payload.personaId} not found. Cannot create chat.`
      );
      return;
    }
    // const newConversation: ChatConversation = {
    //   id: '',
    //   participants: [payload.profileId, payload.personaId],
    //   // title: `Chat with ${persona.name}`,?
    //   messages: [
    //     {
    //       id: '',
    //       conversationId: '',
    //       senderId: persona.id,
    //       senderName: persona.name,
    //       recipientName: [profile.profileName],
    //       recipientId: [payload.profileId],
    //       type: 'system',
    //       role: 'system',
    //       content: 'The user is new here. Say hello! introduce yourself.',
    //       timestamp: new Date(),
    //     },
    //   ],
    //   metadata: {
    //     appId: payload.appId,
    //   },
    //   privacy: 'public',
    //   createdAt: new Date(),
    //   updatedAt: new Date(),
    //   addMessage: function (message: ChatMessage): void {
    //     this.messages.push(message);
    //     this.updatedAt = new Date();
    //   },
    // };
    // const createdConversation: ChatConversation = await firstValueFrom(
    //   this.chatCollectorClient.send(
    //     { cmd: ChatCommands.POST_MESSAGE },
    //     newConversation
    //   )
    // );

    const orchestratorValue = await firstValueFrom(
      this.aiOrchestrationClient.send(
        { cmd: AIOrchestrationCommands.PROFILE_INITIALIZE },
        {
          profileId: payload.profileId,
          appId: payload.appId,
          personaId: payload.personaId,
        }
      )
    );
    this.l.debug(`orchestratorValue: ${JSON.stringify(orchestratorValue)}`);
    // this.l.log(
    //   `New conversation created with ID: ${createdConversation.id} for profileId: ${payload.profileId}`
    // );
    // Notify the client about the new conversation
    const conversations = await firstValueFrom(
      this.chatCollectorClient.send(
        { cmd: ChatCommands.GET_CONVERSATIONS },
        { profileId: payload.profileId }
      )
    );
    client.emit('conversations', conversations || []);
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() payload: ChatMessage,
    @ConnectedSocket() client: Socket,
    @Ack()
    acknowledge?: (response: {
      success: boolean;
      messageId?: string;
      statusCode?: number;
      message?: string;
    }) => void
  ): Promise<void> {
    const user = await this.socketSessionAuth
      .authenticate(client, true)
      .catch((error) => {
        this.acknowledgeMessageFailure(acknowledge, 401);
        throw new WsException(error.message);
      });
    if (payload.senderId && payload.senderId !== user.profileId) {
      this.acknowledgeMessageFailure(acknowledge, 403);
      throw new UnauthorizedException('Message sender does not match session');
    }
    try {
      this.assertChatWriteAllowed(user.userId);
    } catch (error) {
      this.acknowledgeMessageFailure(
        acknowledge,
        error instanceof Error && error.message.includes('Too many') ? 429 : 403
      );
      throw error;
    }
    payload.senderId = user.profileId;
    this.l.log('New Message Received');
    console.log('[ChatGateway] handleMessage received payload id:', payload.id);
    const senderId = payload.senderId;
    const conversation = await firstValueFrom(
      this.chatCollectorClient.send(
        { cmd: ChatCommands.GET_CONVERSATION },
        {
          conversationId: payload.conversationId,
          requestingProfileId: senderId,
        }
      )
    ).catch((error) => {
      this.acknowledgeMessageFailure(acknowledge, this.rpcStatus(error));
      throw new WsException(error);
    });
    if (!conversation) {
      this.acknowledgeMessageFailure(acknowledge, 404);
      throw new WsException('Conversation unavailable');
    }
    if (conversation.type === 'direct') {
      try {
        await this.ensureDirectChatAllowed(conversation.participants ?? []);
      } catch (error) {
        this.acknowledgeMessageFailure(acknowledge, this.rpcStatus(error));
        throw error;
      }
    }
    // The collector resolves current community recipients and validates every send.
    payload.recipientIds = (conversation.participants ?? []).filter(
      (id) => id !== senderId
    );
    const messageReceipt = await firstValueFrom(
      this.chatCollectorClient.send({ cmd: ChatCommands.POST_MESSAGE }, payload)
    ).catch((error) => {
      this.acknowledgeMessageFailure(acknowledge, this.rpcStatus(error));
      throw new WsException(error);
    });
    const receiptMessages = Array.isArray(messageReceipt?.messages)
      ? messageReceipt.messages
      : [];
    const storedMessage = payload.id
      ? receiptMessages.find((message) => message.id === payload.id)
      : receiptMessages[receiptMessages.length - 1];
    if (!storedMessage?.id) {
      this.acknowledgeMessageFailure(acknowledge, 503);
      throw new WsException('Message persistence could not be confirmed');
    }
    // The receipt is returned only after the collector's durable POST has
    // completed. Delivery fan-out may still be recovered from authorized history.
    acknowledge?.({ success: true, messageId: storedMessage.id });
    const recipientIds = storedMessage.recipients ?? [];
    this.updateConnectedSockets(senderId, client, 'connect');
    this.l.log(`Sender ID: ${senderId} connected.`);

    // Determine if any participants are AI
    let aiRecipients: PersonaTelosDto[] = [];
    try {
      const classifiedRecipients = await firstValueFrom(
        this.telosDocsClient.send(
          { cmd: PersonaTelosCommands.FIND },
          { id: recipientIds.join(',') }
        )
      );
      aiRecipients = Array.isArray(classifiedRecipients)
        ? classifiedRecipients
        : [];
    } catch (error) {
      this.l.warn(
        `Unable to classify chat recipients; continuing as human chat: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    this.l.log(
      `Sender ID: ${senderId}, Recipient IDs: ${recipientIds.join(', ')}`
    );
    if (aiRecipients && aiRecipients.length > 0) {
      this.l.log('AI recipients found, preparing message for AI.');
      payload.recipientName = aiRecipients.map((x) => x.name); // Add a flag or modify the payload as needed

      // Notify that AI is thinking
      this.broadcastToConversation(payload.conversationId, 'ai_status_update', {
        conversationId: payload.conversationId,
        status: 'thinking',
        message: 'AI is processing your message...',
      });
    }

    // Continue processing for AI recipients if any
    if (aiRecipients && aiRecipients.length > 0) {
      this.l.log('Sending to AI Orchestration Service');

      // Update status to responding
      this.broadcastToConversation(payload.conversationId, 'ai_status_update', {
        conversationId: payload.conversationId,
        status: 'responding',
      });

      const aiPayload: ChatConversation = await firstValueFrom(
        this.chatCollectorClient.send(
          { cmd: ChatCommands.GET_CONVERSATION },
          {
            conversationId: payload.conversationId,
            requestingProfileId: senderId,
          }
        )
      );

      this.l.debug(
        "Current ai payload: aiPayload='" +
          JSON.stringify(aiPayload) +
          "' new payload='" +
          JSON.stringify(payload) +
          "'"
      );

      // Set up polling for real-time updates while AI processes
      const conversationId = payload.conversationId;
      const allParticipantIds = [...new Set([senderId, ...recipientIds])];

      // Start polling immediately for new messages
      const pollInterval = setInterval(async () => {
        try {
          for (const participantId of allParticipantIds) {
            const participantSocket = this.connectedClients.find(
              (c) => c.id === participantId
            );

            if (participantSocket) {
              await this.socketSessionAuth.authenticate(
                participantSocket.client
              );
              await firstValueFrom(
                this.chatCollectorClient.send(
                  { cmd: ChatCommands.GET_CONVERSATION },
                  {
                    conversationId,
                    requestingProfileId: participantId,
                    deliverySenderId: senderId,
                  }
                )
              );
              const conversations = await firstValueFrom(
                this.chatCollectorClient.send(
                  { cmd: ChatCommands.GET_CONVERSATIONS },
                  { profileId: participantId }
                )
              );
              participantSocket.client.emit(
                'conversations',
                conversations || []
              );
            }
          }
        } catch (error) {
          this.l.error('Error during conversation polling:', error);
        }
      }, 500); // Poll every 500ms for new messages

      // Send to AI orchestrator (non-blocking for polling)
      firstValueFrom(
        this.aiOrchestrationClient.send(
          { cmd: AIOrchestrationCommands.CONVERSATION_UPDATE },
          { conversation: aiPayload, aiPersonas: aiRecipients }
        )
      )
        .then((aiResponses: Partial<ChatMessage>[]) => {
          this.l.log(
            `AI orchestrator completed with ${aiResponses.length} messages`
          );

          // Notify that AI has completed
          this.broadcastToConversation(
            payload.conversationId,
            'ai_status_update',
            {
              conversationId: payload.conversationId,
              status: 'complete',
            }
          );

          // Stop polling after AI completes. No final emit here: the tail
          // fan-out below re-reads every participant (same id set) and
          // emits, so a second read would duplicate it (O25b).
          clearInterval(pollInterval);

          this.l.log('AI message processing complete.');
        })
        .catch((error) => {
          this.l.error('Error in AI orchestration:', error);
          clearInterval(pollInterval);
        });
    } else {
      this.l.log('Message handling complete.');
    }
    await this.notifyPersistedMessage(payload.conversationId, storedMessage);
  }

  async notifyPersistedMessage(
    conversationId: string,
    storedMessage: PersistedChatMessageNotification
  ): Promise<void> {
    const senderId = storedMessage.senderId;
    const recipientProfileIds = [
      ...new Set([...(storedMessage.recipients ?? []), senderId]),
    ];
    this.l.log(
      'Updating recipient sockets...' + JSON.stringify(recipientProfileIds)
    );
    for (const id of recipientProfileIds) {
      this.l.log(`Notifying recipient: ${id}`);
      try {
        await firstValueFrom(
          this.chatCollectorClient.send(
            { cmd: ChatCommands.GET_CONVERSATION },
            { conversationId, requestingProfileId: id }
          )
        );
      } catch {
        continue;
      }
      const conversations = await firstValueFrom(
        this.chatCollectorClient.send(
          { cmd: ChatCommands.GET_CONVERSATIONS },
          { profileId: id }
        )
      );
      for (const connected of this.connectedClients.filter(
        (item) => item.id === id
      )) {
        try {
          await this.socketSessionAuth.authenticate(connected.client);
          await firstValueFrom(
            this.chatCollectorClient.send(
              { cmd: ChatCommands.GET_CONVERSATION },
              {
                conversationId,
                requestingProfileId: id,
                deliverySenderId: senderId,
              }
            )
          );
          connected.client.emit('message', {
            ...storedMessage,
            conversationId,
            recipientIds: storedMessage.recipients,
            recipientId: storedMessage.recipients,
            timestamp: storedMessage.createdAt,
          });
          connected.client.emit('conversations', conversations ?? []);
        } catch {
          /* Membership, block or session changed before delivery. */
        }
      }
    }
  }

  private rpcStatus(error: unknown): number {
    const direct = error as {
      statusCode?: unknown;
      error?: { statusCode?: unknown };
      response?: { statusCode?: unknown };
      getError?: () => unknown;
    };
    const nested = direct?.getError?.() as {
      statusCode?: unknown;
      error?: { statusCode?: unknown };
    };
    const status =
      direct?.statusCode ??
      direct?.error?.statusCode ??
      direct?.response?.statusCode ??
      nested?.statusCode ??
      nested?.error?.statusCode;
    return typeof status === 'number' ? status : 500;
  }

  private acknowledgeMessageFailure(
    acknowledge:
      | ((response: {
          success: boolean;
          statusCode?: number;
          message?: string;
        }) => void)
      | undefined,
    statusCode: number
  ): void {
    if (!acknowledge) return;
    const message =
      statusCode === 401
        ? 'Sign in again to send this message.'
        : statusCode === 403
        ? 'You no longer have access to this conversation.'
        : statusCode === 404
        ? 'This conversation is no longer available.'
        : 'Message could not be saved. Please retry.';
    acknowledge({ success: false, statusCode, message });
  }

  async invalidateConversations(): Promise<void> {
    for (const { id, client } of this.connectedClients) {
      try {
        const conversations = await firstValueFrom(
          this.chatCollectorClient.send(
            { cmd: ChatCommands.GET_CONVERSATIONS },
            { profileId: id }
          )
        );
        await this.socketSessionAuth.authenticate(client);
        client.emit('conversations', conversations ?? []);
      } catch {
        client.emit('conversations', []);
      }
    }
  }

  @SubscribeMessage('get_conversations')
  async handleGetConversations(
    @MessageBody() payload: { profileId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log('starting the call to get conversations.');
    await this.socketSessionAuth.authenticate(client, true);
    const senderId = this.socketSessionAuth.assertProfile(
      client,
      payload.profileId
    ).profileId;
    payload.profileId = senderId;
    this.l.log(`finding conversations for ${senderId}`);
    this.updateConnectedSockets(senderId, client, 'connect');
    const conversations = await firstValueFrom(
      this.chatCollectorClient.send(
        { cmd: ChatCommands.GET_CONVERSATIONS },
        payload
      )
    );
    client.emit('conversations', conversations || []);
  }

  private updateConnectedSockets(
    senderId: string,
    client: Socket,
    type: 'connect' | 'disconnect'
  ) {
    if (type === 'connect' && client.data?.deletionPurged)
      throw new WsException('Socket session unavailable');
    console.log(
      `Updating connected sockets for '${senderId}' with event type '${type}'`
    );
    if (!senderId) {
      this.l.warn('No senderId provided, cannot update connected sockets.');
      return;
    }
    if (type === 'connect') {
      this.connectedClients = this.connectedClients.filter(
        (connectedClient) => connectedClient.client !== client
      );
      this.connectedClients.push({ id: senderId, client });
    } else {
      this.connectedClients = this.connectedClients.filter(
        (c) => c.client !== client
      );
    }
    this.l.debug(
      `Currently connected clients: ${this.connectedClients
        .map((c) => c.id)
        .join(', ')}`
    );
  }

  @SubscribeMessage('get_or_create_direct_chat')
  async handleGetOrCreateDirectChat(
    @MessageBody() payload: { participantIds: string[] },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    const user = await this.socketSessionAuth
      .authenticate(client, true)
      .catch((error) => {
        throw new WsException(error.message);
      });
    this.assertChatWriteAllowed(user.userId);
    try {
      const participants = [...new Set(payload.participantIds ?? [])];
      const recipients = participants.filter((id) => id !== user.profileId);
      if (recipients.length !== 1)
        throw new Error('Exactly one recipient is required');
      const senderProfile = await firstValueFrom(
        this.profileClient.send(
          { cmd: ProfileCommands.Get },
          { id: user.profileId }
        )
      );
      const recipient = await firstValueFrom(
        this.profileClient.send(
          { cmd: ProfileCommands.Get },
          { id: recipients[0] }
        )
      );
      const scope =
        senderProfile?.appScope === 'owner-console'
          ? 'global'
          : senderProfile?.appScope;
      if (
        !senderProfile ||
        !recipient ||
        recipient.userId === user.userId ||
        ![scope, 'global', null].includes(recipient.appScope ?? null)
      )
        throw new Error('Recipient is not available in this app');
      await this.ensureDirectChatAllowed([user.profileId, recipient.id]);
      const conversation = await firstValueFrom(
        this.chatCollectorClient.send(
          { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
          { participantIds: [user.profileId, recipient.id] }
        )
      );
      client.emit('conversation', conversation);
    } catch (error) {
      throw new WsException(error instanceof Error ? error.message : error);
    }
  }

  @SubscribeMessage('get_messages')
  async handleGetMessages(
    @MessageBody() payload: { conversationId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    // The result was resolved and thrown away, so the socket path read any
    // conversation regardless of who was asking.
    const user = await this.socketSessionAuth
      .authenticate(client, true)
      .catch((error) => {
        throw new WsException(error.message);
      });
    this.l.log(`get_messages for conversation: ${payload.conversationId}`);
    const messages = await firstValueFrom(
      this.chatCollectorClient.send(
        { cmd: ChatCommands.GET_MESSAGES },
        {
          conversationId: payload.conversationId,
          requestingProfileId: user?.profileId,
        }
      )
    );
    client.emit('messages', messages || []);
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const disconnectedClient = this.connectedClients.find(
      (c) => c.client === client
    );
    this.l.log(`Client disconnected: ${disconnectedClient?.id}`);
    if (disconnectedClient) {
      this.updateConnectedSockets(disconnectedClient.id, client, 'disconnect');
    }
    client.disconnect();
  }

  /**
   * Broadcast AI status updates to all clients in a conversation
   */
  private async broadcastToConversation(
    conversationId: string,
    event: string,
    data: unknown
  ) {
    for (const { id, client } of this.connectedClients) {
      try {
        await firstValueFrom(
          this.chatCollectorClient.send(
            { cmd: ChatCommands.GET_CONVERSATION },
            { conversationId, requestingProfileId: id }
          )
        );
        await this.socketSessionAuth.authenticate(client);
        client.emit(event, data);
      } catch {
        /* A revoked or unrelated profile receives no event. */
      }
    }
  }
}
