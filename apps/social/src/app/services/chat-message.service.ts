import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, MessageType } from '../../entities/chat-message.entity';

export interface CreateMessageData {
  conversationId: string;
  senderId: string;
  content: string;
  type?: MessageType;
}

export interface AddReactionData {
  messageId: string;
  emoji: string;
  userId: string;
}

@Injectable()
export class ChatMessageService {
  constructor(
    @Inject(getRepositoryToken(ChatMessage))
    private readonly messageRepo: Repository<ChatMessage>
  ) {}

  async create(data: CreateMessageData): Promise<ChatMessage> {
    const message = this.messageRepo.create(data);
    return await this.messageRepo.save(message);
  }

  async findByConversation(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ChatMessage[]> {
    return await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string): Promise<ChatMessage | null> {
    return await this.messageRepo.findOne({ where: { id } });
  }

  async addReaction(data: AddReactionData): Promise<ChatMessage> {
    const message = await this.findOne(data.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const reactions = message.reactions || [];
    const existingReaction = reactions.find(
      (r) => r.emoji === data.emoji && r.userId === data.userId
    );

    if (existingReaction) {
      throw new Error('Reaction already exists');
    }

    reactions.push({ emoji: data.emoji, userId: data.userId });
    message.reactions = reactions;

    return await this.messageRepo.save(message);
  }

  async removeReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<ChatMessage> {
    const message = await this.findOne(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const reactions = message.reactions || [];
    message.reactions = reactions.filter(
      (r) => !(r.emoji === emoji && r.userId === userId)
    );

    return await this.messageRepo.save(message);
  }

  async toggleReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<ChatMessage> {
    const message = await this.findOne(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const reactions = message.reactions || [];
    const existingIndex = reactions.findIndex(
      (r) => r.emoji === emoji && r.userId === userId
    );

    if (existingIndex >= 0) {
      reactions.splice(existingIndex, 1);
    } else {
      reactions.push({ emoji, userId });
    }

    message.reactions = reactions;
    return await this.messageRepo.save(message);
  }

  async markAsRead(messageId: string, userId: string): Promise<ChatMessage> {
    const message = await this.findOne(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const readBy = message.readBy || [];
    if (!readBy.includes(userId)) {
      readBy.push(userId);
      message.readBy = readBy;
    }

    return await this.messageRepo.save(message);
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const messages = await this.messageRepo.find({
      where: { conversationId },
    });

    for (const message of messages) {
      if (message.senderId !== userId) {
        const readBy = message.readBy || [];
        if (!readBy.includes(userId)) {
          readBy.push(userId);
          message.readBy = readBy;
          await this.messageRepo.save(message);
        }
      }
    }
  }

  async editMessage(messageId: string, content: string): Promise<ChatMessage> {
    const message = await this.findOne(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    message.content = content;
    message.isEdited = true;

    return await this.messageRepo.save(message);
  }

  async deleteMessage(messageId: string): Promise<void> {
    const message = await this.findOne(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    message.isDeleted = true;
    message.content = '[deleted]';

    await this.messageRepo.save(message);
  }

  async getUnreadCount(
    conversationId: string,
    userId: string
  ): Promise<number> {
    const messages = await this.messageRepo.find({
      where: { conversationId, senderId: undefined },
    });

    return messages.filter((m) => {
      const readBy = m.readBy || [];
      return !readBy.includes(userId);
    }).length;
  }
}
