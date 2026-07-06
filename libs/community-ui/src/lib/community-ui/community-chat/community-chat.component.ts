import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
  ChatMessage,
  SocketChatService,
} from '@optimistic-tanuki/chat-ui';
import { CommunityService } from '../services/community.service';
import { CommunityDto } from '../models';

@Component({
  selector: 'lib-community-chat',
  standalone: true,
  imports: [CommonModule, ChatUiComponent],
  template: `
    <div class="community-chat">
      @if (loading()) {
      <div class="loading">Loading chat...</div>
      } @else if (error()) {
      <div class="error">{{ error() }}</div>
      } @else if (!chatRoomId()) {
      <div class="no-chat">
        <p>No chat room available for this community.</p>
        @if (isOwnerOrManager()) {
        <button class="create-btn" (click)="createChatRoom()">
          Create Chat Room
        </button>
        }
      </div>
      } @else {
      <lib-chat-ui
        [contacts]="chatContacts()"
        [conversations]="chatConversations()"
        [currentUserId]="currentUserId"
        [autoOpenFirstConversation]="true"
        [layout]="'embedded'"
        (messageSubmitted)="handleMessageSubmitted($event)"
      ></lib-chat-ui>
      }
    </div>
  `,
  styles: [
    `
      .community-chat {
        height: 100%;
        min-height: 400px;
      }
      .loading,
      .error,
      .no-chat {
        text-align: center;
        padding: 2rem;
        color: var(--local-complement, #666);
      }
      .error {
        color: #dc3545;
      }
      .create-btn {
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background: var(--local-accent, #4a90d9);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
      }
      .create-btn:hover {
        opacity: 0.9;
      }
    `,
  ],
})
export class CommunityChatComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private communityService = inject(CommunityService);
  private socketChatService = inject(SocketChatService);

  community = signal<CommunityDto | null>(null);
  chatRoomId = signal<string | null>(null);
  chatContacts = signal<ChatContact[]>([]);
  chatConversations = signal<ChatConversation[]>([]);

  loading = signal(true);
  error = signal<string | null>(null);

  currentUserId = '';
  isOwner = signal(false);
  private currentCommunityId: string | null = null;

  async ngOnInit() {
    this.route.data.subscribe((data: any) => {
      this.currentUserId = data['currentUserId'] || '';
    });

    this.socketChatService.onConversations(async (conversations: any[]) => {
      await this.handleConversationsLoaded(conversations);
    });
    this.socketChatService.onMessage((message) => {
      this.appendMessageToConversation(message);
    });

    const communitySlug = this.route.snapshot.paramMap.get('communitySlug');
    if (!communitySlug) {
      this.loadUserCommunitiesChat();
      return;
    }

    await this.loadCommunityBySlug(communitySlug);
    this.loading.set(false);
  }

  private async loadCommunityBySlug(slug: string) {
    try {
      const community = await this.communityService.findBySlug(slug);
      if (!community) {
        this.error.set('Community not found');
        return;
      }

      this.community.set(community);
      this.currentCommunityId = community.id;
      this.isOwner.set(community.ownerId === this.currentUserId);
      const chatRoom = await this.communityService.getCommunityChatRoom(
        community.id
      );
      if (chatRoom) {
        this.chatRoomId.set(chatRoom.id);
        await this.loadChatRoom(chatRoom.id, community);
      }
      this.socketChatService.getConversations(this.currentUserId);
    } catch (err) {
      console.error('Failed to load community:', err);
      this.error.set('Failed to load community');
    }
  }

  private async loadCommunity(communityId: string) {
    try {
      const community = await this.communityService.findOne(communityId);
      if (!community) {
        this.error.set('Community not found');
        return;
      }

      this.community.set(community);
      this.currentCommunityId = communityId;
      this.isOwner.set(community.ownerId === this.currentUserId);
      const chatRoom = await this.communityService.getCommunityChatRoom(
        communityId
      );
      if (chatRoom) {
        this.chatRoomId.set(chatRoom.id);
        await this.loadChatRoom(chatRoom.id, community);
      }
      this.socketChatService.getConversations(this.currentUserId);
    } catch (err) {
      console.error('Failed to load community:', err);
      this.error.set('Failed to load community');
    }
  }

  private async loadUserCommunitiesChat() {
    try {
      const communities = await this.communityService.getUserCommunities();
      if (communities.length > 0) {
        const community = communities[0];
        this.community.set(community);
        this.currentCommunityId = community.id;
        const chatRoom = await this.communityService.getCommunityChatRoom(
          community.id
        );
        if (chatRoom) {
          this.chatRoomId.set(chatRoom.id);
          await this.loadChatRoom(chatRoom.id, community);
        }
        this.socketChatService.getConversations(this.currentUserId);
      }
      this.loading.set(false);
    } catch (err) {
      console.error('Failed to load communities:', err);
      this.loading.set(false);
    }
  }

  private async loadChatRoom(conversationId: string, community: CommunityDto) {
    try {
      const [conversation, messages] = await Promise.all([
        this.communityService.getCommunityChatConversation(conversationId),
        this.communityService.getCommunityChatMessages(conversationId),
      ]);

      const transformedMessages: ChatMessage[] = messages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        recipientId: message.recipients || [],
        timestamp: new Date(message.createdAt),
      }));

      this.chatContacts.set([
        {
          id: conversation.id,
          name: community.name,
          profilePic: community.logoUrl || community.imageUrl,
        },
      ]);

      this.chatConversations.set([
        {
          id: conversation.id,
          participants: conversation.participants,
          messages: transformedMessages,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
        },
      ]);
    } catch (err) {
      console.error('Failed to load chat room:', err);
      if (this.isOwnerOrManager()) {
        await this.createChatRoom();
        return;
      }
      this.error.set('Failed to load community chat.');
    }
  }

  async handleMessageSubmitted(event: {
    conversationId: string;
    content: string;
  }) {
    if (!this.currentUserId) {
      return;
    }

    const conversation = this.chatConversations().find(
      (item) => item.id === event.conversationId
    );
    if (!conversation) {
      return;
    }

    const recipientIds = conversation.participants.filter(
      (participantId) => participantId !== this.currentUserId
    );

    const createdMessage = await this.communityService.sendCommunityChatMessage(
      {
        conversationId: event.conversationId,
        content: event.content,
        senderId: this.currentUserId,
        recipientIds,
      }
    );

    this.appendMessageToConversation({
      id: createdMessage.id,
      conversationId: createdMessage.conversationId,
      senderId: createdMessage.senderId,
      content: createdMessage.content,
      type: createdMessage.type,
      recipientId: createdMessage.recipients || recipientIds,
      timestamp: new Date(createdMessage.createdAt),
    });
  }

  private async handleConversationsLoaded(conversations: any[]) {
    if (!this.currentCommunityId) {
      return;
    }

    const communityConversations = conversations.filter(
      (conversation) =>
        conversation.type === 'community' &&
        conversation.communityId === this.currentCommunityId
    );

    if (communityConversations.length === 0) {
      return;
    }

    const participantIds = Array.from(
      new Set(
        communityConversations.flatMap(
          (conversation) => conversation.participants
        )
      )
    ).filter((profileId) => profileId !== this.currentUserId);

    const participantProfiles = participantIds.length
      ? await this.communityService.getProfilesByIds(participantIds)
      : [];
    const profileMap = new Map(
      participantProfiles.map((profile) => [
        profile.id,
        {
          id: profile.id,
          name: profile.profileName,
          profilePic: profile.profilePic,
        },
      ])
    );

    const conversationsWithMessages = await Promise.all(
      communityConversations.map(async (conversation) => {
        const messages = await this.communityService.getCommunityChatMessages(
          conversation.id
        );
        return {
          id: conversation.id,
          participants: conversation.participants,
          messages: messages.map((message) => ({
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            type: message.type,
            recipientId: message.recipients || [],
            timestamp: new Date(message.createdAt),
          })),
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
          participantProfiles: conversation.participants
            .map((participantId: string) => profileMap.get(participantId))
            .filter(Boolean),
        };
      })
    );

    this.chatContacts.set(
      communityConversations.map((conversation) => ({
        id: conversation.id,
        name: conversation.title || this.community()?.name || 'Community Chat',
        profilePic: this.community()?.logoUrl || this.community()?.imageUrl,
        lastMessage:
          conversationsWithMessages
            .find((item) => item.id === conversation.id)
            ?.messages.at(-1)?.content || '',
        lastMessageTime: conversationsWithMessages
          .find((item) => item.id === conversation.id)
          ?.messages.at(-1)
          ?.timestamp?.toISOString(),
      }))
    );
    this.chatConversations.set(conversationsWithMessages as any);
    this.chatRoomId.set(communityConversations[0].id);
  }

  private appendMessageToConversation(message: ChatMessage) {
    this.chatConversations.update((conversations) =>
      conversations.map((conversation) => {
        if (conversation.id !== message.conversationId) {
          return conversation;
        }

        if (conversation.messages.some((m) => m.id === message.id)) {
          return conversation;
        }

        return {
          ...conversation,
          messages: [...conversation.messages, message],
          updatedAt: message.timestamp,
        };
      })
    );

    this.chatContacts.update((contacts) =>
      contacts.map((contact) =>
        contact.id === message.conversationId
          ? {
              ...contact,
              lastMessage: message.content,
              lastMessageTime: message.timestamp.toISOString(),
            }
          : contact
      )
    );
  }

  ngOnDestroy() {
    this.socketChatService.destroy();
  }

  async createChatRoom() {
    const community = this.community();
    if (!community) return;

    try {
      const chatRoom = await this.communityService.ensureCommunityChatRoom(
        community.id,
        this.currentUserId,
        community.name
      );
      this.chatRoomId.set(chatRoom.id);
      await this.loadChatRoom(chatRoom.id, community);
    } catch (err) {
      console.error('Failed to create chat room:', err);
      this.error.set('Failed to create chat room');
    }
  }

  isOwnerOrManager(): boolean {
    return this.isOwner();
  }
}
