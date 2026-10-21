import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Conversation,
  ConversationType,
  Message,
  MessageType,
} from './entities';
import { Any, ArrayContains, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ChatMessage } from '@optimistic-tanuki/chat-contracts';
import { DeleteOwnedCommunityConversationDto } from '@optimistic-tanuki/chat-contracts';
import {
  ServiceTokens,
  CommunityCommands,
  PrivacyCommands,
  ProjectCommands,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class AppService {
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(Message))
    private readonly messageRepository: Repository<Message>,
    @Inject(getRepositoryToken(Conversation))
    private readonly conversationRepository: Repository<Conversation>,
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy,
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectClient: ClientProxy
  ) {}

  async postMessage(data: ChatMessage): Promise<Conversation> {
    const conversation = await this.assertInConversation(
      data.conversationId,
      data.senderId
    );
    const recipientIds = (
      await this.participants(conversation, data.senderId)
    ).filter((id) => id !== data.senderId);
    await this.assertUnblocked(conversation, data.senderId, recipientIds);
    if (data.id) {
      const existing = await this.messageRepository.findOne({
        where: { id: data.id },
        relations: ['conversation'],
      });
      if (existing) {
        if (
          existing.conversation.id !== conversation.id ||
          existing.senderId !== data.senderId ||
          existing.content !== data.content
        )
          throw new RpcException({
            statusCode: 409,
            message: 'Message ID already used',
          });
        conversation.messages = await this.getMessages(
          conversation.id,
          data.senderId
        );
        return conversation;
      }
    }

    const newMessage: Partial<Message> = {
      ...(data.id ? { id: data.id } : {}),
      senderId: data.senderId,
      recipients: recipientIds,
      content: data.content,
      type: MessageType[data.type.toUpperCase() as keyof typeof MessageType],
      conversation,
    };
    this.l.log('Posting new message:', JSON.stringify(newMessage));
    const message = this.messageRepository.create(newMessage);
    this.l.debug('Created message entity:', JSON.stringify(message));
    try {
      await this.messageRepository.save(message);
    } catch (error) {
      if (!data.id || (error as { code?: string })?.code !== '23505') {
        throw error;
      }

      // Two retries can both miss the initial lookup. If the unique message ID
      // wins elsewhere, accept only the identical durable message.
      const racedMessage = await this.messageRepository.findOne({
        where: { id: data.id },
        relations: ['conversation'],
      });
      if (!racedMessage) throw error;
      if (
        racedMessage.conversation?.id !== conversation.id ||
        racedMessage.senderId !== data.senderId ||
        racedMessage.content !== data.content
      ) {
        throw new RpcException({
          statusCode: 409,
          message: 'Message ID already used',
        });
      }
      conversation.messages = await this.getMessages(
        conversation.id,
        data.senderId
      );
      return conversation;
    }

    conversation.updatedAt = new Date();
    // Messages own the ManyToOne relation. Saving a stale OneToMany snapshot
    // here can null out messages written concurrently by another socket.
    // Update only the scalar timestamp, then return a fresh history snapshot.
    await this.conversationRepository.update(conversation.id, {
      updatedAt: conversation.updatedAt,
    });
    conversation.messages = await this.getMessages(
      conversation.id,
      data.senderId
    );

    return conversation;
  }

  async postMessageHttp(data: {
    conversationId: string;
    content: string;
    senderId: string;
    recipientIds: string[];
  }): Promise<Message> {
    // Checked against the participants rather than only against existence.
    // This used to accept anybody who had an id, so somebody removed from a
    // project could still write into its conversation.
    const conversation = await this.assertInConversation(
      data.conversationId,
      data.senderId
    );

    const recipientIds = (
      await this.participants(conversation, data.senderId)
    ).filter((id) => id !== data.senderId);
    await this.assertUnblocked(conversation, data.senderId, recipientIds);
    const message = this.messageRepository.create({
      senderId: data.senderId,
      recipients: recipientIds,
      content: data.content,
      type: MessageType.CHAT,
      conversation,
    });
    await this.messageRepository.save(message);

    conversation.updatedAt = new Date();
    await this.conversationRepository.update(conversation.id, {
      updatedAt: conversation.updatedAt,
    });

    return message;
  }

  async getConversations(profileId: string): Promise<Conversation[]> {
    this.l.log(`Retrieving conversations for profile ID: ${profileId}`);
    const communityIds = await firstValueFrom(
      this.socialClient
        .send({ cmd: CommunityCommands.GET_CHAT_MEMBERSHIPS }, { profileId })
        .pipe(timeout(5000))
    );
    const conversations = await this.conversationRepository.find({
      where: [
        { participants: ArrayContains([profileId]), isDeleted: false },
        {
          type: ConversationType.COMMUNITY,
          communityId: Any(communityIds),
          isDeleted: false,
        },
      ],
      relations: ['messages'],
      order: { createdAt: 'DESC' },
    });
    const allowed: Conversation[] = [];
    for (const conversation of conversations) {
      try {
        if (
          !(await this.participants(conversation, profileId)).includes(
            profileId
          )
        )
          continue;
      } catch (error) {
        const statusCode =
          error instanceof RpcException
            ? (error.getError() as { statusCode?: number }).statusCode
            : error?.statusCode;
        if ([403, 404].includes(statusCode)) continue;
        throw error;
      }
      conversation.messages = (conversation.messages ?? []).sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      allowed.push(conversation);
    }
    return allowed;
  }

  async getConversationsHttp(profileId: string): Promise<Conversation[]> {
    return this.getConversations(profileId);
  }

  async getConversation(
    conversationId: string,
    requestingProfileId?: string,
    deliverySenderId?: string
  ): Promise<Conversation | null> {
    if (requestingProfileId)
      await this.assertInConversation(conversationId, requestingProfileId);
    if (deliverySenderId && requestingProfileId) {
      const authorized = await this.assertInConversation(
        conversationId,
        deliverySenderId
      );
      await this.assertUnblocked(authorized, deliverySenderId, [
        requestingProfileId,
      ]);
    }
    this.l.log(`Retrieving conversation for ID: ${conversationId}`);
    return this.conversationRepository.findOne({
      where: { id: conversationId, isDeleted: false },
      relations: ['messages'],
    });
  }

  async getPresenceAudience(request: {
    conversationId: string;
    requestingProfileId: string;
    targetProfileIds: string[];
  }) {
    const uuid = (v: unknown): v is string =>
      typeof v === 'string' && isUUID(v, 'all');
    if (
      !request ||
      !uuid(request.conversationId) ||
      !uuid(request.requestingProfileId) ||
      !Array.isArray(request.targetProfileIds) ||
      request.targetProfileIds.length > 100 ||
      request.targetProfileIds.some((id) => !uuid(id))
    )
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid presence audience request',
      });
    const conversationId = request.conversationId.toLowerCase();
    const requestingProfileId = request.requestingProfileId.toLowerCase();
    const targetProfileIds = [
      ...new Set(request.targetProfileIds.map((id) => id.toLowerCase())),
    ];
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, isDeleted: false },
    });
    if (!conversation)
      throw new RpcException({
        statusCode: 403,
        message: 'Presence audience is outside the conversation',
      });
    let members: string[];
    try {
      members = (
        await this.participants(conversation, requestingProfileId)
      ).map((id) => id.toLowerCase());
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        statusCode: 503,
        message: 'Conversation membership unavailable',
      });
    }
    if (
      !members.includes(requestingProfileId) ||
      targetProfileIds.some((id) => !members.includes(id))
    )
      throw new RpcException({
        statusCode: 403,
        message: 'Presence audience is outside the conversation',
      });
    return {
      conversationId,
      requestingProfileId,
      allowedProfileIds: targetProfileIds,
    };
  }

  async getConversationHttp(conversationId: string): Promise<Conversation> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async participants(
    conversation: Conversation,
    requestingProfileId?: string
  ): Promise<string[]> {
    if (conversation.type === ConversationType.PROJECT) {
      if (!requestingProfileId || !conversation.projectId) return [];
      const project = await firstValueFrom(
        this.projectClient
          .send(
            { cmd: ProjectCommands.FIND_ONE },
            {
              id: conversation.projectId,
              requestingUserId: requestingProfileId,
            }
          )
          .pipe(timeout(5000))
      ).catch((error) => {
        throw new RpcException(
          [403, 404].includes(error?.statusCode)
            ? error
            : { statusCode: 503, message: 'Project authorization unavailable' }
        );
      });
      return project
        ? [
            ...new Set<string>(
              [project.owner, ...(project.members ?? [])].filter(Boolean)
            ),
          ]
        : [];
    }
    if (conversation.type !== ConversationType.COMMUNITY)
      return conversation.participants ?? [];
    if (!conversation.communityId) return [];
    const members = await firstValueFrom(
      this.socialClient
        .send(
          { cmd: CommunityCommands.GET_MEMBERS },
          { communityId: conversation.communityId }
        )
        .pipe(timeout(5000))
    );
    return [
      ...new Set<string>(
        (members ?? [])
          .filter((m) => m.status === 'approved')
          .map((m) => m.profileId)
          .filter(Boolean)
      ),
    ];
  }

  private async assertUnblocked(
    conversation: Conversation,
    senderId: string,
    recipients: string[]
  ): Promise<void> {
    if (conversation.type !== ConversationType.DIRECT) return;
    for (const recipient of recipients) {
      for (const [blockerId, blockedId] of [
        [senderId, recipient],
        [recipient, senderId],
      ]) {
        const blocked = await firstValueFrom(
          this.socialClient
            .send(
              { cmd: PrivacyCommands.IS_USER_BLOCKED },
              { blockerId, blockedId }
            )
            .pipe(timeout(5000))
        );
        if (blocked)
          throw new RpcException({
            statusCode: 403,
            message: 'Messaging is unavailable between these profiles',
          });
      }
    }
  }

  /**
   * The history of one conversation.
   *
   * Refused to anybody who is not in it. This used to answer a conversation id
   * with everything in it, so anybody signed in who had an id could read
   * somebody else's conversation, and a member removed from a project kept
   * reading it afterwards. The participant list was only ever used to decide
   * delivery; now it decides reading too.
   *
   * An absent profile id means a trusted internal call, matching how the rest
   * of this workspace scopes: every externally reachable route supplies one.
   */
  async getMessages(
    conversationId: string,
    requestingProfileId?: string
  ): Promise<Message[]> {
    if (requestingProfileId) {
      await this.assertInConversation(conversationId, requestingProfileId);
    }

    return await this.messageRepository.find({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Throws unless the profile is in the conversation.
   *
   * A conversation that cannot be found and one somebody is not in answer
   * identically, so an id cannot be tried until it tells you something.
   */
  private async assertInConversation(
    conversationId: string,
    profileId: string
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, isDeleted: false },
    });

    if (!conversation) {
      // RpcException with an explicit status rather than ForbiddenException.
      // An HttpException does not survive the TCP hop with its status, so the
      // gateway turned a refusal into a 500: an error where a plain no was
      // meant, telling the caller nothing and looking like a fault.
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have access to this conversation',
      });
    }

    if (
      !(await this.participants(conversation, profileId)).includes(profileId)
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'You do not have access to this conversation',
      });
    }

    return conversation;
  }

  async createDirectChat(participantIds: string[]): Promise<Conversation> {
    if (
      participantIds.length !== 2 ||
      new Set(participantIds).size !== 2 ||
      participantIds.some((participantId) => !participantId)
    ) {
      throw new BadRequestException(
        'A direct conversation requires exactly two distinct participants'
      );
    }
    const sortedIds = [...participantIds].sort();

    const existing = await this.conversationRepository.findOne({
      where: {
        type: ConversationType.DIRECT,
        participants: ArrayContains(sortedIds),
        isDeleted: false,
      },
    });

    if (existing) {
      return existing;
    }

    const conversation = this.conversationRepository.create({
      title: 'Direct Chat',
      type: ConversationType.DIRECT,
      participants: sortedIds,
    });
    return await this.conversationRepository.save(conversation);
  }

  async getOrCreateDirectChat(participantIds: string[]): Promise<Conversation> {
    return await this.createDirectChat(participantIds);
  }

  async createCommunityChat(
    communityId: string,
    ownerId: string,
    name?: string
  ): Promise<Conversation> {
    const existing = await this.conversationRepository.findOne({
      where: {
        type: ConversationType.COMMUNITY,
        communityId,
        isDeleted: false,
      },
    });

    if (existing) {
      return existing;
    }

    const conversation = this.conversationRepository.create({
      title: name || 'Community Chat',
      type: ConversationType.COMMUNITY,
      communityId,
      ownerId,
      participants: [],
    });
    return await this.conversationRepository.save(conversation);
  }

  /**
   * The conversation belonging to a project.
   *
   * Participants are written on every call rather than kept in step by events.
   * Who is on a project changes through joining, leaving and being removed,
   * and a conversation that drifts out of step with that is one somebody can
   * still read after they were taken out. Deriving it each time means drift
   * cannot survive a single visit.
   *
   * Whoever asks has already been checked against the project by the caller.
   * This service does not know what a project is and is not the place to
   * decide who may reach one.
   */
  async getOrCreateProjectChat(
    projectId: string,
    ownerId: string,
    participants: string[],
    title?: string
  ): Promise<Conversation> {
    const everyone = [...new Set([ownerId, ...participants].filter(Boolean))];

    const existing = await this.conversationRepository.findOne({
      where: {
        type: ConversationType.PROJECT,
        projectId,
        isDeleted: false,
      },
    });

    if (existing) {
      const changed =
        existing.participants?.length !== everyone.length ||
        !everyone.every((who) => existing.participants?.includes(who));
      if (changed || (title && existing.title !== title)) {
        existing.participants = everyone;
        if (title) existing.title = title;
        return await this.conversationRepository.save(existing);
      }
      return existing;
    }

    const conversation = this.conversationRepository.create({
      title: title || 'Project',
      type: ConversationType.PROJECT,
      projectId,
      ownerId,
      participants: everyone,
    });
    return await this.conversationRepository.save(conversation);
  }

  async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.ownerId && conversation.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the owner can delete this conversation'
      );
    }

    conversation.isDeleted = true;
    await this.conversationRepository.save(conversation);
  }

  async deleteOwnedCommunityConversation(
    data: DeleteOwnedCommunityConversationDto
  ): Promise<{ success: true }> {
    if (
      !data ||
      !isUUID(data.conversationId) ||
      !isUUID(data.communityId) ||
      typeof data.actorProfileId !== 'string' ||
      !data.actorProfileId.trim() ||
      typeof data.appScope !== 'string' ||
      !data.appScope.trim()
    ) {
      throw new RpcException({
        statusCode: 400,
        message:
          'A valid conversation, community, actor, and app scope are required',
      });
    }

    const conversation = await this.conversationRepository.findOne({
      where: { id: data.conversationId },
    });
    if (!conversation || conversation.isDeleted) {
      throw new RpcException({
        statusCode: 404,
        message: 'Conversation not found',
      });
    }
    if (
      conversation.type !== ConversationType.COMMUNITY ||
      conversation.communityId !== data.communityId ||
      !conversation.ownerId ||
      conversation.ownerId !== data.actorProfileId
    ) {
      throw new RpcException({
        statusCode: 403,
        message:
          'Only the current owner can clean up this community conversation',
      });
    }

    const community = await this.requestCommunityAuthorization<{
      id?: string;
      ownerProfileId?: string;
      appScope?: string;
    }>(
      { cmd: CommunityCommands.FIND },
      { id: data.communityId },
      'Community authorization unavailable'
    );
    if (!community || community.id !== data.communityId) {
      throw new RpcException({
        statusCode: 404,
        message: 'Community not found',
      });
    }
    if (
      community.ownerProfileId !== data.actorProfileId ||
      community.appScope !== data.appScope
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'Community owner or application scope does not match',
      });
    }

    const members = await this.requestCommunityAuthorization<
      Array<{ profileId?: string; role?: string; status?: string }>
    >(
      { cmd: CommunityCommands.GET_MEMBERS },
      { communityId: data.communityId },
      'Community membership authorization unavailable'
    );
    const currentOwner = Array.isArray(members)
      ? members.some(
          (member) =>
            member?.profileId === data.actorProfileId &&
            member?.role === 'owner' &&
            member?.status === 'approved'
        )
      : false;
    if (!currentOwner) {
      throw new RpcException({
        statusCode: 403,
        message: 'Current approved community ownership is required',
      });
    }

    const result = await this.conversationRepository.update(
      {
        id: data.conversationId,
        isDeleted: false,
        type: ConversationType.COMMUNITY,
        communityId: data.communityId,
        ownerId: data.actorProfileId,
      },
      { isDeleted: true }
    );
    if (result.affected !== 1) {
      throw new RpcException({
        statusCode: 404,
        message: 'Conversation is no longer available for cleanup',
      });
    }

    return { success: true };
  }

  private async requestCommunityAuthorization<T>(
    pattern: { cmd: string },
    payload: Record<string, string>,
    unavailableMessage: string
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.socialClient.send(pattern, payload).pipe(timeout(5000))
      );
    } catch (error) {
      const transportError =
        error instanceof RpcException ? error.getError() : error;
      const response =
        typeof transportError === 'object' && transportError !== null
          ? (transportError as Record<string, unknown>)
          : {};
      const statusCode = Number(response.statusCode ?? response.status);
      if ([400, 401, 403, 404].includes(statusCode)) {
        throw new RpcException({
          statusCode,
          message:
            typeof response.message === 'string'
              ? response.message
              : unavailableMessage,
        });
      }
      throw new RpcException({ statusCode: 503, message: unavailableMessage });
    }
  }
}
