import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatMessageSubmission,
  SocketChatService,
} from '@optimistic-tanuki/chat-ui';
import { CommunityService } from '../services/community.service';
import { CommunityDto } from '../models';
import { skip } from 'rxjs';

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
      } @else { @if (connectionStatus() === 'reconnecting') {
      <p role="status" class="connection-status">
        Reconnecting… authorized chat history will reload when connected.
      </p>
      }
      <lib-chat-ui
        [contacts]="chatContacts()"
        [conversations]="chatConversations()"
        [currentUserId]="currentUserId"
        [autoOpenFirstConversation]="true"
        [layout]="'embedded'"
        (messageSubmission)="handleMessageSubmitted($event)"
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
      .connection-status {
        color: var(--local-complement, #666);
        text-align: center;
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
  connectionStatus = signal<'connecting' | 'connected' | 'reconnecting'>(
    'connecting'
  );

  currentUserId = '';
  isOwner = signal(false);
  private currentCommunityId: string | null = null;
  private readonly listeners: (() => void)[] = [];
  private hasConnectedOnce = false;
  private historyLoadVersion = 0;
  private communityLoadVersion = 0;

  async ngOnInit() {
    const routeDataSubscription = this.route.data.subscribe((data: any) => {
      const nextUserId = data['currentUserId'] || '';
      if (this.currentUserId && this.currentUserId !== nextUserId) {
        this.historyLoadVersion += 1;
        this.communityLoadVersion += 1;
        this.currentCommunityId = null;
        this.community.set(null);
        this.isOwner.set(false);
        this.error.set(null);
        this.chatConversations.set([]);
        this.chatContacts.set([]);
        this.chatRoomId.set(null);
        this.loading.set(false);
      }
      this.currentUserId = nextUserId;
    });
    this.listeners.push(() => routeDataSubscription.unsubscribe());
    const routeParamsSubscription = this.route.paramMap
      .pipe(skip(1))
      .subscribe((params) => {
        const slug = params.get('communitySlug');
        if (slug) {
          void this.loadCommunityBySlug(slug);
        } else {
          void this.loadUserCommunitiesChat();
        }
      });
    this.listeners.push(() => routeParamsSubscription.unsubscribe());

    this.listeners.push(
      this.socketChatService.onConversations(async (conversations: any[]) => {
        await this.handleConversationsLoaded(conversations);
      })
    );
    this.listeners.push(
      this.socketChatService.onMessage((message) => {
        this.appendMessageToConversation(message);
      })
    );
    this.listeners.push(
      this.socketChatService.onConnectionState((connected) => {
        if (connected) {
          const reconnecting = this.hasConnectedOnce;
          this.hasConnectedOnce = true;
          this.connectionStatus.set('connected');
          if (reconnecting && this.currentUserId) {
            this.socketChatService.getConversations(this.currentUserId);
          }
        } else {
          this.connectionStatus.set(
            this.hasConnectedOnce ? 'reconnecting' : 'connecting'
          );
        }
      })
    );

    const communitySlug = this.route.snapshot.paramMap.get('communitySlug');
    if (!communitySlug) {
      void this.loadUserCommunitiesChat();
      return;
    }

    await this.loadCommunityBySlug(communitySlug);
  }

  private async loadCommunityBySlug(slug: string) {
    const loadVersion = ++this.communityLoadVersion;
    const userId = this.currentUserId;
    const isCurrentLoad = () =>
      loadVersion === this.communityLoadVersion &&
      userId === this.currentUserId;
    this.loading.set(true);
    this.error.set(null);
    this.community.set(null);
    this.isOwner.set(false);
    this.historyLoadVersion += 1;
    this.currentCommunityId = null;
    this.chatConversations.set([]);
    this.chatContacts.set([]);
    this.chatRoomId.set(null);
    try {
      const community = await this.communityService.findBySlug(slug);
      if (!isCurrentLoad()) return;
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
      if (!isCurrentLoad()) return;
      if (chatRoom) {
        this.chatRoomId.set(chatRoom.id);
        await this.loadChatRoom(chatRoom.id, community, isCurrentLoad);
      }
      if (!isCurrentLoad()) return;
      this.socketChatService.getConversations(this.currentUserId);
    } catch (err) {
      if (!isCurrentLoad()) return;
      console.error('Failed to load community:', err);
      this.error.set('Failed to load community');
    } finally {
      if (isCurrentLoad()) this.loading.set(false);
    }
  }

  private async loadUserCommunitiesChat() {
    const loadVersion = ++this.communityLoadVersion;
    const userId = this.currentUserId;
    const isCurrentLoad = () =>
      loadVersion === this.communityLoadVersion &&
      userId === this.currentUserId;
    this.loading.set(true);
    this.error.set(null);
    this.community.set(null);
    this.isOwner.set(false);
    this.historyLoadVersion += 1;
    this.currentCommunityId = null;
    this.chatConversations.set([]);
    this.chatContacts.set([]);
    this.chatRoomId.set(null);
    try {
      const communities = await this.communityService.getUserCommunities();
      if (!isCurrentLoad()) return;
      if (communities.length > 0) {
        const community = communities[0];
        this.community.set(community);
        this.currentCommunityId = community.id;
        this.isOwner.set(community.ownerId === userId);
        const chatRoom = await this.communityService.getCommunityChatRoom(
          community.id
        );
        if (!isCurrentLoad()) return;
        if (chatRoom) {
          this.chatRoomId.set(chatRoom.id);
          await this.loadChatRoom(chatRoom.id, community, isCurrentLoad);
        }
        if (!isCurrentLoad()) return;
        this.socketChatService.getConversations(this.currentUserId);
      }
    } catch (err) {
      if (!isCurrentLoad()) return;
      console.error('Failed to load communities:', err);
    } finally {
      if (isCurrentLoad()) this.loading.set(false);
    }
  }

  private async loadChatRoom(
    conversationId: string,
    community: CommunityDto,
    isCurrentLoad: () => boolean = () => true
  ) {
    try {
      const [conversation, messages] = await Promise.all([
        this.communityService.getCommunityChatConversation(conversationId),
        this.communityService.getCommunityChatMessages(conversationId),
      ]);
      if (!isCurrentLoad()) return;

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
      if (!isCurrentLoad()) return;
      console.error('Failed to load chat room:', err);
      if (this.isOwnerOrManager()) {
        await this.createChatRoom(isCurrentLoad);
        return;
      }
      this.error.set('Failed to load community chat.');
    }
  }

  async handleMessageSubmitted(
    event: ChatMessageSubmission & {
      conversationId: string;
    }
  ) {
    const conversationId = event.conversationId;
    if (!this.currentUserId) {
      event.settle(false);
      return;
    }

    const conversation = this.chatConversations().find(
      (item) => item.id === conversationId
    );
    if (!conversation) {
      event.settle(false);
      return;
    }

    const recipientIds = conversation.participants.filter(
      (participantId) => participantId !== this.currentUserId
    );

    try {
      await this.socketChatService.sendDraftMessage({
        conversationId,
        content: event.content,
        senderId: this.currentUserId,
        recipientId: recipientIds,
        type: 'chat',
      });
      event.settle(true);
    } catch {
      event.settle(false);
    }
  }

  private async handleConversationsLoaded(conversations: any[]) {
    const communityId = this.currentCommunityId;
    const userId = this.currentUserId;
    if (!communityId) {
      return;
    }
    const historyLoadVersion = ++this.historyLoadVersion;

    const communityConversations = conversations.filter(
      (conversation) =>
        conversation.type === 'community' &&
        conversation.communityId === communityId
    );

    if (communityConversations.length === 0) {
      const currentRoomId = this.chatRoomId();
      if (!currentRoomId) {
        // Initial route loading owns authorization until it has resolved a
        // room. An early socket snapshot must not race that REST request.
        return;
      }

      try {
        const authorizedConversation =
          await this.communityService.getCommunityChatConversation(
            currentRoomId
          );
        if (
          historyLoadVersion !== this.historyLoadVersion ||
          communityId !== this.currentCommunityId ||
          userId !== this.currentUserId ||
          currentRoomId !== this.chatRoomId()
        ) {
          return;
        }
        if (authorizedConversation.id === currentRoomId) {
          this.error.set(null);
          return;
        }

        this.clearUnavailableCommunityChat(
          'Failed to verify community chat access. Please try again.'
        );
      } catch (error) {
        if (
          historyLoadVersion !== this.historyLoadVersion ||
          communityId !== this.currentCommunityId ||
          userId !== this.currentUserId ||
          currentRoomId !== this.chatRoomId()
        ) {
          return;
        }

        const status = this.getErrorStatus(error);
        this.clearUnavailableCommunityChat(
          status === 403
            ? 'Community chat is unavailable. Approved membership is required.'
            : status === 401
            ? 'Sign in again to access community chat.'
            : status === 404
            ? 'Community chat could not be found.'
            : 'Failed to verify community chat access. Please try again.'
        );
      }
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
        const fetchedMessages = messages.map((message) => ({
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          recipientId: message.recipients || [],
          timestamp: new Date(message.createdAt),
        }));
        return {
          id: conversation.id,
          participants: conversation.participants,
          messages: fetchedMessages,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
          participantProfiles: conversation.participants
            .map((participantId: string) => profileMap.get(participantId))
            .filter(Boolean),
        };
      })
    );

    if (
      historyLoadVersion !== this.historyLoadVersion ||
      communityId !== this.currentCommunityId ||
      userId !== this.currentUserId
    ) {
      return;
    }
    const latestVisibleMessages = new Map(
      this.chatConversations().map((conversation) => [
        conversation.id,
        conversation.messages,
      ])
    );
    for (const conversation of conversationsWithMessages) {
      const mergedMessages = new Map(
        conversation.messages.map((message) => [message.id, message])
      );
      for (const message of latestVisibleMessages.get(conversation.id) || []) {
        mergedMessages.set(message.id, message);
      }
      conversation.messages = [...mergedMessages.values()].sort(
        (left, right) => left.timestamp.getTime() - right.timestamp.getTime()
      );
    }

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

  private clearUnavailableCommunityChat(
    message = 'Community chat is unavailable. Approved membership is required.'
  ) {
    this.chatConversations.set([]);
    this.chatContacts.set([]);
    this.chatRoomId.set(null);
    this.error.set(message);
  }

  private getErrorStatus(error: unknown): number | null {
    if (typeof error !== 'object' || error === null) {
      return null;
    }

    const candidate = error as { status?: unknown; statusCode?: unknown };
    if (typeof candidate.status === 'number') {
      return candidate.status;
    }
    return typeof candidate.statusCode === 'number'
      ? candidate.statusCode
      : null;
  }

  ngOnDestroy() {
    this.listeners.forEach((dispose) => dispose?.());
  }

  async createChatRoom(isCurrentLoad: () => boolean = () => true) {
    const community = this.community();
    if (!community) return;
    const loadVersion = this.communityLoadVersion;
    const isCurrentCommunity = () =>
      isCurrentLoad() &&
      loadVersion === this.communityLoadVersion &&
      this.community()?.id === community.id;

    try {
      const chatRoom = await this.communityService.ensureCommunityChatRoom(
        community.id,
        this.currentUserId,
        community.name
      );
      if (!isCurrentCommunity()) return;
      this.chatRoomId.set(chatRoom.id);
      await this.loadChatRoom(chatRoom.id, community, isCurrentCommunity);
    } catch (err) {
      if (!isCurrentCommunity()) return;
      console.error('Failed to create chat room:', err);
      this.error.set('Failed to create chat room');
    }
  }

  isOwnerOrManager(): boolean {
    return this.isOwner();
  }
}
