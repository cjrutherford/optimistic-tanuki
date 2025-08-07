import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ChatCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { ChatMessage } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';

@WebSocketGateway((Number(process.env.SOCKET_PORT) || 3300), {namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private connectedClients: { id: string, client: Socket }[] = [];

  constructor(
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE) private readonly chatCollectorClient: ClientProxy,
  ) {}

  @SubscribeMessage('message')
  async handleMessage(@MessageBody() payload: ChatMessage, @ConnectedSocket() client: Socket): Promise<void> {
    const senderId = payload.senderId;
    this.updateConnectedSockets(senderId, client, 'connect');
    const messageReceipt = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.POST_MESSAGE }, payload));
    const recipientSockets = this.connectedClients.filter(c => payload.recipientId.includes(c.id) || c.id === senderId);
    for( const recipient of recipientSockets) {
      const conversations = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.GET_CONVERSATIONS }, { userId: recipient.id }));
      recipient.client.emit('conversations', {
        ...messageReceipt,
        conversations: conversations || [],
      });
    }
  }

  @SubscribeMessage('get_conversations')
  async handleGetConversations(@MessageBody() payload: { profileId: string }, @ConnectedSocket() client: Socket): Promise<void> {
    const senderId = payload.profileId;
    this.updateConnectedSockets(senderId, client, 'connect');
    const conversations = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.GET_CONVERSATIONS }, payload));
    client.emit('conversations', {
      conversations: conversations || [],
    });
  }

  private updateConnectedSockets(senderId: string, client: Socket, type: 'connect' | 'disconnect') {
    if (type === 'connect') {
      if(!this.connectedClients.some(c => c.id === senderId)) {
        this.connectedClients.push({ id: senderId, client });
      }
    } else {
      this.connectedClients = this.connectedClients.filter(c => c.id !== senderId);
    }
  }

  @SubscribeMessage('disconnect')
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const disconnectedClient = this.connectedClients.find(c => c.client === client);
    if (disconnectedClient) {
      this.updateConnectedSockets(disconnectedClient.id, client, 'disconnect');
    }
    client.disconnect();
  }
}
