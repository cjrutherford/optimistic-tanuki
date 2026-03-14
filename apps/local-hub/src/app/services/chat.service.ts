import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiBaseUrl}/chat`;

  getOrCreateDirectChat(participantIds: string[]): Promise<ChatConversation> {
    return firstValueFrom(
      this.http.post<ChatConversation>(
        `${this.baseUrl}/conversations/direct/get-or-create`,
        { participantIds }
      )
    );
  }

  getMessages(conversationId: string): Promise<ChatMessage[]> {
    return firstValueFrom(
      this.http.get<ChatMessage[]>(
        `${this.baseUrl}/messages/${conversationId}`
      )
    );
  }

  sendMessage(payload: {
    conversationId: string;
    content: string;
    senderId: string;
    recipientIds: string[];
  }): Promise<ChatMessage> {
    return firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, payload)
    );
  }
}
