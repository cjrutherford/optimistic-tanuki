import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import {
  ServiceTokens,
  ProfileCommands,
  PersonaTelosCommands,
  PromptCommands,
  ChatCommands,
} from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import {
  ChatConversation,
  ChatMessage,
  PersonaTelosDto,
  ProfileDto,
} from '@optimistic-tanuki/models';
import * as promptGeneration from '@optimistic-tanuki/prompt-generation';
import { ToolsService } from './tools.service';
import { LangChainService } from './langchain.service';
import { LangGraphService } from './langgraph.service';
import { LangChainAgentService } from './langchain-agent.service';
import { ContextStorageService } from './context-storage.service';
import { SystemPromptBuilder } from './system-prompt-builder.service';
import { ToolValidationService } from './tool-validation.service';
import { EnhancedMCPToolExecutor } from './enhanced-mcp-tool-executor.service';

jest.mock('@optimistic-tanuki/prompt-generation');

class MockSystemPromptBuilder {
  buildSystemPrompt = jest.fn().mockResolvedValue({
    template: { formatMessages: jest.fn().mockResolvedValue([{ content: 'System prompt' }]) },
    variables: {}
  });
}

describe('AppService', () => {
  let service: AppService;
  let telosDocsService: ClientProxy;
  let profileService: ClientProxy;
  let chatCollectorService: ClientProxy;
  let toolsService: ToolsService;
  let logger: Logger;

  const mockAiEnabledApps = {
    'test-app-id': 'Test App Description',
    forgeofwill: 'Forge of Will application',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: ServiceTokens.TELOS_DOCS_SERVICE,
          useValue: {
            send: jest.fn(),
          },
        },
        // prompt proxy intentionally not required for AppService tests
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: ServiceTokens.CHAT_COLLECTOR_SERVICE,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: 'ai-enabled-apps',
          useValue: mockAiEnabledApps,
        },
        {
          provide: ToolsService,
          useValue: {
            listTools: jest.fn().mockResolvedValue([]),
            callTool: jest.fn().mockResolvedValue({}),
            getResource: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: MCPToolExecutor,
          useValue: {
            executeToolCall: jest.fn().mockResolvedValue({
              success: true,
              toolName: 'test_tool',
              result: { message: 'success' },
              error: null,
            }),
          },
        },
        // LangChain / LangGraph related providers (mocks)
        {
          provide: LangChainService,
          useValue: {},
        },
        {
          provide: LangGraphService,
          useValue: {
            executeConversation: jest.fn().mockResolvedValue({
              response: 'AI response',
              toolCalls: [],
              topics: [],
            }),
          },
        },
        {
          provide: LangChainAgentService,
          useValue: {
            initializeAgent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ContextStorageService,
          useValue: {
            getContext: jest.fn().mockResolvedValue({ summary: '' }),
          },
        },
        {
          provide: SystemPromptBuilder,
          useClass: MockSystemPromptBuilder,
        },
        {
          provide: ToolValidationService,
          useValue: {
            validateToolCall: jest.fn().mockReturnValue({ isValid: true, errors: [], suggestions: [] }),
            analyzeToolCallError: jest.fn().mockReturnValue({ success: false, retryable: true, suggestedFix: 'Try again' }),
            generateToolHelpMessage: jest.fn().mockReturnValue('Tool help message'),
          },
        },
        {
          provide: EnhancedMCPToolExecutor,
          useValue: {
            executeToolWithRetry: jest.fn().mockResolvedValue({ success: true, result: { message: 'success' } }),
            executeToolWithGuidance: jest.fn().mockResolvedValue({ result: { message: 'success' } }),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    telosDocsService = module.get<ClientProxy>(
      ServiceTokens.TELOS_DOCS_SERVICE
    );
    profileService = module.get<ClientProxy>(ServiceTokens.PROFILE_SERVICE);
    chatCollectorService = module.get<ClientProxy>(
      ServiceTokens.CHAT_COLLECTOR_SERVICE
    );
    toolsService = module.get<ToolsService>(ToolsService);
    logger = module.get<Logger>(Logger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processNewProfile', () => {
    const mockProfileId = 'test-profile-id';
    const mockPersona: any = {
      id: 'persona-id',
      name: 'Alex Generalis',
      description: 'desc',
      goals: [],
      skills: [],
      interests: [],
      limitations: [],
      strengths: [],
      objectives: [],
      coreObjective: '',
      exampleResponses: [],
      promptTemplate: '',
    };
    const mockProfile: any = {
      id: mockProfileId,
      profileName: 'Test User',
      email: '',
      bio: '',
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      appScope: 'test-app-id',
    };
    const mockPromptResponse = {
      message: { content: 'Welcome message---{"goals":[]}' },
    };

    beforeEach(() => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersona]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));
      (
        promptGeneration.generatePersonaSystemMessage as jest.Mock
      ).mockReturnValue('System prompt base');
    });

    it('should successfully process a new profile', async () => {
      await service.processNewProfile(
        mockProfileId,
        'test-app-id',
        'persona-id'
      );

      expect(telosDocsService.send).toHaveBeenCalledWith(
        { cmd: PersonaTelosCommands.FIND },
        { id: 'persona-id' }
      );
      expect(profileService.send).toHaveBeenCalledWith(
        { cmd: ProfileCommands.Get },
        { id: mockProfileId }
      );
      expect(chatCollectorService.send).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(
        `Creating welcome chat for profile: '${mockProfileId}'`
      );
    });

    it('should throw RpcException if persona not found', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([]));
      await expect(
        service.processNewProfile(mockProfileId, 'test-app-id', 'persona-id')
      ).rejects.toThrow(RpcException);
      await expect(
        service.processNewProfile(mockProfileId, 'test-app-id', 'persona-id')
      ).rejects.toThrow('Failed to get persona: Persona not found');
    });

    it('should throw RpcException if profile not found', async () => {
      jest.spyOn(profileService, 'send').mockReturnValue(of(null));
      await expect(
        service.processNewProfile(mockProfileId, 'test-app-id', 'persona-id')
      ).rejects.toThrow(RpcException);
      await expect(
        service.processNewProfile(mockProfileId, 'test-app-id', 'persona-id')
      ).rejects.toThrow('Failed to process new profile: Profile not found');
    });

    // prompt proxy error handling test removed — AppService no longer depends on prompt proxy
  });

  describe('updateConversation', () => {
    const mockConversation: any = {
      id: 'conv-id',
      participants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      privacy: 'private',
      addMessage: jest.fn(),
      messages: [
        {
          id: 'msg1',
          conversationId: 'conv-id',
          senderId: 'user-id',
          senderName: 'User',
          recipientId: ['ai-id'],
          recipientName: ['AI'],
          content: 'Hello',
          timestamp: new Date(),
          role: 'user',
          type: 'chat',
        },
        {
          id: 'msg2',
          conversationId: 'conv-id',
          senderId: 'ai-id',
          senderName: 'AI',
          recipientId: ['user-id'],
          recipientName: ['User'],
          content: 'Hi there',
          timestamp: new Date(),
          role: 'assistant',
          type: 'chat',
        },
      ],
    };
    const mockAiPersonas: any[] = [
      {
        id: 'ai-id',
        name: 'AI Persona',
        description: 'desc',
        goals: [],
        skills: [],
        interests: [],
        limitations: [],
        strengths: [],
        objectives: [],
        coreObjective: '',
        exampleResponses: [],
        promptTemplate: '',
      },
    ];
    const mockProfile: any = {
      id: 'user-id',
      profileName: 'Test User',
      email: '',
      bio: '',
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      appScope: 'test-app-id',
    };
    const mockPromptResponse = { message: { content: 'AI response' } };

    beforeEach(() => {
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));
      jest
        .spyOn(service as any, 'summarizeConversation')
        .mockResolvedValue('summary');
      (
        promptGeneration.generatePersonaSystemMessage as jest.Mock
      ).mockReturnValue('System prompt');
    });

    it('should successfully update conversation and post messages', async () => {
      const result = await service.updateConversation({
        conversation: mockConversation,
        aiPersonas: mockAiPersonas,
      });

      expect(profileService.send).toHaveBeenCalledWith(
        { cmd: ProfileCommands.Get },
        { id: mockConversation.messages[1].senderId }
      );
      expect(service['summarizeConversation']).toHaveBeenCalledWith(
        mockConversation.messages
      );
      expect(chatCollectorService.send).toHaveBeenCalledTimes(
        mockAiPersonas.length
      );
      expect(result.length).toBe(mockAiPersonas.length);
      expect(result[0].content).toBe('AI response');
    });

    it('should handle errors during conversation update', async () => {
      jest
        .spyOn(profileService, 'send')
        .mockReturnValue(throwError(() => new Error('Profile error')));
      await expect(
        service.updateConversation({
          conversation: mockConversation,
          aiPersonas: mockAiPersonas,
        })
      ).rejects.toThrow(RpcException);
      expect(logger.log).toHaveBeenCalledWith(
        'Error updating conversation:',
        expect.any(Error)
      );
    });
  });

  describe('getPersona', () => {
    const mockPersona: any = {
      id: 'persona-id',
      name: 'Alex Generalis',
      description: 'desc',
      goals: [],
      skills: [],
      interests: [],
      limitations: [],
      strengths: [],
      objectives: [],
      coreObjective: '',
      exampleResponses: [],
      promptTemplate: '',
    };

    it('should return persona if found by name', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersona]));
      const result = await service['getPersona']({
        name: 'Alex Generalis',
      } as any);
      expect(result).toEqual(mockPersona);
      expect(telosDocsService.send).toHaveBeenCalledWith(
        { cmd: PersonaTelosCommands.FIND },
        { name: 'Alex Generalis' }
      );
    });

    it('should return persona if found by id', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersona]));
      const result = await service['getPersona']({ id: 'persona-id' });
      expect(result).toEqual(mockPersona);
      expect(telosDocsService.send).toHaveBeenCalledWith(
        { cmd: PersonaTelosCommands.FIND },
        { id: 'persona-id' }
      );
    });

    it('should throw RpcException if persona not found', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([]));
      await expect(
        service['getPersona']({ name: 'NonExistent' } as any)
      ).rejects.toThrow(RpcException);
      await expect(
        service['getPersona']({ name: 'NonExistent' } as any)
      ).rejects.toThrow('Failed to get persona: Persona not found');
    });

    it('should handle errors during persona retrieval', async () => {
      jest
        .spyOn(telosDocsService, 'send')
        .mockReturnValue(throwError(() => new Error('Telos error')));
      await expect(
        service['getPersona']({ name: 'Alex Generalis' } as any)
      ).rejects.toThrow(RpcException);
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting persona:',
        expect.any(Error)
      );
    });
  });

  describe('summarizeConversation', () => {
    const mockMessages: any[] = [
      {
        id: 'msg1',
        conversationId: 'conv-id',
        senderId: 'user-id',
        senderName: 'User',
        recipientId: ['ai-id'],
        recipientName: ['AI'],
        content: 'Message 1',
        timestamp: new Date(),
        role: 'user',
        type: 'chat',
      },
      {
        id: 'msg2',
        conversationId: 'conv-id',
        senderId: 'user-id',
        senderName: 'User',
        recipientId: ['ai-id'],
        recipientName: ['AI'],
        content: 'Message 2',
        timestamp: new Date(),
        role: 'user',
        type: 'chat',
      },
    ];
    // const mockPersonaPrompt = 'Persona system prompt'; // Unused
    // const mockSummaryResponse = { // Unused
    //   message: { content: 'Conversation summary' },
    // };

    it('should successfully summarize conversation using internal summarizer', async () => {
      const result = await service['summarizeConversation'](
        mockMessages
      );
      expect(result).toBe(
        'Recent conversation (last 2 messages): User: Message 1 | User: Message 2'
      );
    });

    it('should return no-history when messages empty', async () => {
      const res = await service['summarizeConversation']([]);
      expect(res).toBe('No previous conversation history.');
    });
  });
});
