import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Logger } from '@nestjs/common';
import { ChatCommands } from '@optimistic-tanuki/constants';
import { ChatMessage } from '@optimistic-tanuki/models';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            postMessage: jest.fn(),
            getConversations: jest.fn(),
            getConversation: jest.fn(),
            createCommunityChat: jest.fn(),
            getOrCreateDirectChat: jest.fn(),
            getMessages: jest.fn(),
            postMessageHttp: jest.fn(),
            getConversationsHttp: jest.fn(),
            getConversationHttp: jest.fn(),
            createDirectChat: jest.fn(),
            deleteConversation: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: { log: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
    appService = module.get<AppService>(AppService);
    logger = module.get<Logger>(Logger);
  });

  describe('postMessage', () => {
    it('should call appService.postMessage and return the result', async () => {
      const chatMessage: ChatMessage = {
        id: '1',
        conversationId: 'conv1',
        senderId: 'user1',
        senderName: 'User One',
        recipientId: ['user2'],
        recipientName: ['User Two'],
        content: 'Hello',
        timestamp: new Date(),
        type: 'chat',
        role: 'user',
      };
      const expectedResult = { ...chatMessage, id: 'new-id' };
      jest
        .spyOn(appService, 'postMessage')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.postMessage(chatMessage);
      expect(appService.postMessage).toHaveBeenCalledWith(chatMessage);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getConversations', () => {
    it('should call appService.getConversations and return the result', async () => {
      const profileId = 'profile1';
      const expectedResult = [
        { id: 'conv1', participants: [profileId], messages: [] },
      ];
      jest
        .spyOn(appService, 'getConversations')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.getConversations({ profileId });
      expect(logger.log).toHaveBeenCalledWith(
        `Retrieving conversations for profile ID: ${profileId}`
      );
      expect(appService.getConversations).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getConversation', () => {
    it('should call appService.getConversation and return the result', async () => {
      const conversationId = 'conv1';
      const expectedResult = {
        id: conversationId,
        participants: [],
        messages: [],
      };
      jest
        .spyOn(appService, 'getConversation')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.getConversation({ conversationId });
      expect(logger.log).toHaveBeenCalledWith(
        `Retrieving conversation for ID: ${conversationId}`
      );
      expect(appService.getConversation).toHaveBeenCalledWith(conversationId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('healthCheck', () => {
    it('should return a healthy status', () => {
      expect(appController.healthCheck()).toEqual({ status: 'healthy' });
    });
  });

  describe('healthCheckHttp', () => {
    it('should return a healthy status', () => {
      expect(appController.healthCheckHttp()).toEqual({ status: 'healthy' });
    });
  });

  describe('createCommunityChat', () => {
    it('should call appService.createCommunityChat and return the result', async () => {
      const data = { communityId: 'c1', ownerId: 'o1', name: 'My Chat' };
      const expectedResult = { id: 'conv1' };
      jest
        .spyOn(appService, 'createCommunityChat')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.createCommunityChat(data);
      expect(logger.log).toHaveBeenCalledWith(
        `Creating community chat for community: ${data.communityId}`
      );
      expect(appService.createCommunityChat).toHaveBeenCalledWith(
        data.communityId,
        data.ownerId,
        data.name
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getOrCreateDirectChatTcp', () => {
    it('should call appService.getOrCreateDirectChat and return the result', async () => {
      const data = { participantIds: ['user1', 'user2'] };
      const expectedResult = { id: 'conv1' };
      jest
        .spyOn(appService, 'getOrCreateDirectChat')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.getOrCreateDirectChatTcp(data);
      expect(logger.log).toHaveBeenCalledWith(
        `TCP: Get-or-create direct chat for participants: ${data.participantIds.join(
          ', '
        )}`
      );
      expect(appService.getOrCreateDirectChat).toHaveBeenCalledWith(
        data.participantIds
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getMessagesTcp', () => {
    it('should call appService.getMessages and return the result', async () => {
      const data = { conversationId: 'conv1' };
      const expectedResult = [{ id: 'msg1' }];
      jest
        .spyOn(appService, 'getMessages')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.getMessagesTcp(data);
      expect(logger.log).toHaveBeenCalledWith(
        `TCP: Retrieving messages for conversation: ${data.conversationId}`
      );
      // The controller forwards the requesting profile so the service can
      // scope the read; this payload carries none.
      expect(appService.getMessages).toHaveBeenCalledWith(
        data.conversationId,
        undefined
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('sendMessageTcp', () => {
    it('should call appService.postMessageHttp and return the result', async () => {
      const data = {
        conversationId: 'conv1',
        content: 'hi',
        senderId: 'user1',
        recipientIds: ['user2'],
      };
      const expectedResult = { id: 'msg1' };
      jest
        .spyOn(appService, 'postMessageHttp')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.sendMessageTcp(data);
      expect(logger.log).toHaveBeenCalledWith(
        `TCP: Sending message to conversation: ${data.conversationId}`
      );
      expect(appService.postMessageHttp).toHaveBeenCalledWith(data);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findConversations', () => {
    it('should call appService.getConversationsHttp and return the result', async () => {
      const profileId = 'profile1';
      const expectedResult = [{ id: 'conv1' }];
      jest
        .spyOn(appService, 'getConversationsHttp')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.findConversations(profileId);
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Finding conversations for profile ID: ${profileId}`
      );
      expect(appService.getConversationsHttp).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getConversationsHttp', () => {
    it('should call appService.getConversationsHttp and return the result', async () => {
      const profileId = 'profile1';
      const expectedResult = [{ id: 'conv1' }];
      jest
        .spyOn(appService, 'getConversationsHttp')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.getConversationsHttp(profileId);
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Retrieving conversations for profile ID: ${profileId}`
      );
      expect(appService.getConversationsHttp).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getConversationHttp', () => {
    it('should call appService.getConversationHttp and return the result', async () => {
      const conversationId = 'conv1';
      const expectedResult = { id: conversationId };
      jest
        .spyOn(appService, 'getConversationHttp')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.getConversationHttp(conversationId);
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Retrieving conversation for ID: ${conversationId}`
      );
      expect(appService.getConversationHttp).toHaveBeenCalledWith(
        conversationId
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createDirectChatHttp', () => {
    it('should call appService.createDirectChat and return the result', async () => {
      const data = { participantIds: ['user1', 'user2'] };
      const expectedResult = { id: 'conv1' };
      jest
        .spyOn(appService, 'createDirectChat')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.createDirectChatHttp(data);
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Creating direct chat for participants: ${data.participantIds.join(
          ', '
        )}`
      );
      expect(appService.createDirectChat).toHaveBeenCalledWith(
        data.participantIds
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getOrCreateDirectChatHttp', () => {
    it('should call appService.getOrCreateDirectChat and return the result', async () => {
      const data = { participantIds: ['user1', 'user2'] };
      const expectedResult = { id: 'conv1' };
      jest
        .spyOn(appService, 'getOrCreateDirectChat')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.getOrCreateDirectChatHttp(data);
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Getting or creating direct chat for participants: ${data.participantIds.join(
          ', '
        )}`
      );
      expect(appService.getOrCreateDirectChat).toHaveBeenCalledWith(
        data.participantIds
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createCommunityChatHttp', () => {
    it('should call appService.createCommunityChat and return the result', async () => {
      const data = { communityId: 'c1', ownerId: 'o1', name: 'My Chat' };
      const expectedResult = { id: 'conv1' };
      jest
        .spyOn(appService, 'createCommunityChat')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.createCommunityChatHttp(data);
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Creating community chat for community: ${data.communityId}`
      );
      expect(appService.createCommunityChat).toHaveBeenCalledWith(
        data.communityId,
        data.ownerId,
        data.name
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('deleteConversationHttp', () => {
    it('should call appService.deleteConversation', async () => {
      const conversationId = 'conv1';
      const data = { userId: 'user1' };
      jest.spyOn(appService, 'deleteConversation').mockResolvedValue(undefined);

      const result = await appController.deleteConversationHttp(
        conversationId,
        data
      );
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Deleting conversation: ${conversationId}`
      );
      expect(appService.deleteConversation).toHaveBeenCalledWith(
        conversationId,
        data.userId
      );
      expect(result).toBeUndefined();
    });
  });

  describe('getMessagesHttp', () => {
    it('should call appService.getMessages and return the result', async () => {
      const conversationId = 'conv1';
      const expectedResult = [{ id: 'msg1' }];
      jest
        .spyOn(appService, 'getMessages')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.getMessagesHttp(conversationId);
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Retrieving messages for conversation: ${conversationId}`
      );
      expect(appService.getMessages).toHaveBeenCalledWith(conversationId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('sendMessageHttp', () => {
    it('should call appService.postMessageHttp and return the result', async () => {
      const data = {
        conversationId: 'conv1',
        content: 'hi',
        senderId: 'user1',
        recipientIds: ['user2'],
      };
      const expectedResult = { id: 'msg1' };
      jest
        .spyOn(appService, 'postMessageHttp')
        .mockResolvedValue(expectedResult as any);

      const result = await appController.sendMessageHttp(data);
      expect(logger.log).toHaveBeenCalledWith(
        `HTTP: Sending message to conversation: ${data.conversationId}`
      );
      expect(appService.postMessageHttp).toHaveBeenCalledWith(data);
      expect(result).toEqual(expectedResult);
    });
  });
});
