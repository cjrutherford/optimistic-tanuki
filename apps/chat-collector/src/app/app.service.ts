import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
    const newMessage: Partial<Message> = {
      id: data.id,
      senderId: data.senderId,
      recipients: data.recipientId,
      content: data.content,
      type: MessageType[data.type.toUpperCase() as keyof typeof MessageType],
    };
    this.l.log('Posting new message:', JSON.stringify(newMessage));
    const message = this.messageRepository.create(newMessage);
    this.l.debug('Created message entity:', JSON.stringify(message));
    await this.messageRepository.save(message);
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
        title: [data.recipientName, ...data.recipientName].join(', '),
        participants: [data.senderId, ...data.recipientId],
        messages: [message],
        updatedAt: new Date(),
      });
    } else {
      conversation.messages.push(message);
      conversation.updatedAt = new Date();
    }
    await this.conversationRepository.save(conversation);

    return conversation;
  }

  async postMessageHttp(data: {
    conversationId: string;
    content: string;
    senderId: string;
    recipientIds: string[];
  }): Promise<Message> {
    const message = this.messageRepository.create({
      senderId: data.senderId,
      recipients: data.recipientIds,
      content: data.content,
      type: MessageType.CHAT,
    });
    await this.messageRepository.save(message);

    const conversation = await this.conversationRepository.findOne({
      where: { id: data.conversationId },
    });
    if (conversation) {
      conversation.updatedAt = new Date();
      await this.conversationRepository.save(conversation);
    }

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

  async getMessages(conversationId: string): Promise<Message[]> {
    return await this.messageRepository.find({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'ASC' },
    });
  }

  async createDirectChat(participantIds: string[]): Promise<Conversation> {
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
