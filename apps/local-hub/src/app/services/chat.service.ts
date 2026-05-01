import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/chat';

  /**
   * Get or create a 1-to-1 direct conversation between the two participants.
   * Emits `get_or_create_direct_chat`; resolves when the gateway emits `conversation` back.
   */
  getOrCreateDirectChat(participantIds: string[]): Promise<ChatConversation> {
    return firstValueFrom(
      this.http.post<ChatConversation>(
        `${this.baseUrl}/conversations/direct/get-or-create`,
        { participantIds }
      )
    ) as Promise<ChatConversation>;
  }

  /**
   * Fetch all messages in a conversation.
   * Emits `get_messages`; resolves when the gateway emits `messages` back.
   */
  getMessages(conversationId: string): Promise<ChatMessage[]> {
    return firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${conversationId}`)
    ) as Promise<ChatMessage[]>;
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
    type?: 'chat' | 'info' | 'warning' | 'system';
  }): Promise<ChatMessage> {
    return firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, payload)
    ) as Promise<ChatMessage>;
  }
}
