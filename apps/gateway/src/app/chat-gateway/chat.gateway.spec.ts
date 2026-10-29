import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { LoggerModule } from '@optimistic-tanuki/logger';
import {
  ChatCommands,
  PrivacyCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { Socket, Server } from 'socket.io';
import { RpcException } from '@nestjs/microservices';
import { ChatMessage } from '@optimistic-tanuki/models';
import { SocketSessionAuthService } from '../../auth/socket-session-auth.service';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatCollectorService: any;
  let aiOrchestrationService: any;
  let telosDocsService: any;
  let socialService: any;
  let socket: Socket;
  let server: Server;

  beforeEach(async () => {
    chatCollectorService = {
      send: jest.fn(() => of({})),
    };
    aiOrchestrationService = {
      send: jest.fn(() => of({})),
    };
    telosDocsService = {
      send: jest.fn(() => of({})),
    };
    socialService = { send: jest.fn(() => of(false)) };
    socket = {
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
    } as unknown as Socket;
    server = {
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
    } as unknown as Server;

    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        ChatGateway,
        {
          provide: ServiceTokens.CHAT_COLLECTOR_SERVICE,
          useValue: chatCollectorService,
        },
        {
          provide: ServiceTokens.AI_ORCHESTRATION_SERVICE,
          useValue: aiOrchestrationService,
        },
        {
          provide: ServiceTokens.TELOS_DOCS_SERVICE,
          useValue: telosDocsService,
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn(() => of({})),
          },
        },
        { provide: ServiceTokens.SOCIAL_SERVICE, useValue: socialService },
        {
          provide: SocketSessionAuthService,
          useValue: {
            authenticate: jest
              .fn()
              .mockResolvedValue({ userId: 'user-id', profileId: 'sender-id' }),
            getUser: jest.fn(() => ({
              userId: 'user-id',
              profileId: 'sender-id',
            })),
            assertProfile: jest.fn((_client: Socket, profileId: string) => ({
              userId: 'user-id',
              profileId,
            })),
          },
        },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleGetConversations', () => {
    it('should get conversations and emit them to the client', async () => {
      const payload = { profileId: 'test-profile-id' };
      const conversations = [{ id: 'conv1' }];
      chatCollectorService.send.mockReturnValue(of(conversations));

      await gateway.handleGetConversations(payload, socket);

      expect(chatCollectorService.send).toHaveBeenCalledWith(
        { cmd: ChatCommands.GET_CONVERSATIONS },
        payload
      );
      expect(socket.emit).toHaveBeenCalledWith('conversations', conversations);
    });
  });

  describe('handleMessage', () => {
    it('limits writes by authenticated account across sockets before another lookup or POST', async () => {
      const previousLimit = process.env.THROTTLE_CHAT_WRITE_LIMIT;
      const previousProfile = process.env.THROTTLER_PROFILE;
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.THROTTLE_CHAT_WRITE_LIMIT = '1';
      process.env.THROTTLER_PROFILE = 'production';
      process.env.NODE_ENV = 'production';
      const secondSocket = {
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;
      chatCollectorService.send.mockImplementation(({ cmd }) =>
        of(cmd === ChatCommands.GET_CONVERSATION ? null : {})
      );
      const payload = {
        id: 'not-persisted',
        senderId: 'sender-id',
        userId: 'forged-user-id',
        conversationId: 'missing-conversation',
        content: 'rate-limit must run before POST',
      } as unknown as ChatMessage;
      const acknowledge = jest.fn();

      try {
        await expect(
          gateway.handleMessage({ ...payload }, socket, acknowledge)
        ).rejects.toThrow('Conversation unavailable');
        expect(acknowledge).toHaveBeenCalledWith({
          success: false,
          statusCode: 404,
          message: 'This conversation is no longer available.',
        });
        await expect(
          gateway.handleMessage({ ...payload }, secondSocket)
        ).rejects.toThrow('Too many chat writes');

        expect(chatCollectorService.send).toHaveBeenCalledTimes(1);
        expect(chatCollectorService.send).toHaveBeenCalledWith(
          { cmd: ChatCommands.GET_CONVERSATION },
          {
            conversationId: 'missing-conversation',
            requestingProfileId: 'sender-id',
          }
        );
        expect(chatCollectorService.send).not.toHaveBeenCalledWith(
          { cmd: ChatCommands.POST_MESSAGE },
          expect.anything()
        );
      } finally {
        if (previousLimit === undefined)
          delete process.env.THROTTLE_CHAT_WRITE_LIMIT;
        else process.env.THROTTLE_CHAT_WRITE_LIMIT = previousLimit;
        if (previousProfile === undefined) delete process.env.THROTTLER_PROFILE;
        else process.env.THROTTLER_PROFILE = previousProfile;
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
      }
    });

    it('should handle a message and notify recipients', async () => {
      const payload: ChatMessage = {
        id: 'msg-id',
        senderId: 'sender-id',
        senderName: 'sender-name',
        recipientId: ['recipient-id'],
        recipientName: ['recipient-name'],
        conversationId: 'conv-id',
        content: 'hello',
        timestamp: new Date(),
        type: 'chat',
        role: 'user',
      };
      const messageReceipt = {
        id: 'conv-id',
        participants: ['sender-id', 'recipient-id'],
        messages: [
          {
            id: 'msg-id',
            senderId: 'sender-id',
            recipients: ['recipient-id'],
            content: 'hello',
            createdAt: new Date(),
          },
        ],
      };
      const aiRecipients = [];
      const conversations = [{ id: 'conv-id' }];

      chatCollectorService.send.mockImplementation(({ cmd }) =>
        of(
          cmd === ChatCommands.POST_MESSAGE ||
            cmd === ChatCommands.GET_CONVERSATION
            ? messageReceipt
            : [{ id: 'conv-id' }]
        )
      ); // get conversations

      telosDocsService.send.mockReturnValue(of(aiRecipients));

      await gateway.handleMessage(payload, socket);

      expect(chatCollectorService.send).toHaveBeenCalledWith(
        { cmd: ChatCommands.POST_MESSAGE },
        payload
      );
      expect(telosDocsService.send).toHaveBeenCalled();
      expect(aiOrchestrationService.send).not.toHaveBeenCalled();
      expect(chatCollectorService.send).toHaveBeenCalledWith(
        { cmd: ChatCommands.GET_CONVERSATIONS },
        { profileId: 'sender-id' }
      );
      expect(socket.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({ content: 'hello' })
      );
    });

    it('acknowledges the stable message id only after the collector saves it', async () => {
      const payload: ChatMessage = {
        id: 'stable-message-id',
        senderId: 'sender-id',
        senderName: 'Sender',
        recipientId: ['recipient-id'],
        recipientName: ['Recipient'],
        conversationId: 'conv-id',
        content: 'acknowledged',
        timestamp: new Date(),
        type: 'chat',
        role: 'user',
      };
      const conversation = {
        id: 'conv-id',
        type: 'community',
        participants: ['sender-id', 'recipient-id'],
      };
      const stored = {
        id: 'stable-message-id',
        content: 'acknowledged',
        senderId: 'sender-id',
        recipients: ['recipient-id'],
        createdAt: new Date(),
      };
      chatCollectorService.send.mockImplementation(({ cmd }) =>
        of(
          cmd === ChatCommands.GET_CONVERSATION
            ? conversation
            : cmd === ChatCommands.POST_MESSAGE
            ? { messages: [stored] }
            : [{ id: 'conv-id' }]
        )
      );
      telosDocsService.send.mockReturnValue(of([]));
      const acknowledge = jest.fn();

      await gateway.handleMessage(payload, socket, acknowledge);

      expect(chatCollectorService.send).toHaveBeenCalledWith(
        { cmd: ChatCommands.POST_MESSAGE },
        payload
      );
      expect(acknowledge).toHaveBeenCalledWith({
        success: true,
        messageId: 'stable-message-id',
      });
    });

    it('returns a sanitized status-aware acknowledgement when persistence rejects', async () => {
      const payload = {
        id: 'stable-message-id',
        senderId: 'sender-id',
        senderName: 'Sender',
        recipientId: ['recipient-id'],
        recipientName: ['Recipient'],
        conversationId: 'conv-id',
        content: 'denied',
        timestamp: new Date(),
        type: 'chat',
        role: 'user',
      } as ChatMessage;
      chatCollectorService.send.mockImplementation(({ cmd }) =>
        cmd === ChatCommands.GET_CONVERSATION
          ? of({
              id: 'conv-id',
              type: 'community',
              participants: ['sender-id', 'recipient-id'],
            })
          : throwError(
              () =>
                new RpcException({
                  statusCode: 403,
                  message: 'Sensitive membership details',
                })
            )
      );
      const acknowledge = jest.fn();

      await expect(
        gateway.handleMessage(payload, socket, acknowledge)
      ).rejects.toBeTruthy();

      expect(acknowledge).toHaveBeenCalledWith({
        success: false,
        statusCode: 403,
        message: 'You no longer have access to this conversation.',
      });
      expect(JSON.stringify(acknowledge.mock.calls)).not.toContain(
        'Sensitive membership details'
      );
    });

    it('refuses websocket messages in an existing blocked direct conversation before persistence', async () => {
      const payload: ChatMessage = {
        id: 'msg-blocked',
        senderId: 'sender-id',
        senderName: 'sender-name',
        recipientId: ['recipient-id'],
        recipientName: ['recipient-name'],
        conversationId: 'conv-id',
        content: 'blocked websocket message',
        timestamp: new Date(),
        type: 'chat',
        role: 'user',
      };
      chatCollectorService.send.mockImplementation(({ cmd }) =>
        of(
          cmd === ChatCommands.GET_CONVERSATION
            ? { type: 'direct', participants: ['sender-id', 'recipient-id'] }
            : { messages: [] }
        )
      );
      socialService.send.mockImplementation((pattern, body) =>
        of(
          pattern.cmd === PrivacyCommands.IS_USER_BLOCKED &&
            body.blockerId === 'recipient-id'
        )
      );

      await expect(
        gateway.handleMessage(payload, socket)
      ).rejects.toBeInstanceOf(Error);
      expect(chatCollectorService.send).not.toHaveBeenCalledWith(
        { cmd: ChatCommands.POST_MESSAGE },
        payload
      );
    });

    it('still persists and broadcasts human messages when persona classification is unavailable', async () => {
      const payload: ChatMessage = {
        id: 'msg-id',
        senderId: 'sender-id',
        senderName: 'sender-name',
        recipientId: ['recipient-id'],
        recipientName: ['recipient-name'],
        conversationId: 'conv-id',
        content: 'hello',
        timestamp: new Date(),
        type: 'chat',
        role: 'user',
      };
      const messageReceipt = {
        id: 'conv-id',
        participants: ['sender-id', 'recipient-id'],
        messages: [
          {
            id: 'msg-id',
            senderId: 'sender-id',
            recipients: ['recipient-id'],
            content: 'hello',
            createdAt: new Date(),
          },
        ],
      };
      const conversations = [{ id: 'conv-id' }];

      telosDocsService.send.mockReturnValue(
        throwError(() => new Error('TELOS unavailable'))
      );
      chatCollectorService.send.mockImplementation(({ cmd }) =>
        of(
          cmd === ChatCommands.POST_MESSAGE ||
            cmd === ChatCommands.GET_CONVERSATION
            ? messageReceipt
            : [{ id: 'conv-id' }]
        )
      );

      await expect(
        gateway.handleMessage(payload, socket)
      ).resolves.toBeUndefined();

      expect(chatCollectorService.send).toHaveBeenCalledWith(
        { cmd: ChatCommands.POST_MESSAGE },
        payload
      );
      expect(aiOrchestrationService.send).not.toHaveBeenCalled();
      expect(chatCollectorService.send).toHaveBeenCalledWith(
        { cmd: ChatCommands.GET_CONVERSATIONS },
        { profileId: 'sender-id' }
      );
      expect(socket.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({ content: 'hello' })
      );
    });

    it('should handle a message with AI recipients', async () => {
      const payload: ChatMessage = {
        id: 'msg-id',
        senderId: 'sender-id',
        senderName: 'sender-name',
        recipientId: ['ai-recipient-id'],
        recipientName: ['ai-recipient-name'],
        conversationId: 'conv-id',
        content: 'hello',
        timestamp: new Date(),
        type: 'chat',
        role: 'user',
      };
      const messageReceipt = {
        id: 'conv-id',
        participants: ['sender-id', 'recipient-id'],
        messages: [
          {
            id: 'msg-id',
            senderId: 'sender-id',
            recipients: ['recipient-id'],
            content: 'hello',
            createdAt: new Date(),
          },
        ],
      };
      const aiRecipients = [{ id: 'ai-recipient-id' }];
      const conversation = { id: 'conv-id', messages: [] };
      const conversations = [conversation];

      chatCollectorService.send.mockImplementation(({ cmd }) =>
        of(
          cmd === ChatCommands.POST_MESSAGE ||
            cmd === ChatCommands.GET_CONVERSATION
            ? messageReceipt
            : [{ id: 'conv-id' }]
        )
      ); // get conversations

      telosDocsService.send.mockReturnValue(of(aiRecipients));

      await gateway.handleMessage(payload, socket);

      expect(chatCollectorService.send).toHaveBeenCalledWith(
        { cmd: ChatCommands.POST_MESSAGE },
        payload
      );
      expect(telosDocsService.send).toHaveBeenCalled();
      expect(aiOrchestrationService.send).toHaveBeenCalled();
      expect(chatCollectorService.send).toHaveBeenCalledWith(
        { cmd: ChatCommands.GET_CONVERSATIONS },
        { profileId: 'sender-id' }
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should handle disconnect', () => {
      gateway.handleDisconnect(socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });
  });
});
