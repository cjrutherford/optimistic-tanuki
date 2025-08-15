import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation, Message } from './entities';
import { Any, ArrayContains, Repository } from 'typeorm';
import { ChatMessage } from '@optimistic-tanuki/models';

@Injectable()
export class AppService {
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(Message)) private readonly messageRepository: Repository<Message>,
    @Inject(getRepositoryToken(Conversation)) private readonly conversationRepository: Repository<Conversation>,
  ) {}

  async postMessage(data: ChatMessage): Promise<Message> {
    if(!data.id) {
      data.id = uuidv4();
    }
    if(!data.conversationId) {
      data.conversationId = uuidv4();
    }
    const newMessage: Partial<Message> = {
      id: data.id,
      senderId: data.senderId,
      recipients: data.recipientId,
      content: data.content,
      type: Message[data.type]
    };
    const message = this.messageRepository.create(newMessage);
    await this.messageRepository.save(message);

    let conversation = await this.conversationRepository.findOne({ where: { id: data.conversationId } });
    if (!conversation) {
      conversation = this.conversationRepository.create({
        id: data.conversationId,
        title: [data.recipientName, ...data.recipientName].join(', '),
        participants: [data.senderId, ...data.recipientId],
        messages: [message],
        updatedAt: new Date()
      });
    } else {
      conversation.messages.push(message);
      conversation.updatedAt = new Date();
    }
    await this.conversationRepository.save(conversation);

    return message;
  }
  
  async getConversations(profileId: string): Promise<Conversation[]> {
    this.l.log(`Retrieving conversations for profile ID: ${profileId}`);
    const conversations = await this.conversationRepository.find({ where: { participants: ArrayContains([profileId]) }, relations: ['messages'] });
    this.l.log(`Found ${conversations.length} conversations for profile ID: ${profileId}`);
    return conversations;
  }
}
