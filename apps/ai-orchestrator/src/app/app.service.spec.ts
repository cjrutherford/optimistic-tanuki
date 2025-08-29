import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ServiceTokens, ProfileCommands, PersonaTelosCommands, PromptCommands, ChatCommands } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { ChatConversation, ChatMessage, PersonaTelosDto, ProfileDto } from '@optimistic-tanuki/models';
import * as promptGeneration from '@optimistic-tanuki/prompt-generation';

jest.mock('@optimistic-tanuki/prompt-generation');

describe('AppService', () => {
  let service: AppService;
  let telosDocsService: ClientProxy;
  let promptProxy: ClientProxy;
  let profileService: ClientProxy;
  let chatCollectorService: ClientProxy;
  let logger: Logger;

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
        {
          provide: ServiceTokens.PROMPT_PROXY,
          useValue: {
            send: jest.fn(),
          },
        },
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
          useValue: { log: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    telosDocsService = module.get<ClientProxy>(ServiceTokens.TELOS_DOCS_SERVICE);
    promptProxy = module.get<ClientProxy>(ServiceTokens.PROMPT_PROXY);
    profileService = module.get<ClientProxy>(ServiceTokens.PROFILE_SERVICE);
    chatCollectorService = module.get<ClientProxy>(ServiceTokens.CHAT_COLLECTOR_SERVICE);
    logger = module.get<Logger>(Logger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processNewProfile', () => {
    const mockProfileId = 'test-profile-id';
    const mockPersona: PersonaTelosDto = { 
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
    const mockProfile: ProfileDto = { 
      id: mockProfileId, 
      profileName: 'Test User',
      email: '',
      bio: '',
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockPromptResponse = { message: { content: 'Welcome message---{"goals":[]}' } };

    beforeEach(() => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersona]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      jest.spyOn(promptProxy, 'send').mockReturnValue(of(mockPromptResponse));
      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));
      (promptGeneration.generatePersonaSystemMessage as jest.Mock).mockReturnValue('System prompt base');
    });

    it('should successfully process a new profile', async () => {
      await service.processNewProfile(mockProfileId);

      expect(telosDocsService.send).toHaveBeenCalledWith(
        { cmd: PersonaTelosCommands.FIND },
        { name: 'Alex Generalis' }
      );
      expect(profileService.send).toHaveBeenCalledWith(
        { cmd: ProfileCommands.Get },
        { id: mockProfileId }
      );
      expect(promptProxy.send).toHaveBeenCalled();
      expect(chatCollectorService.send).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(`Creating welcome chat for profile: '${mockProfileId}'`);
    });

    it('should throw RpcException if persona not found', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([]));
      await expect(service.processNewProfile(mockProfileId)).rejects.toThrow(RpcException);
      await expect(service.processNewProfile(mockProfileId)).rejects.toThrow('Failed to get persona: Persona not found');
    });

    it('should throw RpcException if profile not found', async () => {
      jest.spyOn(profileService, 'send').mockReturnValue(of(null));
      await expect(service.processNewProfile(mockProfileId)).rejects.toThrow(RpcException);
      await expect(service.processNewProfile(mockProfileId)).rejects.toThrow('Failed to process new profile: Profile not found');
    });

    it('should handle errors during prompt proxy call', async () => {
      jest.spyOn(promptProxy, 'send').mockReturnValue(throwError(() => new Error('Prompt error')));
      await expect(service.processNewProfile(mockProfileId)).rejects.toThrow(RpcException);
      expect(logger.error).toHaveBeenCalledWith('Error processing new profile:', expect.any(Error));
    });
  });

  describe('updateConversation', () => {
    const mockConversation: ChatConversation = {
      id: 'conv-id',
      participants: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      addMessage: jest.fn(),
      messages: [
        { id: 'msg1', conversationId: 'conv-id', senderId: 'user-id', senderName: 'User', recipientId: ['ai-id'], recipientName: ['AI'], content: 'Hello', timestamp: new Date(), type: 'chat' },
        { id: 'msg2', conversationId: 'conv-id', senderId: 'ai-id', senderName: 'AI', recipientId: ['user-id'], recipientName: ['User'], content: 'Hi there', timestamp: new Date(), type: 'chat' },
      ],
    };
    const mockAiPersonas: PersonaTelosDto[] = [
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
    const mockProfile: ProfileDto = {
      id: 'user-id', 
      profileName: 'Test User',
      email: '',
      bio: '',
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockPromptResponse = { message: { content: 'AI response' } };

    beforeEach(() => {
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      jest.spyOn(promptProxy, 'send').mockReturnValue(of(mockPromptResponse));
      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));
      jest.spyOn(service as any, 'summarizeConversation').mockResolvedValue('summary');
      (promptGeneration.generatePersonaSystemMessage as jest.Mock).mockReturnValue('System prompt');
    });

    it('should successfully update conversation and post messages', async () => {
      const result = await service.updateConversation({ conversation: mockConversation, aiPersonas: mockAiPersonas });

      expect(profileService.send).toHaveBeenCalledWith(
        { cmd: ProfileCommands.Get },
        { id: mockConversation.messages[1].senderId }
      );
      expect(service['summarizeConversation']).toHaveBeenCalledWith(
        mockConversation.messages,
        'System prompt'
      );
      expect(promptProxy.send).toHaveBeenCalled();
      expect(chatCollectorService.send).toHaveBeenCalledTimes(mockAiPersonas.length);
      expect(result.length).toBe(mockAiPersonas.length);
      expect(result[0].content).toBe('AI response');
    });

    it('should handle errors during conversation update', async () => {
      jest.spyOn(profileService, 'send').mockReturnValue(throwError(() => new Error('Profile error')));
      await expect(service.updateConversation({ conversation: mockConversation, aiPersonas: mockAiPersonas })).rejects.toThrow(RpcException);
      expect(logger.log).toHaveBeenCalledWith('Error updating conversation:', expect.any(Error));
    });
  });

  describe('getPersona', () => {
    const mockPersona: PersonaTelosDto = {
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
      const result = await service['getPersona']({ name: 'Alex Generalis' });
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
      await expect(service['getPersona']({ name: 'NonExistent' })).rejects.toThrow(RpcException);
      await expect(service['getPersona']({ name: 'NonExistent' })).rejects.toThrow('Failed to get persona: Persona not found');
    });

    it('should handle errors during persona retrieval', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(throwError(() => new Error('Telos error')));
      await expect(service['getPersona']({ name: 'Alex Generalis' })).rejects.toThrow(RpcException);
      expect(logger.error).toHaveBeenCalledWith('Error getting persona:', expect.any(Error));
    });
  });

  describe('summarizeConversation', () => {
    const mockMessages: ChatMessage[] = [
      { id: 'msg1', conversationId: 'conv-id', senderId: 'user-id', senderName: 'User', recipientId: ['ai-id'], recipientName: ['AI'], content: 'Message 1', timestamp: new Date(), type: 'chat' },
      { id: 'msg2', conversationId: 'conv-id', senderId: 'user-id', senderName: 'User', recipientId: ['ai-id'], recipientName: ['AI'], content: 'Message 2', timestamp: new Date(), type: 'chat' },
    ];
    const mockPersonaPrompt = 'Persona system prompt';
    const mockSummaryResponse = { message: { content: 'Conversation summary' } };

    beforeEach(() => {
      jest.spyOn(promptProxy, 'send').mockReturnValue(of(mockSummaryResponse));
    });

    it('should successfully summarize conversation', async () => {
      const result = await service['summarizeConversation'](mockMessages, mockPersonaPrompt);
      expect(result).toBe('Conversation summary');
      expect(promptProxy.send).toHaveBeenCalledWith(
        { cmd: PromptCommands.SEND },
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'Message 1\n\n\nMessage 2' }),
          ]),
        })
      );
    });

    it('should handle errors during conversation summarization', async () => {
      jest.spyOn(promptProxy, 'send').mockReturnValue(throwError(() => new Error('Summarize error')));
      await expect(service['summarizeConversation'](mockMessages, mockPersonaPrompt)).rejects.toThrow(RpcException);
      expect(logger.error).toHaveBeenCalledWith('Error summarizing conversation:', expect.any(Error));
    });
  });
});