import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { ChatController } from './chat.controller';
import { ChatCommands, ServiceTokens } from '@optimistic-tanuki/constants';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: { send: jest.Mock };

  beforeEach(async () => {
    chatService = {
      send: jest.fn().mockReturnValue(of({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ServiceTokens.CHAT_COLLECTOR_SERVICE,
          useValue: chatService,
        },
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: { send: jest.fn().mockReturnValue(of({})) },
        },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        Logger,
        Reflector,
        {
          provide: PermissionsCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
      controllers: [ChatController],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => of(true) })
      .compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get a conversation by id', async () => {
    chatService.send.mockReturnValue(of({ id: 'conversation-1' }));

    await controller.getConversation('conversation-1');

    expect(chatService.send).toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_CONVERSATION },
      { conversationId: 'conversation-1' }
    );
  });

  it('should get messages for a conversation', async () => {
    chatService.send.mockReturnValue(of([{ id: 'message-1' }]));

    await controller.getMessages('conversation-1');

    expect(chatService.send).toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_MESSAGES },
      { conversationId: 'conversation-1' }
    );
  });

  it('should get or create a direct conversation', async () => {
    const participantIds = ['profile-1', 'profile-2'];
    chatService.send.mockReturnValue(of({ id: 'conversation-1' }));

    await controller.getOrCreateDirectChat({ participantIds });

    expect(chatService.send).toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
      { participantIds }
    );
  });
});
