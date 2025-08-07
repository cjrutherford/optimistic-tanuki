import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation, Message } from './entities';
import { Any, Repository } from 'typeorm';
import { ChatMessage } from '@optimistic-tanuki/models';

@Injectable()
export class AppService {
  constructor(
    @Inject(getRepositoryToken(Message)) private readonly messageRepository: Repository<Message>,
    @Inject(getRepositoryToken(Conversation)) private readonly conversationRepository: Repository<Conversation>,
  ) {}

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

  async getConversations(profileId: string): Promise<Conversation[]> {
    return this.conversationRepository.find({ where: { participants: Any([profileId]) } });
  }
}
