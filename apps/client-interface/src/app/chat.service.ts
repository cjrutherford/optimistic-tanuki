import { Injectable, inject } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/chat-ui-data-access';

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
  recipientProfileId: string;
}

export interface CreateCommunityChatDto {
  communityId: string;
  ownerId: string;
  name?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly chat = inject(OptomisitcTanukiAPIService);

  getConversations(profileId: string): Promise<ChatConversation[]> {
    // The route reads the reader from the session; profileId stays for
    // call-site stability but no longer travels as a query param.
    void profileId;
    return firstValueFrom(this.chat.chatControllerGetConversations()).then(
      (conversations) =>
        conversations.map(
          (conversation) =>
            ({
              id: conversation.id,
              title: conversation.title,
              type: conversation.type,
              communityId: conversation.communityId,
              ownerId: conversation.ownerId,
              participants: conversation.participants,
              isDeleted: conversation.isDeleted,
              createdAt: conversation.createdAt,
              updatedAt: conversation.updatedAt,
            } as unknown as ChatConversation)
        )
    );
  }

  getConversation(conversationId: string): Promise<ChatConversation> {
    return firstValueFrom(
      this.chat.chatControllerGetConversation(conversationId)
    ).then(
      (conversation) =>
        ({
          id: conversation.id ?? conversationId,
          title: conversation.title,
          type: conversation.type,
          communityId: conversation.communityId,
          ownerId: conversation.ownerId,
          participants: conversation.participants,
          isDeleted: conversation.isDeleted,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        } as unknown as ChatConversation)
    );
  }

  getMessages(conversationId: string): Promise<ChatMessage[]> {
    const params = new HttpParams().set('_ts', Date.now().toString());
    const headers = new HttpHeaders({
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });

    return firstValueFrom(
      this.chat.chatControllerGetMessages(conversationId, { params, headers })
    ).then((messages) =>
      messages.map(
        (message) =>
          ({
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            type: message.type,
            recipients:
              (message as unknown as { recipients?: string[] }).recipients ??
              message.recipientIds ??
              [],
            createdAt: message.createdAt,
          } as unknown as ChatMessage)
      )
    );
  }

  createDirectChat(dto: CreateDirectChatDto): Promise<ChatConversation> {
    return this.getOrCreateDirectChat(dto.recipientProfileId);
  }

  getOrCreateDirectChat(recipientProfileId: string): Promise<ChatConversation> {
    return firstValueFrom(
      this.chat.chatControllerGetOrCreateDirectChat({ recipientProfileId })
    ).then(
      (conversation) =>
        ({
          id: conversation.id,
          title: conversation.title,
          type: conversation.type,
          communityId: conversation.communityId,
          ownerId: conversation.ownerId,
          participants: conversation.participants,
          isDeleted: conversation.isDeleted,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        } as unknown as ChatConversation)
    );
  }

  createCommunityChat(dto: CreateCommunityChatDto): Promise<ChatConversation> {
    return firstValueFrom(
      this.chat.chatControllerCreateCommunityChat(dto)
    ).then(
      (conversation) =>
        ({
          id: conversation.id,
          title: conversation.title,
          type: conversation.type,
          communityId: conversation.communityId,
          ownerId: conversation.ownerId,
          participants: conversation.participants,
          isDeleted: conversation.isDeleted,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        } as unknown as ChatConversation)
    );
  }

  sendMessage(message: {
    conversationId: string;
    content: string;
    senderId: string;
    recipientIds: string[];
  }): Promise<ChatMessage> {
    // The gateway binds senderId from the session and overwrites any client
    // value, so it no longer travels (previously rode along unused).
    const { senderId: _senderId, ...body } = message;
    return firstValueFrom(this.chat.chatControllerSendMessage(body)).then(
      (sent) =>
        ({
          id: sent.id,
          conversationId: sent.conversationId,
          senderId: sent.senderId,
          content: sent.content,
          type: sent.type,
          recipients:
            (sent as unknown as { recipients?: string[] }).recipients ??
            sent.recipientIds ??
            [],
          createdAt: sent.createdAt,
        } as unknown as ChatMessage)
    );
  }

  async startDirectChat(otherProfileId: string): Promise<ChatConversation> {
    return this.getOrCreateDirectChat(otherProfileId);
  }
}
