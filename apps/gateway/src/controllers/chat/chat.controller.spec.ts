import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from '../../app/chat-gateway/chat.gateway';
import {
  ChatCommands,
  PrivacyCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { UserDetails } from '../../decorators/user.decorator';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: { send: jest.Mock };
  let profileService: { send: jest.Mock };
  let socialService: { send: jest.Mock };
  const notifications = { notifyPersistedMessage: jest.fn() };

  const mockUser: UserDetails = {
    userId: 'user-1',
    profileId: 'profile-1',
    email: 'test@test.com',
    name: 'Test User',
    exp: 9999999999,
    iat: 0,
  };

  beforeEach(async () => {
    notifications.notifyPersistedMessage
      .mockReset()
      .mockResolvedValue(undefined);
    chatService = {
      send: jest.fn().mockReturnValue(of({})),
    };
    profileService = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'profile-2',
          userId: 'user-2',
          appScope: 'client-interface',
        })
      ),
    };
    socialService = {
      send: jest.fn((pattern) =>
        of(
          pattern.cmd === 'GET_MEMBERS'
            ? [
                {
                  profileId: 'profile-1',
                  status: 'approved',
                  role: 'owner',
                },
              ]
            : false
        )
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ChatGateway, useValue: notifications },
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: socialService,
        },
        {
          provide: ServiceTokens.CHAT_COLLECTOR_SERVICE,
          useValue: chatService,
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: profileService,
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

    await controller.getMessages('conversation-1', {
      profileId: 'profile-1',
    } as never);

    expect(chatService.send).toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_MESSAGES },
      // The reader's own profile, so the service can refuse a conversation
      // they are not in. Without it this route answered any id with
      // everything in it.
      { conversationId: 'conversation-1', requestingProfileId: 'profile-1' }
    );
  });

  it('derives the sender from the authenticated user for a direct conversation', async () => {
    chatService.send.mockReturnValue(of({ id: 'conversation-1' }));

    await controller.getOrCreateDirectChat(
      { recipientProfileId: 'profile-2' },
      mockUser,
      'client-interface'
    );

    expect(profileService.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Get },
      { id: 'profile-2' }
    );

    expect(chatService.send).toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
      { participantIds: ['profile-1', 'profile-2'] }
    );
    expect(socialService.send).toHaveBeenCalledWith(
      { cmd: PrivacyCommands.IS_USER_BLOCKED },
      { blockerId: 'profile-1', blockedId: 'profile-2' }
    );
    expect(socialService.send).toHaveBeenCalledWith(
      { cmd: PrivacyCommands.IS_USER_BLOCKED },
      { blockerId: 'profile-2', blockedId: 'profile-1' }
    );
  });

  it('refuses direct conversation creation when either participant blocked the other', async () => {
    socialService.send.mockImplementation((pattern, payload) =>
      of(
        pattern.cmd === PrivacyCommands.IS_USER_BLOCKED &&
          payload.blockerId === 'profile-2'
      )
    );

    await expect(
      controller.getOrCreateDirectChat(
        { recipientProfileId: 'profile-2' },
        mockUser,
        'client-interface'
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(chatService.send).not.toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_OR_CREATE_DIRECT_CHAT },
      expect.anything()
    );
  });

  it('rejects a recipient outside the current app scope', async () => {
    profileService.send.mockReturnValue(
      of({ id: 'profile-2', userId: 'user-2', appScope: 'forgeofwill' })
    );

    await expect(
      controller.getOrCreateDirectChat(
        { recipientProfileId: 'profile-2' },
        mockUser,
        'client-interface'
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(chatService.send).not.toHaveBeenCalled();
  });

  it('should send message with senderId bound to auth user profile', async () => {
    chatService.send.mockImplementation((pattern) =>
      of(
        pattern.cmd === ChatCommands.GET_CONVERSATION
          ? { type: 'direct', participants: ['profile-1', 'profile-2'] }
          : { id: 'message-1' }
      )
    );

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

  it('notifies live recipients of the persisted REST message, not caller-supplied recipients', async () => {
    const stored = {
      id: 'message-1',
      senderId: 'profile-1',
      recipients: ['profile-2'],
      content: 'saved',
    };
    chatService.send.mockImplementation(({ cmd }) =>
      of(
        cmd === ChatCommands.GET_CONVERSATION
          ? { type: 'direct', participants: ['profile-1', 'profile-2'] }
          : stored
      )
    );
    await expect(
      controller.sendMessage(
        {
          conversationId: 'conv-1',
          content: 'saved',
          recipientIds: ['forged'],
        },
        mockUser
      )
    ).resolves.toEqual(stored);
    expect(notifications.notifyPersistedMessage).toHaveBeenCalledWith(
      'conv-1',
      stored
    );
  });

  it('does not fail a durable REST send when live delivery fails', async () => {
    const stored = { id: 'message-1', senderId: 'profile-1', recipients: [] };
    chatService.send.mockReturnValue(of(stored));
    notifications.notifyPersistedMessage.mockRejectedValue(
      new Error('connection lost')
    );
    await expect(
      controller.sendMessage(
        { conversationId: 'conv-1', content: 'saved', recipientIds: [] },
        mockUser
      )
    ).resolves.toEqual(stored);
    expect(notifications.notifyPersistedMessage).toHaveBeenCalled();
  });

  it('does not notify recipients when persistence fails', async () => {
    chatService.send.mockImplementation(({ cmd }) =>
      cmd === ChatCommands.SEND_MESSAGE
        ? throwError(() => ({ statusCode: 503 }))
        : of({ type: 'community' })
    );
    await expect(
      controller.sendMessage(
        { conversationId: 'conv-1', content: 'saved', recipientIds: [] },
        mockUser
      )
    ).rejects.toMatchObject({ status: 503 });
    expect(notifications.notifyPersistedMessage).not.toHaveBeenCalled();
  });

  it('refuses to send into an existing direct conversation if either participant blocked the other', async () => {
    chatService.send.mockImplementation((pattern) =>
      of(
        pattern.cmd === ChatCommands.GET_CONVERSATION
          ? { type: 'direct', participants: ['profile-1', 'profile-2'] }
          : { id: 'message-1' }
      )
    );
    socialService.send.mockImplementation((pattern, payload) =>
      of(
        pattern.cmd === PrivacyCommands.IS_USER_BLOCKED &&
          payload.blockerId === 'profile-2'
      )
    );

    await expect(
      controller.sendMessage(
        {
          conversationId: 'conv-1',
          content: 'hello',
          recipientIds: ['profile-2'],
        },
        mockUser
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(chatService.send).not.toHaveBeenCalledWith(
      { cmd: ChatCommands.SEND_MESSAGE },
      expect.anything()
    );
  });
});
