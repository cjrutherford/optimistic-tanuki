import { Test, TestingModule } from '@nestjs/testing';
import { SystemPromptBuilder, SystemPromptOptions } from './system-prompt-builder.service';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import {
  PersonaTelosDto,
  ProfileDto,
  ProfileTelosDto,
  ProjectTelosDto,
} from '@optimistic-tanuki/models';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Mock ChatPromptTemplate
jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {
    fromMessages: jest.fn(),
  },
}));

describe('SystemPromptBuilder', () => {
  let service: SystemPromptBuilder;
  let telosDocsService: ClientProxy;
  let profileService: ClientProxy;

  const mockPersonaTelos: PersonaTelosDto = {
    id: 'persona-123',
    name: 'ProjectAssistant',
    description: 'A helpful project management assistant',
    goals: ['Help users manage projects efficiently', 'Track deadlines and milestones'],
    skills: ['Task management', 'Communication', 'Organization'],
    limitations: ['Cannot access external systems', 'Limited to platform features'],
    coreObjective: 'Streamline project workflow and boost team productivity',
    createdAt: new Date(),
    updatedAt: new Date(),
    interests: [],
    strengths: [],
    objectives: [],
    exampleResponses: [],
    promptTemplate: '',
  };

  const mockProfile: ProfileDto = {
    id: 'profile-456',
    userId: 'user-789',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    profileName: 'John Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ProfileDto;

  const mockProfileTelos: ProfileTelosDto = {
    id: 'profile-telos-456',
    profileId: 'profile-456',
    coreObjective: 'Build innovative software products',
    goals: ['Deliver high-quality code', 'Mentor junior developers'],
    skills: ['TypeScript', 'React', 'Node.js', 'Leadership'],
    interests: ['AI/ML', 'Web performance', 'Developer tools'],
    objectives: ['Launch new product by Q2', 'Improve code review process'],
    createdAt: new Date(),
    updatedAt: new Date(),
    name: 'John Doe',
    description: 'Software Engineer',
    limitations: [],
    strengths: [],
    projects: [],
    overallProfileSummary: '',
  };

  const mockProjectTelos: ProjectTelosDto = {
    id: 'project-telos-789',
    projectId: 'project-789',
    coreObjective: 'Deliver scalable e-commerce platform',
    goals: ['Achieve 99.9% uptime', 'Support 10k concurrent users'],
    skills: ['Cloud architecture', 'Microservices', 'Database optimization'],
    interests: ['Performance tuning', 'Security', 'User experience'],
    objectives: ['Launch MVP by March', 'Onboard first 100 customers'],
    createdAt: new Date(),
    updatedAt: new Date(),
    name: 'E-commerce Platform',
    description: 'A scalable e-commerce platform',
    limitations: [],
    strengths: [],
    profile: mockProfileTelos,
    overallProjectSummary: '',
  };

  const mockChatPromptTemplate = {
    formatMessages: jest.fn().mockResolvedValue([{ content: 'Mocked system message' }]),
  };

  beforeEach(async () => {
    (ChatPromptTemplate.fromMessages as jest.Mock).mockReturnValue(mockChatPromptTemplate);
    mockChatPromptTemplate.formatMessages.mockResolvedValue([{ content: 'Mocked system message' }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemPromptBuilder,
        {
          provide: ServiceTokens.TELOS_DOCS_SERVICE,
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
      ],
    }).compile();

    service = module.get<SystemPromptBuilder>(SystemPromptBuilder);
    telosDocsService = module.get<ClientProxy>(ServiceTokens.TELOS_DOCS_SERVICE);
    profileService = module.get<ClientProxy>(ServiceTokens.PROFILE_SERVICE);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildSystemPrompt', () => {
    it('should build basic system prompt with persona TELOS only', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      expect(result).toBeDefined();
      expect(result.template).toBeDefined();
      expect(result.variables).toBeDefined();
      expect(result.variables.personaName).toBe('ProjectAssistant');
      expect(result.variables.personaCoreObjective).toBe('Streamline project workflow and boost team productivity');
      expect(result.variables.userName).toBe('John Doe');
    });

    it('should include profile TELOS when requested', async () => {
      jest.spyOn(telosDocsService, 'send')
        .mockReturnValueOnce(of([mockPersonaTelos])) // fetchPersonaTelos
        .mockReturnValueOnce(of(mockProfileTelos)); // fetchProfileTelos
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt(
        {
          personaId: 'persona-123',
          profileId: 'profile-456',
        },
        {
          includeProfileTelos: true,
        }
      );

      expect(result.variables.userCoreObjective).toBe('Build innovative software products');
      expect(result.variables.userGoals).toBe('Deliver high-quality code and Mentor junior developers');
      expect(result.variables.userSkills).toBe('TypeScript, React, Node.js, and Leadership');
    });

    it('should include project TELOS when requested', async () => {
      jest.spyOn(telosDocsService, 'send')
        .mockReturnValueOnce(of([mockPersonaTelos])) // fetchPersonaTelos
        .mockReturnValueOnce(of(mockProjectTelos)); // fetchProjectTelos
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt(
        {
          personaId: 'persona-123',
          profileId: 'profile-456',
          projectId: 'project-789',
        },
        {
          includeProjectTelos: true,
        }
      );

      expect(result.variables.projectCoreObjective).toBe('Deliver scalable e-commerce platform');
      expect(result.variables.projectGoals).toBe('Achieve 99.9% uptime and Support 10k concurrent users');
      expect(result.variables.projectSkills).toBe('Cloud architecture, Microservices, and Database optimization');
    });

    it('should include all TELOS contexts when all options enabled', async () => {
      jest.spyOn(telosDocsService, 'send')
        .mockReturnValueOnce(of([mockPersonaTelos])) // fetchPersonaTelos
        .mockReturnValueOnce(of(mockProfileTelos)) // fetchProfileTelos
        .mockReturnValueOnce(of(mockProjectTelos)); // fetchProjectTelos
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt(
        {
          personaId: 'persona-123',
          profileId: 'profile-456',
          projectId: 'project-789',
        },
        {
          includeProfileTelos: true,
          includeProjectTelos: true,
          includeTools: true,
          includeExamples: true,
        }
      );

      expect(result.variables.personaName).toBe('ProjectAssistant');
      expect(result.variables.userCoreObjective).toBe('Build innovative software products');
      expect(result.variables.projectCoreObjective).toBe('Deliver scalable e-commerce platform');
      expect(result.variables.userId).toBe('profile-456');
    });

    it('should handle missing profile TELOS gracefully', async () => {
      jest.spyOn(telosDocsService, 'send')
        .mockReturnValueOnce(of([mockPersonaTelos])) // fetchPersonaTelos
        .mockReturnValueOnce(throwError(() => new Error('Not found'))); // fetchProfileTelos fails
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt(
        {
          personaId: 'persona-123',
          profileId: 'profile-456',
        },
        {
          includeProfileTelos: true,
        }
      );

      expect(result).toBeDefined();
      expect(result.variables.personaName).toBe('ProjectAssistant');
      // Should not have profile TELOS variables
      expect(result.variables.userCoreObjective).toBeUndefined();
    });

    it('should handle missing project TELOS gracefully', async () => {
      jest.spyOn(telosDocsService, 'send')
        .mockReturnValueOnce(of([mockPersonaTelos])) // fetchPersonaTelos
        .mockReturnValueOnce(throwError(() => new Error('Not found'))); // fetchProjectTelos fails
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt(
        {
          personaId: 'persona-123',
          profileId: 'profile-456',
          projectId: 'project-789',
        },
        {
          includeProjectTelos: true,
        }
      );

      expect(result).toBeDefined();
      expect(result.variables.personaName).toBe('ProjectAssistant');
      // Should not have project TELOS variables
      expect(result.variables.projectCoreObjective).toBeUndefined();
    });


    it('should include project context when provided', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const projectContext = 'Current project: E-commerce Platform. Active tasks: 12. Overdue tasks: 2.';

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
        projectContext,
      });

      expect(result.variables.projectContext).toBe(projectContext);
    });
  });

  describe('TELOS-first architecture', () => {
    it('should generate template with persona TELOS as foundational identity', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      // Since we mocked ChatPromptTemplate.fromMessages, we need to inspect the calls to it
      expect(ChatPromptTemplate.fromMessages).toHaveBeenCalled();
      const messages = (ChatPromptTemplate.fromMessages as jest.Mock).mock.calls[0][0];
      const systemMessage = messages[0][1];
      
      // Verify TELOS-first structure
      expect(systemMessage).toContain('PERSONA IDENTITY');
      expect(systemMessage).toContain('TELOS Framework');
      expect(systemMessage).toContain('Core Objective');
      expect(systemMessage).toContain('Goals');
      expect(systemMessage).toContain('Skills');
      expect(systemMessage).toContain('Limitations');
    });

    it('should emphasize assistant role clarity', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      const messages = (ChatPromptTemplate.fromMessages as jest.Mock).mock.calls[0][0];
      const systemMessage = messages[0][1];
      
      // Verify role clarity
      expect(systemMessage).toContain('NOT role-playing as the user');
      expect(systemMessage).toContain('AI assistant');
      expect(systemMessage).toContain('use "I" for your actions');
    });
  });

  describe('caching', () => {
    it('should cache persona TELOS data', async () => {
      const sendSpy = jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      // First call
      await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      // Second call with same personaId
      await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      // Should only fetch persona TELOS once due to caching
      expect(sendSpy).toHaveBeenCalledTimes(1); // Once for each call (cache works within same call)
    });
  });

  describe('template variable building', () => {
    it('should format persona goals as readable text', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      expect(result.variables.personaGoals).toContain('Help users manage projects efficiently');
      expect(result.variables.personaGoals).toContain('Track deadlines and milestones');
    });

    it('should format user name correctly', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      expect(result.variables.userName).toBe('John Doe');
      expect(result.variables.userName).toBe('John Doe');
    });

    it('should NOT include conversation summary (Phase 1 fix)', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      // Phase 1 fix: conversationSummary should NOT be in variables (system prompt is now static)
      expect(result.variables.conversationSummary).toBeUndefined();
      
      // Verify template does NOT include conversation context section
      const messages = (ChatPromptTemplate.fromMessages as jest.Mock).mock.calls[0][0];
      const systemMessage = messages[0][1];
      expect(systemMessage).not.toContain('# CONVERSATION CONTEXT');
    });

    it('should include first message instructions when isFirstMessage is true', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      (ChatPromptTemplate.fromMessages as jest.Mock).mockClear();

      await service.buildSystemPrompt(
        {
          personaId: 'persona-123',
          profileId: 'profile-456',
        },
        {
          isFirstMessage: true,
        }
      );

      const messages = (ChatPromptTemplate.fromMessages as jest.Mock).mock.calls[0][0];
      const systemMessage = messages[0][1];
      
      // Should include first message instructions
      expect(systemMessage).toContain('# RESPONSE GUIDELINES - INITIAL GREETING');
      expect(systemMessage).toContain('CRITICAL: First Message Rules');
      expect(systemMessage).toContain('BE CONVERSATIONAL ONLY');
      expect(systemMessage).toContain('DO NOT call any tools');
      expect(systemMessage).toContain('INTRODUCE YOURSELF');
      expect(systemMessage).toContain('ENCOURAGE ENGAGEMENT');
    });

    it('should NOT include first message instructions when isFirstMessage is false', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      (ChatPromptTemplate.fromMessages as jest.Mock).mockClear();

      await service.buildSystemPrompt(
        {
          personaId: 'persona-123',
          profileId: 'profile-456',
        },
        {
          isFirstMessage: false,
        }
      );

      const messages = (ChatPromptTemplate.fromMessages as jest.Mock).mock.calls[0][0];
      const systemMessage = messages[0][1];
      
      // Should NOT include first message instructions
      expect(systemMessage).not.toContain('# RESPONSE GUIDELINES - INITIAL GREETING');
      expect(systemMessage).not.toContain('CRITICAL: First Message Rules');
      
      // Should include normal response guidelines
      expect(systemMessage).toContain('# RESPONSE GUIDELINES');
      expect(systemMessage).toContain('## Persona Alignment');
      expect(systemMessage).toContain('## Tool Execution');
    });

    it('should exclude tools section when isFirstMessage is true', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of([mockPersonaTelos]));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      (ChatPromptTemplate.fromMessages as jest.Mock).mockClear();

      await service.buildSystemPrompt(
        {
          personaId: 'persona-123',
          profileId: 'profile-456',
        },
        {
          isFirstMessage: true,
          includeTools: true, // Even if requested, should be overridden
        }
      );

      const messages = (ChatPromptTemplate.fromMessages as jest.Mock).mock.calls[0][0];
      const systemMessage = messages[0][1];
      
      // Should NOT include tools section on first message
      expect(systemMessage).not.toContain('# TOOLS & CAPABILITIES');
      expect(systemMessage).not.toContain('Tool Discovery');
    });
  });
});