import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, Message, MessageType } from './entities';
import { ChatMessage } from '@optimistic-tanuki/models';
import { Logger } from '@nestjs/common';

// Mock uuidv4
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

describe('AppService', () => {
  let service: AppService;
  let messageRepository: Repository<Message>;
  let conversationRepository: Repository<Conversation>;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: getRepositoryToken(Message),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Conversation),
          useClass: Repository,
        },
        {
          provide: Logger,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    messageRepository = module.get<Repository<Message>>(getRepositoryToken(Message));
    conversationRepository = module.get<Repository<Conversation>>(getRepositoryToken(Conversation));
    logger = module.get<Logger>(Logger);

    // Mock repository methods
    jest.spyOn(messageRepository, 'create').mockImplementation((entity) => entity as Message);
    jest.spyOn(messageRepository, 'save').mockImplementation(async (entity) => entity as Message);
    jest.spyOn(conversationRepository, 'create').mockImplementation((entity) => Object.assign(new Conversation(), entity));
    jest.spyOn(conversationRepository, 'save').mockImplementation(async (entity) => entity as Conversation);
  });

  describe('postMessage', () => {
    const mockChatMessage: ChatMessage = {
      id: 'test-message-id',
      conversationId: 'test-conversation-id',
      senderId: 'user1',
      senderName: 'User One',
      recipientId: ['user2'],
      recipientName: ['User Two'],
      content: 'Hello',
      timestamp: new Date(),
      type: MessageType.CHAT,
    };

    it('should create a new conversation if one does not exist', async () => {
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(null);

      const result = await service.postMessage(mockChatMessage);

      expect(messageRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-message-id',
        senderId: 'user1',
        recipients: ['user2'],
        content: 'Hello',
        type: MessageType.CHAT,
      }));
      expect(messageRepository.save).toHaveBeenCalled();
      expect(conversationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-conversation-id',
        title: 'User Two, User Two',
        participants: ['user1', 'user2'],
        messages: expect.any(Array),
        updatedAt: expect.any(Date),
      }));
      expect(conversationRepository.save).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Conversation);
    });

    it('should update an existing conversation', async () => {
      const existingConversation = new Conversation();
      existingConversation.id = 'existing-conv-id';
      existingConversation.messages = [];
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(existingConversation);

      const chatMessageWithConvId = { ...mockChatMessage, conversationId: 'existing-conv-id' };
      const result = await service.postMessage(chatMessageWithConvId);

      expect(messageRepository.create).toHaveBeenCalled();
      expect(messageRepository.save).toHaveBeenCalled();
      expect(conversationRepository.create).not.toHaveBeenCalled();
      expect(conversationRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        id: 'existing-conv-id',
        messages: expect.any(Array),
        updatedAt: expect.any(Date),
      }));
      expect(result).toBeInstanceOf(Conversation);
    });
  });

  describe('getConversations', () => {
    it('should return conversations for a given profileId', async () => {
      const profileId = 'user1';
      const mockConversations = [
        {
          id: 'conv1',
          participants: ['user1', 'user2'],
          messages: [
            { createdAt: new Date('2023-01-02') },
            { createdAt: new Date('2023-01-01') },
          ],
        },
      ];
      jest.spyOn(conversationRepository, 'find').mockResolvedValue(mockConversations as any);

      const result = await service.getConversations(profileId);

      expect(logger.log).toHaveBeenCalledWith(`Retrieving conversations for profile ID: ${profileId}`);
      expect(conversationRepository.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { participants: expect.anything() },
        relations: ['messages'],
        order: { createdAt: 'DESC' },
      }));
      expect(result[0].messages[0].createdAt.getTime()).toBe(new Date('2023-01-01').getTime()); // Check sorting
    });
  });

  describe('getConversation', () => {
    it('should return a single conversation by ID', async () => {
      const conversationId = 'conv1';
      const mockConversation = { id: conversationId, participants: [], messages: [] };
      jest.spyOn(conversationRepository, 'findOne').mockResolvedValue(mockConversation as any);

      const result = await service.getConversation(conversationId);

      expect(logger.log).toHaveBeenCalledWith(`Retrieving conversation for ID: ${conversationId}`);
      expect(conversationRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: conversationId },
        relations: ['messages'],
      }));
      expect(result).toEqual(mockConversation);
    });
  });
});
