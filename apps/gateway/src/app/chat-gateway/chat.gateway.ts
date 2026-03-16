import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  ChatCommands,
  ServiceTokens,
  PersonaTelosCommands,
  AIOrchestrationCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';
import {
  ChatConversation,
  ChatMessage,
  PersonaTelosDto,
  ProfileDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { th } from 'zod/v4/locales';

@WebSocketGateway(Number(process.env.SOCKET_PORT) || 3300, {
  namespace: 'chat',
  cors: { origin: '*' },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private connectedClients: { id: string; client: Socket }[] = [];

  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE)
    private readonly chatCollectorClient: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiOrchestrationClient: ClientProxy,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy
  ) {}

  @SubscribeMessage('new_persona_chat')
  async handleNewPersonaChat(
    @MessageBody()
    payload: { profileId: string; personaId: string; appId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
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
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log('New Message Received');
    console.log('[ChatGateway] handleMessage received payload:', payload);
    const senderId = payload.senderId;
    const recipientIds = payload.recipientId;
    this.updateConnectedSockets(senderId, client, 'connect');
    this.l.log(`Sender ID: ${senderId} connected.`);

    // Determine if any participants are AI
    const aiRecipients: PersonaTelosDto[] = await firstValueFrom(
      this.telosDocsClient.send(
        { cmd: PersonaTelosCommands.FIND },
        { id: recipientIds.join(',') }
      )
    );
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

    // Post the message
    const messageReceipt = await firstValueFrom(
      this.chatCollectorClient.send({ cmd: ChatCommands.POST_MESSAGE }, payload)
    );
    this.l.log('Message Posted: ', messageReceipt);

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
          { conversationId: payload.conversationId }
        )
      );
      aiPayload.messages.push(payload);
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

          // Stop polling after AI completes
          clearInterval(pollInterval);

          // Do one final emit to ensure all messages are sent
          allParticipantIds.forEach(async (participantId) => {
            const participantSocket = this.connectedClients.find(
              (c) => c.id === participantId
            );

            if (participantSocket) {
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
          });

          this.l.log('AI message processing complete.');
        })
        .catch((error) => {
          this.l.error('Error in AI orchestration:', error);
          clearInterval(pollInterval);
        });
    } else {
      this.l.log('Message handling complete.');
    }
    const recipientSockets = this.connectedClients
      .filter((c) => recipientIds.includes(c.id) || c.id === senderId)
      .map((c) => ({ id: c.id, client: c.client }));
    this.l.log(
      'Updating recipient sockets...' +
        JSON.stringify(recipientSockets.map((r) => r.id))
    );
    for (const { id, client } of recipientSockets) {
      this.l.log(`Notifying recipient: ${id}`);
      const conversations = await firstValueFrom(
        this.chatCollectorClient.send(
          { cmd: ChatCommands.GET_CONVERSATIONS },
          { profileId: id }
        )
      );
      console.log(conversations);
      client.emit('conversations', conversations || []);
    }
  }

  @SubscribeMessage('get_conversations')
  async handleGetConversations(
    @MessageBody() payload: { profileId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log('starting the call to get conversations.');
    const senderId = payload.profileId;
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
    console.log(
      `Updating connected sockets for '${senderId}' with event type '${type}'`
    );
    if (!senderId) {
      this.l.warn('No senderId provided, cannot update connected sockets.');
      return;
    }
    if (type === 'connect') {
      if (!this.connectedClients.some((c) => c.id === senderId)) {
        this.connectedClients.push({ id: senderId, client });
      }
    } else {
      this.connectedClients = this.connectedClients.filter(
        (c) => c.id !== senderId
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
    this.l.log(
      `get_or_create_direct_chat for participants: ${payload.participantIds.join(
        ', '
      )}`
    );
    const conversation = await firstValueFrom(
      this.chatCollectorClient.send(
        { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
        { participantIds: payload.participantIds }
      )
    );
    client.emit('conversation', conversation);
  }

  @SubscribeMessage('get_messages')
  async handleGetMessages(
    @MessageBody() payload: { conversationId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log(`get_messages for conversation: ${payload.conversationId}`);
    const messages = await firstValueFrom(
      this.chatCollectorClient.send(
        { cmd: ChatCommands.GET_MESSAGES },
        { conversationId: payload.conversationId }
      )
    );
    client.emit('messages', messages || []);
  }

  @SubscribeMessage('disconnect')
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
  private broadcastToConversation(
    conversationId: string,
    event: string,
    data: any
  ) {
    this.l.debug(
      `Broadcasting ${event} to conversation ${conversationId}:`,
      data
    );
    // Send to all connected clients - in a real implementation, we'd filter by conversation participants
    this.connectedClients.forEach(({ client }) => {
      client.emit(event, data);
    });
  }
}
