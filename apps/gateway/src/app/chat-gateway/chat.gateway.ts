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
  // Track active streaming conversations: conversationId -> { status, participants, lastUpdate }
  private activeStreams = new Map<string, {
    status: 'thinking' | 'responding' | 'streaming';
    participants: string[];
    lastUpdate: Date;
    aiPersonas: string[];
  }>();

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
  ) { }

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
        message: 'AI is processing your message...'
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
        status: 'responding'
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

      // Get all participant IDs for broadcasting
      const conversationId = payload.conversationId;
      const allParticipantIds = [...new Set([senderId, ...recipientIds])];

      // Start AI processing with streaming
      this.processAIResponseWithStreaming(
        aiPayload,
        aiRecipients,
        senderId,
        recipientIds
      ).catch((error) => {
        this.l.error('Error processing AI response:', error);
        // Notify participants of error
        this.broadcastToConversation(payload.conversationId, 'ai_status_update', {
          conversationId: payload.conversationId,
          status: 'error',
          message: error.message || 'An error occurred'
        });
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

    // Send current streaming status for any active streams this user is part of
    this.sendActiveStreamsStatus(senderId, client);
  }

  @SubscribeMessage('reconnect_request')
  async handleReconnectRequest(
    @MessageBody() payload: { profileId: string },
    @ConnectedSocket() client: Socket
  ): Promise<void> {
    this.l.log(`Reconnect request from profile: ${payload.profileId}`);
    const senderId = payload.profileId;
    this.updateConnectedSockets(senderId, client, 'connect');

    // Send active streams status
    this.sendActiveStreamsStatus(senderId, client);

    // Refresh conversations
    const conversations = await firstValueFrom(
      this.chatCollectorClient.send(
        { cmd: ChatCommands.GET_CONVERSATIONS },
        { profileId: senderId }
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
  private broadcastToConversation(conversationId: string, event: string, data: any) {
    this.l.debug(`Broadcasting ${event} to conversation ${conversationId}:`, data);
    // Send to all connected clients - in a real implementation, we'd filter by conversation participants
    this.connectedClients.forEach(({ client }) => {
      client.emit(event, data);
    });
  }

  /**
   * Process AI response with real-time streaming
   */
  private async processAIResponseWithStreaming(
    conversation: ChatConversation,
    aiPersonas: PersonaTelosDto[],
    senderId: string,
    recipientIds: string[]
  ): Promise<void> {
    const allParticipantIds = [...new Set([senderId, ...recipientIds])];

    try {
      // Track this streaming conversation
      this.activeStreams.set(conversation.id, {
        status: 'thinking',
        participants: allParticipantIds,
        lastUpdate: new Date(),
        aiPersonas: aiPersonas.map(p => p.id)
      });

      this.l.log(`Starting streaming for conversation ${conversation.id} with ${aiPersonas.length} AI personas`);

      // Emit AI status: thinking
      this.emitToParticipants(allParticipantIds, 'ai_status_update', {
        conversationId: conversation.id,
        status: 'thinking',
        message: 'AI is processing your message...',
      });
      this.l.log('Calling AI Orchestrator with STREAM_CONVERSATION command');
      const streamObservable = this.aiOrchestrationClient.send(
        { cmd: AIOrchestrationCommands.STREAM_CONVERSATION },
        { conversation, aiPersonas }
      );

      this.l.log('Observable created, subscribing to stream...');
      let currentChunk = '';
      let receivedEvents = 0;

      // Subscribe to streaming events
      streamObservable.subscribe({
        next: (event: any) => {
          receivedEvents++;
          this.l.log(`Received streaming event #${receivedEvents}:`, event.type);
          this.l.debug('Received streaming event:', event);

          switch (event.type) {
            case 'thinking':
              // Update stream status
              // eslint-disable-next-line no-case-declarations
              const thinkingStream = this.activeStreams.get(conversation.id);
              if (thinkingStream) {
                thinkingStream.status = 'thinking';
                thinkingStream.lastUpdate = new Date();
              }
              // Emit thinking status
              this.emitToParticipants(allParticipantIds, 'ai_status_update', {
                conversationId: conversation.id,
                status: 'thinking',
                message: event.content.text,
              });
              break;

            case 'tool_start':
              // Emit tool call notification
              this.emitToParticipants(allParticipantIds, 'tool_call_update', {
                conversationId: conversation.id,
                toolName: event.content.tool,
                status: 'calling',
              });
              break;

            case 'tool_end':
              // Emit tool completion
              this.emitToParticipants(allParticipantIds, 'tool_call_update', {
                conversationId: conversation.id,
                toolName: event.content.tool,
                status: event.content.success ? 'success' : 'error',
              });
              break;

            case 'chunk':
              // Update stream status
              // eslint-disable-next-line no-case-declarations
              const chunkStream = this.activeStreams.get(conversation.id);
              if (chunkStream) {
                chunkStream.status = 'streaming';
                chunkStream.lastUpdate = new Date();
              }
              // Accumulate and emit streaming response
              currentChunk += event.content.text || event.content;
              this.emitToParticipants(allParticipantIds, 'streaming_response', {
                conversationId: conversation.id,
                chunk: event.content.text || event.content,
                isComplete: false,
              });
              break;

            case 'final_response':
              // Remove from active streams
              this.activeStreams.delete(conversation.id);

              // Emit completion status
              this.emitToParticipants(allParticipantIds, 'ai_status_update', {
                conversationId: conversation.id,
                status: 'complete',
              });

              this.emitToParticipants(allParticipantIds, 'streaming_response', {
                conversationId: conversation.id,
                chunk: '',
                isComplete: true,
              });

              // Refresh conversations
              this.refreshConversationsForParticipants(allParticipantIds);
              break;

            case 'error':
              // Remove from active streams on error
              this.activeStreams.delete(conversation.id);

              this.l.error('Streaming error event:', event.content);
              this.emitToParticipants(allParticipantIds, 'ai_status_update', {
                conversationId: conversation.id,
                status: 'error',
                message: event.content.message || 'An error occurred',
              });
              break;
          }
        },
        error: (error) => {
          // Remove from active streams on error
          this.activeStreams.delete(conversation.id);

          this.l.error('Streaming error:', error);
          this.l.error('Error stack:', error?.stack);
          this.emitToParticipants(allParticipantIds, 'ai_status_update', {
            conversationId: conversation.id,
            status: 'error',
            message: error.message || 'An error occurred',
          });
        },
        complete: () => {
          this.l.log(`AI streaming completed for conversation ${conversation.id}. Received ${receivedEvents} events`);
        },
      });
    } catch (error) {
      this.l.error('Error in streaming AI response:', error);
      this.emitToParticipants(allParticipantIds, 'ai_status_update', {
        conversationId: conversation.id,
        status: 'error',
        message: error.message || 'An error occurred',
      });
    }
  }

  /**
   * Emit event to all participants
   */
  private emitToParticipants(
    participantIds: string[],
    event: string,
    data: any
  ): void {
    participantIds.forEach((participantId) => {
      const participantSocket = this.connectedClients.find(
        (c) => c.id === participantId
      );
      if (participantSocket) {
        participantSocket.client.emit(event, data);
      }
    });
  }

  /**
   * Refresh conversations for all participants
   */
  private async refreshConversationsForParticipants(
    participantIds: string[]
  ): Promise<void> {
    for (const participantId of participantIds) {
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
        participantSocket.client.emit('conversations', conversations || []);
      }
    }
  }

  /**
   * Send active streaming status to a reconnected client
   */
  private sendActiveStreamsStatus(profileId: string, client: Socket): void {
    this.l.log(`Sending active streams status to profile: ${profileId}`);

    // Find all active streams this user is participating in
    const userStreams: any[] = [];
    this.activeStreams.forEach((streamData, conversationId) => {
      if (streamData.participants.includes(profileId)) {
        userStreams.push({
          conversationId,
          status: streamData.status,
          lastUpdate: streamData.lastUpdate
        });

        // Re-emit current status
        client.emit('ai_status_update', {
          conversationId,
          status: streamData.status,
          message: streamData.status === 'thinking'
            ? 'AI is processing your message...'
            : 'AI is responding...'
        });
      }
    });

    if (userStreams.length > 0) {
      this.l.log(`Found ${userStreams.length} active streams for profile ${profileId}`);
      client.emit('active_streams', userStreams);
    }
  }
}
