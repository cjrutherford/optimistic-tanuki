import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Logger } from '@nestjs/common';
import { AIOrchestrationCommands } from '@optimistic-tanuki/constants';
import { RpcException } from '@nestjs/microservices';
import { ChatConversation } from '@optimistic-tanuki/models';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;
  let logger: Logger;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            processNewProfile: jest.fn(),
            updateConversation: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: { log: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
    logger = app.get<Logger>(Logger);
  });

  describe('profileInitialize', () => {
    it('should call appService.processNewProfile and return data', async () => {
      const data = { profileId: 'test-profile-id' };
      await appController.profileInitialize(data);
      expect(appService.processNewProfile).toHaveBeenCalledWith(data.profileId);
    });
  });

  describe('conversationUpdate', () => {
    it('should call appService.updateConversation and return update', async () => {
      const data = {
        conversation: {
          id: 'test-conversation-id',
          messages: [],
          participants: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          addMessage: jest.fn(),
        } as ChatConversation,
        aiPersonas: [],
      };
      const expectedUpdate = [{ content: 'test-message' }];
      jest.spyOn(appService, 'updateConversation').mockResolvedValue(expectedUpdate as any);

      const result = await appController.conversationUpdate(data);
      expect(appService.updateConversation).toHaveBeenCalledWith(data);
      expect(result).toEqual(expectedUpdate);
    });

    it('should throw RpcException if conversation ID is missing', async () => {
      const data = {
        conversation: { messages: [] } as ChatConversation,
        aiPersonas: [],
      };
      await expect(appController.conversationUpdate(data as any)).rejects.toThrow(RpcException);
      await expect(appController.conversationUpdate(data as any)).rejects.toThrow('Conversation ID is required');
    });
  });

  describe('telosUpdate', () => {
    it('should log that telos updated was called', async () => {
      const data = { some: 'data' };
      await appController.telosUpdate(data);
      expect(logger.log).toHaveBeenCalledWith("telos updated called. here's where we update the telos documents....");
    });
  });

  describe('referPersona', () => {
    it('should log that refer persona was called', async () => {
      const data = { some: 'data' };
      await appController.referPersona(data);
      expect(logger.log).toHaveBeenCalledWith("refer persona called. here's where we refer the persona....");
    });
  });
});
