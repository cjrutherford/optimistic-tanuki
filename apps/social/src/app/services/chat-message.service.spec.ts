import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageService, CreateMessageData, AddReactionData } from './chat-message.service';
import { ChatMessage, MessageType } from '../../entities/chat-message.entity';

describe('ChatMessageService', () => {
  let service: ChatMessageService;
  let messageRepo: Repository<ChatMessage>;

  const mockChatMessage: ChatMessage = {
    id: 'msg-123',
    conversationId: 'conv-123',
    senderId: 'user-1',
    content: 'Hello world',
    type: 'text' as MessageType,
    reactions: [],
    readBy: [],
    isEdited: false,
    isDeleted: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as ChatMessage;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatMessageService,
        {
          provide: getRepositoryToken(ChatMessage),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatMessageService>(ChatMessageService);
    messageRepo = module.get<Repository<ChatMessage>>(
      getRepositoryToken(ChatMessage)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new message', async () => {
      const createData: CreateMessageData = {
        conversationId: 'conv-123',
        senderId: 'user-1',
        content: 'Hello world',
        type: 'text' as MessageType,
      };

      jest.spyOn(messageRepo, 'create').mockReturnValue(mockChatMessage);
      jest.spyOn(messageRepo, 'save').mockResolvedValue(mockChatMessage);

      const result = await service.create(createData);

      expect(messageRepo.create).toHaveBeenCalledWith(createData);
      expect(messageRepo.save).toHaveBeenCalledWith(mockChatMessage);
      expect(result).toEqual(mockChatMessage);
    });

    it('should create message without type (defaults to text)', async () => {
      const createData: CreateMessageData = {
        conversationId: 'conv-123',
        senderId: 'user-1',
        content: 'Hello',
      };

      jest.spyOn(messageRepo, 'create').mockReturnValue(mockChatMessage);
      jest.spyOn(messageRepo, 'save').mockResolvedValue(mockChatMessage);

      const result = await service.create(createData);

      expect(result).toEqual(mockChatMessage);
    });
  });

  describe('findByConversation', () => {
    it('should find messages by conversation with default pagination', async () => {
      const messages = [mockChatMessage, { ...mockChatMessage, id: 'msg-456' }];
      jest.spyOn(messageRepo, 'find').mockResolvedValue(messages);

      const result = await service.findByConversation('conv-123');

      expect(messageRepo.find).toHaveBeenCalledWith({
        where: { conversationId: 'conv-123' },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(messages);
    });

    it('should find messages with custom pagination', async () => {
      jest.spyOn(messageRepo, 'find').mockResolvedValue([mockChatMessage]);

      const result = await service.findByConversation('conv-123', 20, 10);

      expect(messageRepo.find).toHaveBeenCalledWith({
        where: { conversationId: 'conv-123' },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 10,
      });
      expect(result).toEqual([mockChatMessage]);
    });

    it('should return empty array if no messages found', async () => {
      jest.spyOn(messageRepo, 'find').mockResolvedValue([]);

      const result = await service.findByConversation('conv-123');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should find a message by id', async () => {
      jest.spyOn(messageRepo, 'findOne').mockResolvedValue(mockChatMessage);

      const result = await service.findOne('msg-123');

      expect(messageRepo.findOne).toHaveBeenCalledWith({ where: { id: 'msg-123' } });
      expect(result).toEqual(mockChatMessage);
    });

    it('should return null if message not found', async () => {
      jest.spyOn(messageRepo, 'findOne').mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('addReaction', () => {
    it('should add a reaction to a message', async () => {
      const reactionData: AddReactionData = {
        messageId: 'msg-123',
        emoji: '👍',
        userId: 'user-2',
      };

      const updatedMessage = {
        ...mockChatMessage,
        reactions: [{ emoji: '👍', userId: 'user-2' }],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockChatMessage);
      jest.spyOn(messageRepo, 'save').mockResolvedValue(updatedMessage);

      const result = await service.addReaction(reactionData);

      expect(service.findOne).toHaveBeenCalledWith('msg-123');
      expect(result.reactions).toContainEqual({ emoji: '👍', userId: 'user-2' });
    });

    it('should throw error if message not found', async () => {
      const reactionData: AddReactionData = {
        messageId: 'non-existent',
        emoji: '👍',
        userId: 'user-2',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(service.addReaction(reactionData)).rejects.toThrow('Message not found');
    });

    it('should throw error if reaction already exists', async () => {
      const messageWithReaction = {
        ...mockChatMessage,
        reactions: [{ emoji: '👍', userId: 'user-2' }],
      };

      const reactionData: AddReactionData = {
        messageId: 'msg-123',
        emoji: '👍',
        userId: 'user-2',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(messageWithReaction);

      await expect(service.addReaction(reactionData)).rejects.toThrow('Reaction already exists');
    });
  });

  describe('removeReaction', () => {
    it('should remove a reaction from a message', async () => {
      const messageWithReaction = {
        ...mockChatMessage,
        reactions: [
          { emoji: '👍', userId: 'user-2' },
          { emoji: '❤️', userId: 'user-3' },
        ],
      };

      const updatedMessage = {
        ...messageWithReaction,
        reactions: [{ emoji: '❤️', userId: 'user-3' }],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(messageWithReaction);
      jest.spyOn(messageRepo, 'save').mockResolvedValue(updatedMessage);

      const result = await service.removeReaction('msg-123', '👍', 'user-2');

      expect(result.reactions).toEqual([{ emoji: '❤️', userId: 'user-3' }]);
    });

    it('should throw error if message not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(service.removeReaction('non-existent', '👍', 'user-2')).rejects.toThrow(
        'Message not found'
      );
    });
  });

  describe('toggleReaction', () => {
    it('should add reaction if it does not exist', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockChatMessage);
      jest.spyOn(messageRepo, 'save').mockResolvedValue({
        ...mockChatMessage,
        reactions: [{ emoji: '👍', userId: 'user-2' }],
      });

      const result = await service.toggleReaction('msg-123', '👍', 'user-2');

      expect(result.reactions).toContainEqual({ emoji: '👍', userId: 'user-2' });
    });

    it('should remove reaction if it exists', async () => {
      const messageWithReaction = {
        ...mockChatMessage,
        reactions: [{ emoji: '👍', userId: 'user-2' }],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(messageWithReaction);
      jest.spyOn(messageRepo, 'save').mockResolvedValue({
        ...messageWithReaction,
        reactions: [],
      });

      const result = await service.toggleReaction('msg-123', '👍', 'user-2');

      expect(result.reactions).toEqual([]);
    });

    it('should throw error if message not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(service.toggleReaction('non-existent', '👍', 'user-2')).rejects.toThrow(
        'Message not found'
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark message as read by user', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockChatMessage);
      jest.spyOn(messageRepo, 'save').mockResolvedValue({
        ...mockChatMessage,
        readBy: ['user-2'],
      });

      const result = await service.markAsRead('msg-123', 'user-2');

      expect(result.readBy).toContain('user-2');
    });

    it('should not duplicate user in readBy array', async () => {
      const messageReadByUser = {
        ...mockChatMessage,
        readBy: ['user-2'],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(messageReadByUser);
      jest.spyOn(messageRepo, 'save').mockResolvedValue(messageReadByUser);

      const result = await service.markAsRead('msg-123', 'user-2');

      expect(result.readBy).toEqual(['user-2']);
      expect(result.readBy.length).toBe(1);
    });

    it('should throw error if message not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(service.markAsRead('non-existent', 'user-2')).rejects.toThrow(
        'Message not found'
      );
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark all messages in conversation as read', async () => {
      const messages = [
        { ...mockChatMessage, id: 'msg-1', senderId: 'user-1', readBy: [] },
        { ...mockChatMessage, id: 'msg-2', senderId: 'user-2', readBy: [] },
        { ...mockChatMessage, id: 'msg-3', senderId: 'user-3', readBy: [] },
      ];

      jest.spyOn(messageRepo, 'find').mockResolvedValue(messages);
      jest.spyOn(messageRepo, 'save').mockImplementation((msg: any) =>
        Promise.resolve({ ...msg, readBy: [...(msg.readBy || []), 'user-1'] })
      );

      await service.markConversationAsRead('conv-123', 'user-1');

      // Should save all messages except those sent by user-1
      expect(messageRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should not mark own messages as read', async () => {
      const messages = [
        { ...mockChatMessage, id: 'msg-1', senderId: 'user-1', readBy: [] },
      ];

      jest.spyOn(messageRepo, 'find').mockResolvedValue(messages);
      jest.spyOn(messageRepo, 'save').mockResolvedValue(messages[0]);

      await service.markConversationAsRead('conv-123', 'user-1');

      expect(messageRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('editMessage', () => {
    it('should edit message content', async () => {
      const editedMessage = {
        ...mockChatMessage,
        content: 'Updated content',
        isEdited: true,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockChatMessage);
      jest.spyOn(messageRepo, 'save').mockResolvedValue(editedMessage);

      const result = await service.editMessage('msg-123', 'Updated content');

      expect(result.content).toBe('Updated content');
      expect(result.isEdited).toBe(true);
    });

    it('should throw error if message not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(service.editMessage('non-existent', 'New content')).rejects.toThrow(
        'Message not found'
      );
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete a message', async () => {
      const deletedMessage = {
        ...mockChatMessage,
        content: '[deleted]',
        isDeleted: true,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockChatMessage);
      jest.spyOn(messageRepo, 'save').mockResolvedValue(deletedMessage);

      await service.deleteMessage('msg-123');

      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '[deleted]',
          isDeleted: true,
        })
      );
    });

    it('should throw error if message not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      await expect(service.deleteMessage('non-existent')).rejects.toThrow('Message not found');
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread messages', async () => {
      const messages = [
        { ...mockChatMessage, id: 'msg-1', readBy: [], senderId: undefined },
        { ...mockChatMessage, id: 'msg-2', readBy: ['user-2'], senderId: undefined },
        { ...mockChatMessage, id: 'msg-3', readBy: [], senderId: undefined },
      ];

      jest.spyOn(messageRepo, 'find').mockResolvedValue(messages);

      const result = await service.getUnreadCount('conv-123', 'user-1');

      // All 3 messages are returned by the query (senderId: undefined)
      // msg-1 and msg-3 don't have user-1 in readBy, msg-2 has user-2 in readBy but not user-1
      // So all 3 are unread by user-1
      expect(result).toBe(3);
    });

    it('should return 0 if all messages are read', async () => {
      const messages = [
        { ...mockChatMessage, id: 'msg-1', readBy: ['user-1', 'user-2'], senderId: undefined },
        { ...mockChatMessage, id: 'msg-2', readBy: ['user-1'], senderId: undefined },
      ];

      jest.spyOn(messageRepo, 'find').mockResolvedValue(messages);

      const result = await service.getUnreadCount('conv-123', 'user-1');

      expect(result).toBe(0);
    });

    it('should return 0 if no messages found', async () => {
      jest.spyOn(messageRepo, 'find').mockResolvedValue([]);

      const result = await service.getUnreadCount('conv-123', 'user-1');

      expect(result).toBe(0);
    });
  });
});
