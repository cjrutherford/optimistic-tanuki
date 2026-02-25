import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
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

export interface CreateDirectChatDto {
  participantIds: string[];
}

export interface CreateCommunityChatDto {
  communityId: string;
  name?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private baseUrl: string;
  private readonly http = inject(HttpClient);

  constructor() {
    this.baseUrl = '/api/chat';
  }

  getConversations(profileId: string): Promise<ChatConversation[]> {
    return firstValueFrom(
      this.http.get<ChatConversation[]>(
        `${this.baseUrl}/conversations/${profileId}`
      )
    ) as Promise<ChatConversation[]>;
  }

  getConversation(conversationId: string): Promise<ChatConversation> {
    return firstValueFrom(
      this.http.get<ChatConversation>(
        `${this.baseUrl}/conversations/id/${conversationId}`
      )
    ) as Promise<ChatConversation>;
  }

  getMessages(conversationId: string): Promise<ChatMessage[]> {
    return firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${conversationId}`)
    ) as Promise<ChatMessage[]>;
  }

  createDirectChat(dto: CreateDirectChatDto): Promise<ChatConversation> {
    return firstValueFrom(
      this.http.post<ChatConversation>(
        `${this.baseUrl}/conversations/direct`,
        dto
      )
    ) as Promise<ChatConversation>;
  }

  getOrCreateDirectChat(participantIds: string[]): Promise<ChatConversation> {
    return firstValueFrom(
      this.http.post<ChatConversation>(
        `${this.baseUrl}/conversations/direct/get-or-create`,
        {
          participantIds,
        }
      )
    ) as Promise<ChatConversation>;
  }

  createCommunityChat(dto: CreateCommunityChatDto): Promise<ChatConversation> {
    return firstValueFrom(
      this.http.post<ChatConversation>(
        `${this.baseUrl}/conversations/community`,
        dto
      )
    ) as Promise<ChatConversation>;
  }

  deleteConversation(conversationId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/conversations/${conversationId}`)
    ) as Promise<void>;
  }

  sendMessage(message: {
    conversationId: string;
    content: string;
    senderId: string;
    recipientIds: string[];
  }): Promise<ChatMessage> {
    return firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, message)
    ) as Promise<ChatMessage>;
  }

  async startDirectChat(
    currentProfileId: string,
    otherProfileId: string
  ): Promise<ChatConversation> {
    return this.getOrCreateDirectChat([currentProfileId, otherProfileId]);
  }
}
