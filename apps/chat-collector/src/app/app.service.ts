import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Conversation,
  ConversationType,
  Message,
  MessageType,
} from './entities';
import { Any, ArrayContains, Repository, IsNull } from 'typeorm';
import { ChatMessage } from '@optimistic-tanuki/models';

@Injectable()
export class AppService {
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(Message))
    private readonly messageRepository: Repository<Message>,
    @Inject(getRepositoryToken(Conversation))
    private readonly conversationRepository: Repository<Conversation>
  ) {}

  async postMessage(data: ChatMessage): Promise<Conversation> {
    let conversation: Conversation | null = null;
    if (data.conversationId && data.conversationId !== '') {
      try {
        conversation = await this.conversationRepository.findOne({
          where: { id: data.conversationId },
          relations: ['messages'],
        });
      } catch (_) {
        conversation = null;
      }
    }
    if (!conversation) {
      conversation = this.conversationRepository.create({
        id: data.conversationId || uuidv4(),
        title: data.recipientName.join(', '),
        participants: [data.senderId, ...data.recipientId],
        messages: [],
        updatedAt: new Date(),
      });
      await this.conversationRepository.save(conversation);
    }

    const newMessage: Partial<Message> = {
      ...(data.id ? { id: data.id } : {}),
      senderId: data.senderId,
      recipients: data.recipientId,
      content: data.content,
      type: MessageType[data.type.toUpperCase() as keyof typeof MessageType],
      conversation,
    };
    this.l.log('Posting new message:', JSON.stringify(newMessage));
    const message = this.messageRepository.create(newMessage);
    this.l.debug('Created message entity:', JSON.stringify(message));
    await this.messageRepository.save(message);

    conversation.messages = [...(conversation.messages || []), message];
    conversation.updatedAt = new Date();
    await this.conversationRepository.save(conversation);

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

    const message = this.messageRepository.create({
      senderId: data.senderId,
      recipients: data.recipientIds,
      content: data.content,
      type: MessageType.CHAT,
      conversation,
    });
    await this.messageRepository.save(message);

    conversation.updatedAt = new Date();
    await this.conversationRepository.save(conversation);

    return message;
  }

  async getConversations(profileId: string): Promise<Conversation[]> {
    this.l.log(`Retrieving conversations for profile ID: ${profileId}`);
    const conversations = await this.conversationRepository.find({
      where: {
        participants: ArrayContains([profileId]),
      },
      relations: ['messages'],
      order: { createdAt: 'DESC' },
    });
    this.l.log(
      `Found ${conversations.length} conversations for profile ID: ${profileId}`
    );
    const updatedConversations = conversations.map((conversation) => {
      conversation.messages = conversation.messages.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      return conversation;
    });
    this.l.log(
      `Sorted messages in each conversation for profile ID: ${profileId}`
    );
    this.l.log(JSON.stringify(updatedConversations, null, 2));
    return updatedConversations;
  }

  async getConversationsHttp(profileId: string): Promise<Conversation[]> {
    const conversations = await this.conversationRepository.find({
      where: {
        participants: ArrayContains([profileId]),
        isDeleted: false,
      },
      order: { updatedAt: 'DESC' },
    });
    return conversations;
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    this.l.log(`Retrieving conversation for ID: ${conversationId}`);
    return await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['messages'],
    });
  }

  async getConversationHttp(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, isDeleted: false },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
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

    // Community conversations are created with an empty participant list and
    // nothing ever fills it: ADD_TO_COMMUNITY_CHAT is declared as a command
    // and has no implementation and no caller. Asking who is in one is a
    // question with no answer, so checking would refuse everybody and break a
    // feature rather than protect it. Direct and project conversations both
    // know their participants and are checked.
    //
    // This is a gap and is written down as one. Closing it means building the
    // membership that community chat never got, which is its own work.
    if (conversation.type === ConversationType.COMMUNITY) {
      return conversation;
    }

    if (!(conversation.participants ?? []).includes(profileId)) {
      // RpcException with an explicit status rather than ForbiddenException.
      // An HttpException does not survive the TCP hop with its status, so the
      // gateway turned a refusal into a 500: an error where a plain no was
      // meant, telling the caller nothing and looking like a fault.
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
}
