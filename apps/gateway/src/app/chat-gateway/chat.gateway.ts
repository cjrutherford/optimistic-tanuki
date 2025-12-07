import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { 
  ConnectedSocket, 
  MessageBody, 
  SubscribeMessage, 
  WebSocketGateway, 
  WebSocketServer 
} from '@nestjs/websockets';
import { ChatCommands, ServiceTokens, PersonaTelosCommands, AIOrchestrationCommands } from '@optimistic-tanuki/constants';
import { ChatConversation, ChatMessage } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';

@WebSocketGateway((Number(process.env.SOCKET_PORT) || 3300), {namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private connectedClients: { id: string, client: Socket }[] = [];

  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE) 
    private readonly chatCollectorClient: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiOrchestrationClient: ClientProxy,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsClient: ClientProxy,
  ) {}

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() payload: ChatMessage, @ConnectedSocket() client: Socket): Promise<void> {
    this.l.log('New Message Received');
    const senderId = payload.senderId;
    const recipientIds = payload.recipientId;
    this.updateConnectedSockets(senderId, client, 'connect');
    this.l.log(`Sender ID: ${senderId} connected.`);
    const messageReceipt = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.POST_MESSAGE }, payload));
    this.l.log('Message Posted: ', messageReceipt);
    const aiRecipients = await firstValueFrom(this.telosDocsClient.send({ cmd: PersonaTelosCommands.FIND }, { id: recipientIds.join(',') }));
    this.l.log(`Sender ID: ${senderId}, Recipient IDs: ${recipientIds.join(', ')}`);
    if (aiRecipients && aiRecipients.length > 0) {
      this.l.log('AI recipients found, sending to AI Orchestration Service');
      const aiPayload: ChatConversation = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.GET_CONVERSATION }, { conversationId: payload.conversationId }));
      aiPayload.messages.push(payload);
      await firstValueFrom(this.aiOrchestrationClient.send({ cmd: AIOrchestrationCommands.CONVERSATION_UPDATE }, { conversation: aiPayload, aiPersonas: aiRecipients }));
      this.l.log('AI message sent successfully.');
    } else {
      this.l.log('No AI recipients found, message handling complete.');
    }
    const recipientSockets = this.connectedClients.filter(c => recipientIds.includes(c.id) || c.id === senderId).map(c => ({ id: c.id, client: c.client }));
    this.l.log('Updating recipient sockets...' + JSON.stringify(recipientSockets.map(r => r.id)));
    for( const {id, client} of recipientSockets) {
      this.l.log(`Notifying recipient: ${id}`);
      const conversations = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.GET_CONVERSATIONS }, { profileId: id }));
      console.log(conversations);
      client.emit('conversations', conversations || []);
    }
  }

  @SubscribeMessage('get_conversations')
  async handleGetConversations(@MessageBody() payload: { profileId: string }, @ConnectedSocket() client: Socket): Promise<void> {
    this.l.log('starting the call to get conversations.')
    const senderId = payload.profileId;
    this.l.log(`finding conversations for ${senderId}`);
    this.updateConnectedSockets(senderId, client, 'connect');
    const conversations = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.GET_CONVERSATIONS }, payload));
    client.emit('conversations', conversations || []);
  }

  private updateConnectedSockets(senderId: string, client: Socket, type: 'connect' | 'disconnect') {
    console.log(`Updating connected sockets for '${senderId}' with event type '${type}'`);
    if(!senderId) {
      this.l.warn('No senderId provided, cannot update connected sockets.');
      return;
    }
    if (type === 'connect') {
      if(!this.connectedClients.some(c => c.id === senderId)) {
        this.connectedClients.push({ id: senderId, client });
      }
    } else {
      this.connectedClients = this.connectedClients.filter(c => c.id !== senderId);
    }
    this.l.debug(`Currently connected clients: ${this.connectedClients.map(c => c.id).join(', ')}`);
  }

  @SubscribeMessage('disconnect')
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const disconnectedClient = this.connectedClients.find(c => c.client === client);
    this.l.log(`Client disconnected: ${disconnectedClient?.id}`);
    if (disconnectedClient) {
      this.updateConnectedSockets(disconnectedClient.id, client, 'disconnect');
    }
    client.disconnect();
  }
}
