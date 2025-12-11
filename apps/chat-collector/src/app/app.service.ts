import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Conversation, Message, MessageType } from './entities';
import { Any, ArrayContains, Repository } from 'typeorm';
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

    let conversation = await this.conversationRepository.findOne({
      where: { id: data.conversationId },
      relations: ['messages'],
    });
    if (!conversation) {
      conversation = this.conversationRepository.create({
        id: data.conversationId,
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

  async getConversation(conversationId: string): Promise<Conversation | null> {
    this.l.log(`Retrieving conversation for ID: ${conversationId}`);
    return await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['messages'],
    });
  }
}
