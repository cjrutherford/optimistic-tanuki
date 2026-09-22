import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  CommunityMemberDto,
  JoinCommunityDto,
  InviteToCommunityDto,
  CommunityInviteDto,
} from '../models/index';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/chat-ui-data-access';
import { OptomisitcTanukiAPIService as SocialAPIService } from '@optimistic-tanuki/social-data-access';
import { OptomisitcTanukiAPIService as ProfileAPIService } from '@optimistic-tanuki/profile-ui-data-access';

type ChatMessageType = 'chat' | 'info' | 'warning' | 'system';

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private readonly chat = inject(OptomisitcTanukiAPIService);
  private readonly social = inject(SocialAPIService);
  private readonly profiles = inject(ProfileAPIService);

  create(dto: CreateCommunityDto): Promise<CommunityDto> {
    // createChatRoom is contract-required but unread server-side (chat rooms
    // provision unconditionally); always send true, exactly as before.
    // parentId nulls become absent, exactly as JSON serialization did.
    const { parentId, ...rest } = dto;
    return firstValueFrom(
      this.social.communityControllerCreateCommunity({
        ...rest,
        parentId: parentId ?? undefined,
        createChatRoom: true,
      })
    );
  }

  findOne(id: string): Promise<CommunityDto | null> {
    return firstValueFrom(
      this.social.communityControllerGetCommunity(id)
    ) as Promise<CommunityDto | null>;
  }

  findBySlug(slug: string): Promise<CommunityDto | null> {
    return firstValueFrom(
      this.social.communityControllerGetCommunityBySlug(slug)
    ) as Promise<CommunityDto | null>;
  }

  findAll(searchDto: SearchCommunityDto): Promise<CommunityDto[]> {
    return firstValueFrom(
      this.social.communityControllerSearchCommunities(searchDto)
    );
  }

  update(id: string, dto: UpdateCommunityDto): Promise<CommunityDto> {
    // Nulls become absent, exactly as JSON serialization did.
    const { parentId, imageUrl, ...rest } = dto;
    return firstValueFrom(
      this.social.communityControllerUpdateCommunity(id, {
        ...rest,
        parentId: parentId ?? undefined,
        imageUrl: imageUrl ?? undefined,
      })
    );
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(
      this.social.communityControllerDeleteCommunity(id)
    ) as Promise<void>;
  }

  join(
    communityId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dto: JoinCommunityDto
  ): Promise<CommunityMemberDto> {
    // The gateway join reads the member from the session; the body was
    // never consumed, so it no longer travels.
    return firstValueFrom(
      this.social.communityControllerJoinCommunity(communityId)
    );
  }

  leave(communityId: string): Promise<void> {
    return firstValueFrom(
      this.social.communityControllerLeaveCommunity(communityId)
    ) as Promise<void>;
  }

  getMembers(communityId: string): Promise<CommunityMemberDto[]> {
    return firstValueFrom(
      this.social.communityControllerGetMembers(communityId)
    );
  }

  getUserCommunities(): Promise<CommunityDto[]> {
    return firstValueFrom(this.social.communityControllerGetUserCommunities());
  }

  invite(dto: InviteToCommunityDto): Promise<CommunityInviteDto> {
    return firstValueFrom(
      this.social.communityControllerInviteUser(dto.communityId, {
        inviteeUserId: dto.inviteeUserId,
      })
    );
  }

  cancelInvite(inviteId: string): Promise<void> {
    return firstValueFrom(
      this.social.communityControllerCancelInvite(inviteId)
    ) as Promise<void>;
  }

  getPendingInvites(communityId: string): Promise<CommunityInviteDto[]> {
    return firstValueFrom(
      this.social.communityControllerGetPendingInvites(communityId)
    );
  }

  getPendingJoinRequests(communityId: string): Promise<CommunityMemberDto[]> {
    return firstValueFrom(
      this.social.communityControllerGetPendingJoinRequests(communityId)
    );
  }

  approveMember(memberId: string): Promise<CommunityMemberDto> {
    return firstValueFrom(
      this.social.communityControllerApproveMember(memberId)
    );
  }

  rejectMember(memberId: string): Promise<void> {
    return firstValueFrom(
      this.social.communityControllerRejectMember(memberId)
    ) as Promise<void>;
  }

  removeMember(
    memberId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    payload?: { profileId?: string; communityId?: string }
  ): Promise<void> {
    // The gateway remove reads the remover from the session; the payload
    // was never consumed, so it no longer travels.
    return firstValueFrom(
      this.social.communityControllerRemoveMember(memberId)
    ) as Promise<void>;
  }

  getTopActive(limit = 10, appScope = 'social'): Promise<CommunityDto[]> {
    return firstValueFrom(
      this.social.communityControllerGetTopActiveCommunities({
        limit,
        appScope,
      })
    );
  }

  getProfile(profileId: string): Promise<any> {
    return firstValueFrom(
      this.profiles.profileControllerGetProfileById(profileId)
    ) as Promise<any>;
  }

  getProfilesByIds(profileIds: string[]): Promise<any[]> {
    return firstValueFrom(
      this.profiles.profileControllerGetProfilesByIds({ ids: profileIds })
    ) as Promise<any[]>;
  }

  getCommunityPosts(communityId: string): Promise<any[]> {
    return firstValueFrom(
      this.social.socialControllerSearchPosts({
        criteria: { communityId },
        opts: { orderBy: 'createdAt', orderDirection: 'desc', limit: 50 },
      })
    ) as Promise<any[]>;
  }

  getCommunityChatRoom(communityId: string): Promise<{ id: string } | null> {
    return firstValueFrom(
      this.social.communityControllerGetChatRoom(communityId)
    ) as Promise<{ id: string } | null>;
  }

  getCommunityChatConversation(conversationId: string): Promise<{
    id: string;
    participants: string[];
    createdAt: Date;
    updatedAt: Date;
  }> {
    return firstValueFrom(
      this.chat.chatControllerGetConversation(conversationId)
    ).then(
      (conversation) =>
        ({
          id: conversation.id ?? conversationId,
          participants: conversation.participants,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        } as unknown as {
          id: string;
          participants: string[];
          createdAt: Date;
          updatedAt: Date;
        })
    );
  }

  getCommunityChatMessages(conversationId: string): Promise<
    Array<{
      id: string;
      conversationId: string;
      senderId: string;
      content: string;
      type: 'chat' | 'info' | 'warning' | 'system';
      recipients: string[];
      createdAt: Date;
    }>
  > {
    return firstValueFrom(
      this.chat.chatControllerGetMessages(conversationId)
    ).then((messages) =>
      messages.map(
        (message) =>
          ({
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            type: message.type as ChatMessageType,
            // Wire shape carries `recipients` (entity field); the contracts
            // DTO names it `recipientIds`. Prefer the wire field, as before.
            recipients:
              (message as unknown as { recipients?: string[] }).recipients ??
              message.recipientIds ??
              [],
            createdAt: message.createdAt,
          } as unknown as {
            id: string;
            conversationId: string;
            senderId: string;
            content: string;
            type: 'chat' | 'info' | 'warning' | 'system';
            recipients: string[];
            createdAt: Date;
          })
      )
    );
  }

  sendCommunityChatMessage(payload: {
    conversationId: string;
    content: string;
    senderId: string;
    recipientIds: string[];
  }): Promise<{
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: 'chat' | 'info' | 'warning' | 'system';
    recipients: string[];
    createdAt: Date;
  }> {
    // The gateway binds senderId from the session and overwrites any client
    // value, so only the SendMessageDto fields travel now (previously the
    // caller-supplied senderId rode along unused).
    const { senderId: _senderId, ...body } = payload;
    return firstValueFrom(this.chat.chatControllerSendMessage(body)).then(
      (message) =>
        ({
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          type: message.type as ChatMessageType,
          recipients:
            (message as unknown as { recipients?: string[] }).recipients ??
            message.recipientIds ??
            [],
          createdAt: message.createdAt,
        } as unknown as {
          id: string;
          conversationId: string;
          senderId: string;
          content: string;
          type: 'chat' | 'info' | 'warning' | 'system';
          recipients: string[];
          createdAt: Date;
        })
    );
  }

  ensureCommunityChatRoom(
    communityId: string,
    ownerId: string,
    name: string
  ): Promise<{ id: string }> {
    return firstValueFrom(
      this.social.communityControllerEnsureChatRoom(communityId, {
        ownerId,
        name,
      })
    ) as Promise<{ id: string }>;
  }

  createPost(postData: {
    title: string;
    content: string;
    profileId: string;
    communityId: string;
    attachmentIds?: string[];
  }): Promise<any> {
    return firstValueFrom(
      this.social.socialControllerPost(postData)
    ) as Promise<any>;
  }

  getCurrentUserProfile(): Promise<any> {
    return firstValueFrom(
      this.profiles.profileControllerGetCurrentProfile()
    ) as Promise<any>;
  }

  appointManager(communityId: string, profileId: string): Promise<void> {
    return firstValueFrom(
      this.social.communityControllerAppointManager(communityId, { profileId })
    ) as Promise<void>;
  }

  revokeManager(communityId: string, profileId: string): Promise<void> {
    return firstValueFrom(
      this.social.communityControllerRevokeManager(communityId, profileId)
    ) as Promise<void>;
  }
}
