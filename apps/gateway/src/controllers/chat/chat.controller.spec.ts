import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { ChatController } from './chat.controller';
import { ChatCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { UserDetails } from '../../decorators/user.decorator';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: { send: jest.Mock };

  const mockUser: UserDetails = {
    userId: 'user-1',
    profileId: 'profile-1',
    email: 'test@test.com',
    name: 'Test User',
    exp: 9999999999,
    iat: 0,
  };

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

  it('should get conversations using profile from auth context', async () => {
    chatService.send.mockReturnValue(of([{ id: 'conversation-1' }]));

    await controller.getConversations(mockUser);

    expect(chatService.send).toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_CONVERSATIONS },
      { profileId: 'profile-1' }
    );
  });

  it('should get a conversation by id, forwarding requestingProfileId', async () => {
    chatService.send.mockReturnValue(of({ id: 'conversation-1' }));

    await controller.getConversation('conversation-1', mockUser);

    expect(chatService.send).toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_CONVERSATION },
      { conversationId: 'conversation-1', requestingProfileId: 'profile-1' }
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

  it('should send message with senderId bound to auth user profile', async () => {
    chatService.send.mockReturnValue(of({ id: 'message-1' }));

    await controller.sendMessage(
      {
        conversationId: 'conv-1',
        content: 'hello',
        recipientIds: ['profile-2'],
      },
      mockUser
    );

    expect(chatService.send).toHaveBeenCalledWith(
      { cmd: ChatCommands.SEND_MESSAGE },
      {
        conversationId: 'conv-1',
        content: 'hello',
        recipientIds: ['profile-2'],
        senderId: 'profile-1',
      }
    );
  });
});
