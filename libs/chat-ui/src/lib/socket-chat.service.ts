import { Socket, io } from 'socket.io-client';

import { ChatConversation, ChatMessage } from './types/message';
import { Injectable, InjectionToken, inject } from '@angular/core';

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
 * SOCKET_AUTH_TOKEN_PROVIDER: Function that returns the current auth token.
 * SOCKET_AUTH_ERROR_HANDLER: Function called when auth errors occur.
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
 *  },{
 *     provide: SOCKET_AUTH_TOKEN_PROVIDER,
 *     useFactory: (authService) => () => authService.getToken(),
 *     deps: [AuthService]
 *  },{
 *     provide: SOCKET_AUTH_ERROR_HANDLER,
 *     useFactory: (router, authService) => () => {
 *       authService.logout();
 *       router.navigate(['/login']);
 *     },
 *     deps: [Router, AuthService]
 *  }]
 */
export const SOCKET_HOST = new InjectionToken<string>('SOCKET_HOST');
export const SOCKET_NAMESPACE = new InjectionToken<string>('SOCKET_NAMESPACE');
export const SOCKET_IO_INSTANCE = new InjectionToken<typeof io>('SOCKET_IO_INSTANCE');
export const SOCKET_AUTH_TOKEN_PROVIDER = new InjectionToken<() => string | null>('SOCKET_AUTH_TOKEN_PROVIDER');
export const SOCKET_AUTH_ERROR_HANDLER = new InjectionToken<() => void>('SOCKET_AUTH_ERROR_HANDLER');

/**
 * Service for handling chat functionality via WebSockets.
 */
@Injectable({
  providedIn: 'root',
})
export class SocketChatService {
  private readonly hostUrl = inject<string>(SOCKET_HOST) ?? 'http://localhost:3000';
  private readonly namespace = inject<string>(SOCKET_NAMESPACE) ?? 'chat';
  private readonly ioInstance = inject<typeof io>(SOCKET_IO_INSTANCE);
  private readonly authTokenProvider = inject<() => string | null>(SOCKET_AUTH_TOKEN_PROVIDER as any, { optional: true });
  private readonly authErrorHandler = inject<() => void>(SOCKET_AUTH_ERROR_HANDLER as any, { optional: true });

  private socket: Socket;

  /**
   * Creates an instance of the SocketChatService.
   * @param hostUrl The URL of the socket server.
   * @param namespace The namespace for the socket connection.
   * @param ioInstance The Socket.IO client instance.
   * @param authTokenProvider Function that returns the current auth token.
   * @param authErrorHandler Function called when auth errors occur (e.g., redirect to login).
   */
  constructor() {
    const token = this.authTokenProvider?.();
    this.socket = this.ioInstance(`${this.hostUrl}/${this.namespace}`, {
      autoConnect: true,
      auth: token ? { token } : undefined,
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    this.socket.on('connect', () => {
      console.log(`Socket connected to ${this.hostUrl}/${this.namespace}`);
    });
    this.socket.on('disconnect', () => {
      console.log(`Socket disconnected from ${this.hostUrl}/${this.namespace}`);
    });
    this.socket.on('connect_error', (error) => {
      console.error(`Socket connection error: ${error.message}`);

      // Check if this is an authentication error
      if (
        error.message.includes('unauthorized') ||
        error.message.includes('jwt') ||
        error.message.includes('token') ||
        error.message.includes('Unauthorized')
      ) {
        console.error('Socket authentication failed - redirecting to login');
        if (this.authErrorHandler) {
          this.authErrorHandler();
        }
      }
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
    this.socket.on('error', (error) => {
      console.error(`Socket error: ${error}`);

      // Handle authorization errors from the server
      if (typeof error === 'object' && error !== null) {
        const errorObj = error as any;
        if (
          errorObj.type === 'UnauthorizedException' ||
          errorObj.message?.includes('Unauthorized') ||
          errorObj.statusCode === 401
        ) {
          console.error('Socket authorization error - redirecting to login');
          if (this.authErrorHandler) {
            this.authErrorHandler();
          }
        }
      }
    });
  }

  /**
   * Retrieves the conversations for a given profile.
   * @param profileId The ID of the profile.
   */
  getConversations(profileId: string): void {
    this.socket.emit('get_conversations', { profileId });
  }

  /**
   * Sends a chat message.
   * @param message The message to send.
   */
  sendMessage(message: Partial<ChatMessage>): void {
    this.socket.emit('message', message);
  }

  /**
   * Registers a callback to be invoked when a message is received.
   * @param callback The callback function.
   */
  onMessage(callback: (message: ChatMessage) => void): void {
    this.socket.on('message', callback);
  }

  /**
   * Registers a callback to be invoked when a conversation is received.
   * @param callback The callback function.
   */
  onConversations(callback: (data: ChatConversation[]) => void): void {
    this.socket.on('conversations', callback);
  }

  /**
   * Listens for AI status updates
   */
  onAIStatusUpdate(callback: (data: { conversationId: string, status: 'thinking' | 'responding' | 'complete' | 'error', message?: string }) => void): void {
    this.socket.on('ai_status_update', callback);
  }

  /**
   * Listens for streaming AI responses
   */
  onStreamingResponse(callback: (data: { conversationId: string, chunk: string, isComplete: boolean }) => void): void {
    this.socket.on('streaming_response', callback);
  }

  /**
   * Listens for tool call updates
   */
  onToolCallUpdate(callback: (data: { conversationId: string, toolName: string, status: 'calling' | 'success' | 'error' | 'retrying', error?: string, attempt?: number }) => void): void {
    this.socket.on('tool_call_update', callback);
  }

  /**
   * Listens for active streams status (sent on reconnection)
   */
  onActiveStreams(callback: (streams: Array<{ conversationId: string, status: string, lastUpdate: Date }>) => void): void {
    this.socket.on('active_streams', callback);
  }

  /**
   * Listens for reconnection events
   */
  onReconnect(callback: () => void): void {
    this.socket.on('reconnect', callback);
  }

  /**
   * Request reconnect status update
   */
  requestReconnect(profileId: string): void {
    this.socket.emit('reconnect_request', { profileId });
  }

  sendInit(profileId: string, personaId: string, appId: string) {
    this.socket.emit('new_persona_chat', {
      profileId,
      personaId,
      appId,
    });
  }

  /**
   * Disconnects the socket.
   */
  destroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      console.log('Socket disconnected');
    } else {
      console.warn('Socket was not initialized');
    }
  }
}
