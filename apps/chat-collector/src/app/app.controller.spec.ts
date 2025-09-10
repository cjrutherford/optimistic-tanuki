import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Logger } from '@nestjs/common';
import { ChatCommands } from '@optimistic-tanuki/constants';
import { ChatMessage } from '@optimistic-tanuki/models';

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
          },
        },
        {
          provide: Logger,
          useValue: { log: jest.fn() },
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
      };
      const expectedResult = { ...chatMessage, id: 'new-id' };
      jest.spyOn(appService, 'postMessage').mockResolvedValue(expectedResult as any);

      const result = await appController.postMessage(chatMessage);
      expect(appService.postMessage).toHaveBeenCalledWith(chatMessage);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getConversations', () => {
    it('should call appService.getConversations and return the result', async () => {
      const profileId = 'profile1';
      const expectedResult = [{ id: 'conv1', participants: [profileId], messages: [] }];
      jest.spyOn(appService, 'getConversations').mockResolvedValue(expectedResult as any);

      const result = await appController.getConversations({ profileId });
      expect(logger.log).toHaveBeenCalledWith(`Retrieving conversations for profile ID: ${profileId}`);
      expect(appService.getConversations).toHaveBeenCalledWith(profileId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getConversation', () => {
    it('should call appService.getConversation and return the result', async () => {
      const conversationId = 'conv1';
      const expectedResult = { id: conversationId, participants: [], messages: [] };
      jest.spyOn(appService, 'getConversation').mockResolvedValue(expectedResult as any);

      const result = await appController.getConversation({ conversationId });
      expect(logger.log).toHaveBeenCalledWith(`Retrieving conversation for ID: ${conversationId}`);
      expect(appService.getConversation).toHaveBeenCalledWith(conversationId);
      expect(result).toEqual(expectedResult);
    });
  });
});
