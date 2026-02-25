import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  ChatUiComponent,
  ChatContact,
  ChatConversation,
} from '@optimistic-tanuki/chat-ui';
import { CommunityService } from '../services/community.service';
import { CommunityDto } from '../models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface ChatConversationResponse {
  id: string;
  title: string;
  type: string;
  communityId?: string;
  ownerId?: string;
  participants: string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
export class CommunityChatComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private communityService = inject(CommunityService);
  private http = inject(HttpClient);

  community = signal<CommunityDto | null>(null);
  chatRoomId = signal<string | null>(null);
  chatContacts = signal<ChatContact[]>([]);
  chatConversations = signal<ChatConversation[]>([]);

  loading = signal(true);
  error = signal<string | null>(null);

  currentUserId = '';
  isOwner = signal(false);

  async ngOnInit() {
    this.route.data.subscribe((data: any) => {
      this.currentUserId = data['currentUserId'] || '';
    });

    const communityId = this.route.snapshot.paramMap.get('communityId');
    if (!communityId) {
      this.loadUserCommunitiesChat();
      return;
    }

    await this.loadCommunity(communityId);
    this.loading.set(false);
  }

  private async loadCommunity(communityId: string) {
    try {
      const community = await this.communityService.findOne(communityId);
      if (!community) {
        this.error.set('Community not found');
        return;
      }

      this.community.set(community);
      this.isOwner.set(community.ownerId === this.currentUserId);

      const chatRoom = await this.communityService.getCommunityChatRoom(
        communityId
      );
      if (chatRoom) {
        this.chatRoomId.set(chatRoom.id);
        await this.loadChatRoom(chatRoom.id, community);
      }
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

        const chatRoom = await this.communityService.getCommunityChatRoom(
          community.id
        );
        if (chatRoom) {
          this.chatRoomId.set(chatRoom.id);
          await this.loadChatRoom(chatRoom.id, community);
        }
      }
      this.loading.set(false);
    } catch (err) {
      console.error('Failed to load communities:', err);
      this.loading.set(false);
    }
  }

  private async loadChatRoom(conversationId: string, community: CommunityDto) {
    try {
      const conversation = await firstValueFrom(
        this.http.get<ChatConversationResponse>(
          `/api/chat/conversations/id/${conversationId}`
        )
      );

      this.chatContacts.set([
        {
          id: conversation.id,
          name: community.name,
          profilePic: community.logoUrl,
        },
      ]);

      this.chatConversations.set([
        {
          id: conversation.id,
          participants: conversation.participants,
          messages: [],
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
        },
      ]);
    } catch (err) {
      console.error('Failed to load chat room:', err);
    }
  }

  async createChatRoom() {
    const community = this.community();
    if (!community) return;

    try {
      const chatRoom = await firstValueFrom(
        this.http.post<{ id: string }>(`/api/chat/conversations/community`, {
          communityId: community.id,
          ownerId: this.currentUserId,
          name: community.name,
        })
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
