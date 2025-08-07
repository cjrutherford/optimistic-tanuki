import { Socket, io } from 'socket.io-client';

import { ChatConversation, ChatMessage } from './types/message';
import { Inject, Injectable } from '@angular/core';

/**
 * Injection Tokens for the SocketChatService.
 * These tokens allow for configuration of the socket connection,
 * such as the host URL and namespace.
 * They can be provided in the app module or any other module
 * to customize the socket connection settings.
 * 
 * SOCKET_HOST: The base URL for the socket server.
 * SOCKET_NAMESPACE: The namespace for the socket connection.
 * SOCKET_IO_INSTANCE: The instance of the socket.io client library.
 * 
 * These tokens should be set by YOU when providing the service in your application.
 * For example:
 * ```typescript
 * providers: [
 *   {
 *     provide: SOCKET_HOST,
 *     useValue: 'http://your-socket-server.com'  
 *  },{
 *     provide: SOCKET_NAMESPACE,
 *    useValue: 'your-namespace'
 *  },{
 *     provide: SOCKET_IO_INSTANCE,
 *     useValue: io
 *  }]
 */
export const SOCKET_HOST = 'SOCKET_HOST';
export const SOCKET_NAMESPACE = 'SOCKET_NAMESPACE';
export const SOCKET_IO_INSTANCE = 'SOCKET_IO_INSTANCE';

@Injectable({
  providedIn: 'root'
})
export class SocketChatService {
  private socket: Socket;

  constructor(
    @Inject(SOCKET_HOST) private readonly hostUrl = 'http://localhost:3000',
    @Inject(SOCKET_NAMESPACE) private readonly namespace = 'chat',
    @Inject(SOCKET_IO_INSTANCE) private readonly ioInstance: typeof io
  ) {
    this.socket = this.ioInstance(`${this.hostUrl}/${this.namespace}`, { autoConnect: true });
    this.socket.on('connect', () => {
      console.log(`Socket connected to ${this.hostUrl}/${this.namespace}`);
    });
    this.socket.on('disconnect', () => {
      console.log(`Socket disconnected from ${this.hostUrl}/${this.namespace}`);
    });
    this.socket.on('connect_error', (error) => {
      console.error(`Socket connection error: ${error.message}`);
    });
    this.socket.on('connect_timeout', (timeout) => {
      console.warn(`Socket connection timed out after ${timeout}ms`);
    });
    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`Socket reconnect attempt #${attempt}`);
    });
    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
    });
    this.socket.on('reconnect', (attempt) => {
      console.log(`Socket reconnected after ${attempt} attempts`);
    });
  }

  getConversations(profileId: string): void {
    this.socket.emit('get_conversations', { profileId });
  }

  sendMessage(message: ChatMessage): void {
    this.socket.emit('message', message);
  }

  onMessage(callback: (message: ChatMessage) => void): void {
    this.socket.on('message', callback);
  }

  onConversations(callback: (data: ChatConversation) => void): void {
    this.socket.on('conversations', callback);
  }

  destroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      console.log('Socket disconnected');
    } else {
      console.warn('Socket was not initialized');
    }
  }
}
