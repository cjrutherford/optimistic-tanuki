import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ChatCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { ChatMessage } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { Server, Socket } from 'socket.io';

@WebSocketGateway((Number(process.env.SOCKET_PORT) || 3300), {namespace: 'chat', cors: { origin: '*' } })
/**
 * WebSocket Gateway for handling chat-related events.
 */
@WebSocketGateway((Number(process.env.SOCKET_PORT) || 3300), {namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private connectedClients: { id: string, client: Socket }[] = [];

  /**
   * Creates an instance of ChatGateway.
   * @param chatCollectorClient Client proxy for the chat collector microservice.
   */
  constructor(
    @Inject(ServiceTokens.CHAT_COLLECTOR_SERVICE) private readonly chatCollectorClient: ClientProxy,
  ) {}

  /**
   * Handles incoming chat messages.
   * @param payload The chat message payload.
   * @param client The connected socket client.
   */
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

  /**
   * Handles requests to get conversations for a profile.
   * @param payload The payload containing the profile ID.
   * @param client The connected socket client.
   */
  @SubscribeMessage('get_conversations')
  async handleGetConversations(@MessageBody() payload: { profileId: string }, @ConnectedSocket() client: Socket): Promise<void> {
    const senderId = payload.profileId;
    this.updateConnectedSockets(senderId, client, 'connect');
    const conversations = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.GET_CONVERSATIONS }, payload));
    client.emit('conversations', {
      conversations: conversations || [],
    });
  }

  /**
   * Updates the list of connected sockets.
   * @param senderId The ID of the sender.
   * @param client The connected socket client.
   * @param type The type of update (connect or disconnect).
   */
  private updateConnectedSockets(senderId: string, client: Socket, type: 'connect' | 'disconnect') {
    if (type === 'connect') {
      if(!this.connectedClients.some(c => c.id === senderId)) {
        this.connectedClients.push({ id: senderId, client });
      }
    } else {
      this.connectedClients = this.connectedClients.filter(c => c.id !== senderId);
    }
  }

  /**
   * Handles client disconnection.
   * @param client The disconnected socket client.
   */
  @SubscribeMessage('disconnect')
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const disconnectedClient = this.connectedClients.find(c => c.client === client);
    if (disconnectedClient) {
      this.updateConnectedSockets(disconnectedClient.id, client, 'disconnect');
    }
    client.disconnect();
  }
}
