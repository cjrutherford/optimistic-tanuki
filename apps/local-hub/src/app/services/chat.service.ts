import { Injectable, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import type { Socket } from 'socket.io-client';

export interface ChatConversation {
  id: string;
  title: string;
  type: 'direct' | 'community';
  communityId?: string;
  ownerId?: string;
  participants: string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'chat' | 'info' | 'warning' | 'system';
  recipients: string[];
  createdAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private socket: Socket | null = null;
  private readonly destroy$ = new Subject<void>();

  /** Lazily connect (browser only) and return the socket instance. */
  private async getSocket(): Promise<Socket> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Chat is not available during server-side rendering.');
    }
    if (this.socket?.connected) {
      return this.socket;
    }
    const { io } = await import('socket.io-client');
    this.socket = io('/chat', {
      path: '/socket.io',
      transports: ['websocket'],
    });
    this.socket.on('connect', () => {
      console.log('[ChatService] Socket connected:', this.socket?.id);
    });
    this.socket.on('connect_error', (err: Error) => {
      console.error('[ChatService] Socket connection error:', err.message);
    });
    this.socket.on('disconnect', (reason: string) => {
      console.log('[ChatService] Socket disconnected:', reason);
    });
    return new Promise<Socket>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }
      this.socket.once('connect', () => resolve(this.socket!));
      this.socket.once('connect_error', (err: Error) => reject(err));
    });
  }

  /**
   * Get or create a 1-to-1 direct conversation between the two participants.
   * Emits `get_or_create_direct_chat`; resolves when the gateway emits `conversation` back.
   */
  getOrCreateDirectChat(participantIds: string[]): Promise<ChatConversation> {
    return this.getSocket().then(
      (socket) =>
        new Promise<ChatConversation>((resolve, reject) => {
          const onConversation = (conv: ChatConversation) => {
            socket.off('connect_error', onError);
            resolve(conv);
          };
          const onError = (err: Error) => {
            socket.off('conversation', onConversation);
            reject(err);
          };
          socket.once('conversation', onConversation);
          socket.once('connect_error', onError);
          socket.emit('get_or_create_direct_chat', { participantIds });
        })
    );
  }

  /**
   * Fetch all messages in a conversation.
   * Emits `get_messages`; resolves when the gateway emits `messages` back.
   */
  getMessages(conversationId: string): Promise<ChatMessage[]> {
    return this.getSocket().then(
      (socket) =>
        new Promise<ChatMessage[]>((resolve, reject) => {
          const onMessages = (msgs: ChatMessage[]) => {
            socket.off('connect_error', onError);
            resolve(msgs);
          };
          const onError = (err: Error) => {
            socket.off('messages', onMessages);
            reject(err);
          };
          socket.once('messages', onMessages);
          socket.once('connect_error', onError);
          socket.emit('get_messages', { conversationId });
        })
    );
  }

  /**
   * Send a message to an existing conversation.
   * Emits the standard `message` event; the gateway updates all participants
   * by broadcasting `conversations` — this method resolves once the server
   * echoes back the updated conversations list so the caller can re-fetch.
   */
  sendMessage(payload: {
    conversationId: string;
    content: string;
    senderId: string;
    recipientIds: string[];
    recipientName?: string[];
    id?: string;
    type?: string;
    role?: string;
  }): Promise<ChatMessage> {
    return this.getSocket().then(
      (socket) =>
        new Promise<ChatMessage>((resolve, reject) => {
          const onConversations = () => {
            socket.off('connect_error', onError);
            // Resolve with a synthetic message object since the gateway does
            // not emit a single `message` ack — it broadcasts `conversations`.
            resolve({
              id: payload.id ?? uuidv4(),
              conversationId: payload.conversationId,
              senderId: payload.senderId,
              content: payload.content,
              type: 'chat',
              recipients: payload.recipientIds,
              createdAt: new Date(),
            } as ChatMessage);
          };
          const onError = (err: Error) => {
            socket.off('conversations', onConversations);
            reject(err);
          };
          socket.once('conversations', onConversations);
          socket.once('connect_error', onError);
          console.log('[ChatService] Sending message:', payload);
          socket.emit('message', {
            id: payload.id ?? uuidv4(),
            conversationId: payload.conversationId,
            senderId: payload.senderId,
            recipientId: payload.recipientIds, // gateway model field name
            recipientName: payload.recipientName ?? [],
            content: payload.content,
            type: payload.type ?? 'chat',
            role: payload.role ?? 'user',
            timestamp: new Date(),
          });
        })
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
