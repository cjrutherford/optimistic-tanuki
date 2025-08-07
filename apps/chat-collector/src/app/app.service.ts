import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation, Message } from './entities';
import { Any, Repository } from 'typeorm';
import { ChatMessage } from '@optimistic-tanuki/models';

/**
 * Service for handling chat-related business logic.
 */
@Injectable()
export class AppService {
  /**
   * Creates an instance of AppService.
   * @param messageRepository The repository for chat messages.
   * @param conversationRepository The repository for chat conversations.
   */
  constructor(
    @Inject(getRepositoryToken(Message)) private readonly messageRepository: Repository<Message>,
    @Inject(getRepositoryToken(Conversation)) private readonly conversationRepository: Repository<Conversation>,
  ) {}

  /**
   * Posts a new chat message.
   * @param data The chat message data.
   * @returns The created message.
   */
  async postMessage(data: ChatMessage): Promise<Message> {
    const message = this.messageRepository.create({...data, type: Message[data.type]});
    await this.messageRepository.save(message);

    let conversation = await this.conversationRepository.findOne({ where: { id: data.conversationId } });
    if (!conversation) {
      conversation = this.conversationRepository.create({
        id: data.conversationId,
        participants: [data.senderId, ...data.recipientId],
        messages: [message],
      });
    } else {
      conversation.messages.push(message);
      conversation.updatedAt = new Date();
    }
    await this.conversationRepository.save(conversation);

    return message;
  }

  /**
   * Retrieves chat conversations for a given profile.
   * @param profileId The ID of the profile.
   * @returns An array of chat conversations.
   */
  async getConversations(profileId: string): Promise<Conversation[]> {
    return this.conversationRepository.find({ where: { participants: Any([profileId]) } });
  }
}
