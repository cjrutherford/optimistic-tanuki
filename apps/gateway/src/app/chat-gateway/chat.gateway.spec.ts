import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { ChatCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { Socket, Server } from 'socket.io';
import { ChatMessage } from '@optimistic-tanuki/models';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatCollectorService: any;
  let aiOrchestrationService: any;
  let telosDocsService: any;
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
    socket = {
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket;
    server = {
      emit: jest.fn(),
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
        type: 'chat'
      };
      const messageReceipt = { id: 'msg-1' };
      const aiRecipients = [];
      const conversations = [{ id: 'conv-id' }];
      
      chatCollectorService.send
        .mockReturnValueOnce(of(messageReceipt)) // post message
        .mockReturnValueOnce(of(conversations)); // get conversations
        
      telosDocsService.send.mockReturnValue(of(aiRecipients));

      await gateway.handleMessage(payload, socket);

      expect(chatCollectorService.send).toHaveBeenCalledWith({ cmd: ChatCommands.POST_MESSAGE }, payload);
      expect(telosDocsService.send).toHaveBeenCalled();
      expect(aiOrchestrationService.send).not.toHaveBeenCalled();
      expect(chatCollectorService.send).toHaveBeenCalledWith({ cmd: ChatCommands.GET_CONVERSATIONS }, { profileId: 'sender-id' });
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
            type: 'chat'
          };
          const messageReceipt = { id: 'msg-1' };
          const aiRecipients = [{ id: 'ai-recipient-id' }];
          const conversation = { id: 'conv-id', messages: [] };
          const conversations = [conversation];
          
          chatCollectorService.send
            .mockReturnValueOnce(of(messageReceipt)) // post message
            .mockReturnValueOnce(of(conversation)) // get conversation
            .mockReturnValueOnce(of(conversations)); // get conversations
            
          telosDocsService.send.mockReturnValue(of(aiRecipients));
    
          await gateway.handleMessage(payload, socket);
    
          expect(chatCollectorService.send).toHaveBeenCalledWith({ cmd: ChatCommands.POST_MESSAGE }, payload);
          expect(telosDocsService.send).toHaveBeenCalled();
          expect(aiOrchestrationService.send).toHaveBeenCalled();
          expect(chatCollectorService.send).toHaveBeenCalledWith({ cmd: ChatCommands.GET_CONVERSATIONS }, { profileId: 'sender-id' });
    });
  });

  describe('handleDisconnect', () => {
    it('should handle disconnect', () => {
      gateway.handleDisconnect(socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });
  });
});