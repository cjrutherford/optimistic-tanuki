import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

export interface ChatConversation {
  id: string;
  title: string;
  type: 'direct' | 'community';
  communityId?: string;
  ownerId?: string;
  participants: string[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'chat' | 'info' | 'warning' | 'system';
  recipients: string[];
  createdAt: string | Date;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private get baseUrl() {
    return `${this.apiBaseUrl}/chat`;
  }

  /**
   * Get or create a 1-to-1 direct conversation between the two participants.
   * Emits `get_or_create_direct_chat`; resolves when the gateway emits `conversation` back.
   */
  getOrCreateDirectChat(recipientProfileId: string): Promise<ChatConversation> {
    return firstValueFrom(
      this.http.post<ChatConversation>(
        `${this.baseUrl}/conversations/direct/get-or-create`,
        { recipientProfileId }
      )
    );
  }

  /**
   * Fetch all messages in a conversation.
   * Emits `get_messages`; resolves when the gateway emits `messages` back.
   */
  getMessages(conversationId: string): Promise<ChatMessage[]> {
    const params = new HttpParams().set('_ts', Date.now().toString());
    const headers = new HttpHeaders({
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });

    return firstValueFrom(
      this.http.get<ChatMessage[]>(
        `${this.baseUrl}/messages/${conversationId}`,
        {
          params,
          headers,
        }
      )
    );
  }

  /**
   * Send a message to an existing conversation over the gateway REST API.
   * The gateway binds sender identity from the authenticated session and
   * returns the persisted message.
   */
  sendMessage(payload: {
    conversationId: string;
    content: string;
    senderId: string;
    recipientIds: string[];
    type?: 'chat' | 'info' | 'warning' | 'system';
  }): Promise<ChatMessage> {
    // The gateway binds senderId from the authenticated session and its
    // SendMessageDto accepts only these three fields. Never forward caller
    // supplied senderId or client-only message type to the REST boundary.
    const { conversationId, content, recipientIds } = payload;
    return firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, {
        conversationId,
        content,
        recipientIds,
      })
    );
  }
}
