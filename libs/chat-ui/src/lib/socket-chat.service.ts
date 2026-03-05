import { Socket, io } from 'socket.io-client';

import { ChatConversation, ChatMessage } from './types/message';
import { Inject, Injectable, Optional } from '@angular/core';
import { Subject, Observable } from 'rxjs';

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
export const SOCKET_HOST = 'SOCKET_HOST';
export const SOCKET_NAMESPACE = 'SOCKET_NAMESPACE';
export const SOCKET_IO_INSTANCE = 'SOCKET_IO_INSTANCE';
export const SOCKET_AUTH_TOKEN_PROVIDER = 'SOCKET_AUTH_TOKEN_PROVIDER';
export const SOCKET_AUTH_ERROR_HANDLER = 'SOCKET_AUTH_ERROR_HANDLER';

/**
 * Service for handling chat functionality via WebSockets.
 */
@Injectable({
  providedIn: 'root',
})
export class SocketChatService {
  private socket: Socket;
  private typingSubject = new Subject<{
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }>();
  private presenceSubject = new Subject<{
    userId: string;
    status: 'online' | 'offline' | 'away' | 'busy';
  }>();

  /**
   * Observable for typing indicator events.
   */
  typing$ = this.typingSubject.asObservable();

  /**
   * Observable for presence updates.
   */
  presence$ = this.presenceSubject.asObservable();

  /**
   * Creates an instance of the SocketChatService.
   * @param hostUrl The URL of the socket server.
   * @param namespace The namespace for the socket connection.
   * @param ioInstance The Socket.IO client instance.
   * @param authTokenProvider Function that returns the current auth token.
   * @param authErrorHandler Function called when auth errors occur (e.g., redirect to login).
   */
  constructor(
    @Inject(SOCKET_HOST) private readonly hostUrl = 'http://localhost:3000',
    @Inject(SOCKET_NAMESPACE) private readonly namespace = 'chat',
    @Inject(SOCKET_IO_INSTANCE) private readonly ioInstance: typeof io,
    @Optional()
    @Inject(SOCKET_AUTH_TOKEN_PROVIDER)
    private readonly authTokenProvider?: () => string | null,
    @Optional()
    @Inject(SOCKET_AUTH_ERROR_HANDLER)
    private readonly authErrorHandler?: () => void
  ) {
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
  onAIStatusUpdate(
    callback: (data: {
      conversationId: string;
      status: 'thinking' | 'responding' | 'complete' | 'error';
      message?: string;
    }) => void
  ): void {
    this.socket.on('ai_status_update', callback);
  }

  /**
   * Listens for streaming AI responses
   */
  onStreamingResponse(
    callback: (data: {
      conversationId: string;
      chunk: string;
      isComplete: boolean;
    }) => void
  ): void {
    this.socket.on('streaming_response', callback);
  }

  /**
   * Listens for tool call updates
   */
  onToolCallUpdate(
    callback: (data: {
      conversationId: string;
      toolName: string;
      status: 'calling' | 'success' | 'error' | 'retrying';
      error?: string;
      attempt?: number;
    }) => void
  ): void {
    this.socket.on('tool_call_update', callback);
  }

  sendInit(profileId: string, personaId: string, appId: string) {
    this.socket.emit('new_persona_chat', {
      profileId,
      personaId,
      appId,
    });
  }

  /**
   * Sends a typing indicator to the server.
   * @param conversationId The ID of the conversation.
   * @param isTyping Whether the user is typing or stopped typing.
   */
  sendTypingIndicator(conversationId: string, isTyping: boolean): void {
    this.socket.emit('typing', { conversationId, isTyping });
  }

  /**
   * Registers a callback to be invoked when a typing indicator is received.
   * @param callback The callback function.
   */
  onTypingIndicator(
    callback: (data: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => void
  ): void {
    this.socket.on('typing', callback);
  }

  /**
   * Sends presence status to the server.
   * @param status The presence status: 'online', 'offline', 'away', or 'busy'.
   */
  sendPresence(status: 'online' | 'offline' | 'away' | 'busy'): void {
    this.socket.emit('presence', { status });
  }

  /**
   * Registers a callback to be invoked when a presence update is received.
   * @param callback The callback function.
   */
  onPresenceUpdate(
    callback: (data: {
      userId: string;
      status: 'online' | 'offline' | 'away' | 'busy';
    }) => void
  ): void {
    this.socket.on('presence_update', callback);
  }

  /**
   * Requests presence information for specific users.
   * @param userIds Array of user IDs to get presence for.
   */
  getPresenceBatch(userIds: string[]): void {
    this.socket.emit('presence_batch', { userIds });
  }

  /**
   * Registers a callback for presence batch responses.
   * @param callback The callback function.
   */
  onPresenceBatch(
    callback: (data: {
      presences: { userId: string; status: string }[];
    }) => void
  ): void {
    this.socket.on('presence_batch_response', callback);
  }

  /**
   * Sends a message reaction.
   * @param messageId The ID of the message to react to.
   * @param emoji The emoji to add as a reaction.
   */
  sendReaction(messageId: string, emoji: string): void {
    this.socket.emit('reaction', { messageId, emoji });
  }

  /**
   * Removes a reaction from a message.
   * @param messageId The ID of the message.
   * @param emoji The emoji to remove.
   */
  removeReaction(messageId: string, emoji: string): void {
    this.socket.emit('reaction_remove', { messageId, emoji });
  }

  /**
   * Registers a callback for reaction updates.
   * @param callback The callback function.
   */
  onReactionUpdate(
    callback: (data: {
      messageId: string;
      reactions: { emoji: string; userId: string }[];
    }) => void
  ): void {
    this.socket.on('reaction_update', callback);
  }

  /**
   * Marks messages in a conversation as read.
   * @param conversationId The ID of the conversation.
   * @param messageIds Array of message IDs that have been read.
   */
  markAsRead(conversationId: string, messageIds: string[]): void {
    this.socket.emit('mark_read', { conversationId, messageIds });
  }

  /**
   * Registers a callback for read receipt updates.
   * @param callback The callback function.
   */
  onReadReceipt(
    callback: (data: {
      conversationId: string;
      messageId: string;
      userId: string;
    }) => void
  ): void {
    this.socket.on('read_receipt', callback);
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
