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

describe('SystemPromptBuilder', () => {
  let service: SystemPromptBuilder;
  let telosDocsService: ClientProxy;
  let profileService: ClientProxy;

  const mockPersonaTelos: PersonaTelosDto = {
    id: 'persona-123',
    name: 'ProjectAssistant',
    description: 'A helpful project management assistant',
    goals: 'Help users manage projects efficiently, Track deadlines and milestones',
    skills: 'Task management, Communication, Organization',
    limitations: 'Cannot access external systems, Limited to platform features',
    coreObjective: 'Streamline project workflow and boost team productivity',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfile: ProfileDto = {
    id: 'profile-456',
    userId: 'user-789',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProfileTelos: ProfileTelosDto = {
    id: 'profile-telos-456',
    profileId: 'profile-456',
    coreObjective: 'Build innovative software products',
    goals: 'Deliver high-quality code, Mentor junior developers',
    skills: 'TypeScript, React, Node.js, Leadership',
    interests: 'AI/ML, Web performance, Developer tools',
    objectives: 'Launch new product by Q2, Improve code review process',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProjectTelos: ProjectTelosDto = {
    id: 'project-telos-789',
    projectId: 'project-789',
    coreObjective: 'Deliver scalable e-commerce platform',
    goals: 'Achieve 99.9% uptime, Support 10k concurrent users',
    skills: 'Cloud architecture, Microservices, Database optimization',
    interests: 'Performance tuning, Security, User experience',
    objectives: 'Launch MVP by March, Onboard first 100 customers',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
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
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of(mockPersonaTelos));
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
        .mockReturnValueOnce(of(mockPersonaTelos)) // fetchPersonaTelos
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
      expect(result.variables.userGoals).toBe('Deliver high-quality code, Mentor junior developers');
      expect(result.variables.userSkills).toBe('TypeScript, React, Node.js, Leadership');
    });

    it('should include project TELOS when requested', async () => {
      jest.spyOn(telosDocsService, 'send')
        .mockReturnValueOnce(of(mockPersonaTelos)) // fetchPersonaTelos
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
      expect(result.variables.projectGoals).toBe('Achieve 99.9% uptime, Support 10k concurrent users');
      expect(result.variables.projectSkills).toBe('Cloud architecture, Microservices, Database optimization');
    });

    it('should include all TELOS contexts when all options enabled', async () => {
      jest.spyOn(telosDocsService, 'send')
        .mockReturnValueOnce(of(mockPersonaTelos)) // fetchPersonaTelos
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
      expect(result.variables.userId).toBe('user-789');
    });

    it('should handle missing profile TELOS gracefully', async () => {
      jest.spyOn(telosDocsService, 'send')
        .mockReturnValueOnce(of(mockPersonaTelos)) // fetchPersonaTelos
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
        .mockReturnValueOnce(of(mockPersonaTelos)) // fetchPersonaTelos
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
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of(mockPersonaTelos));
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
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of(mockPersonaTelos));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      const templateStr = JSON.stringify(result.template);
      
      // Verify TELOS-first structure
      expect(templateStr).toContain('PERSONA IDENTITY');
      expect(templateStr).toContain('TELOS Framework');
      expect(templateStr).toContain('Core Objective');
      expect(templateStr).toContain('Goals');
      expect(templateStr).toContain('Skills');
      expect(templateStr).toContain('Limitations');
    });

    it('should emphasize assistant role clarity', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of(mockPersonaTelos));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      const templateStr = JSON.stringify(result.template);
      
      // Verify role clarity
      expect(templateStr).toContain('NOT role-playing as the user');
      expect(templateStr).toContain('AI assistant');
      expect(templateStr).toContain('use "I" for your actions');
    });
  });

  describe('caching', () => {
    it('should cache persona TELOS data', async () => {
      const sendSpy = jest.spyOn(telosDocsService, 'send').mockReturnValue(of(mockPersonaTelos));
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
      expect(sendSpy).toHaveBeenCalledTimes(2); // Once for each call (cache works within same call)
    });
  });

  describe('template variable building', () => {
    it('should format persona goals as readable text', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of(mockPersonaTelos));
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      expect(result.variables.personaGoals).toContain('Help users manage projects efficiently');
      expect(result.variables.personaGoals).toContain('Track deadlines and milestones');
    });

    it('should format user name correctly', async () => {
      jest.spyOn(telosDocsService, 'send').mockReturnValue(of(mockPersonaTelos));
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
      jest.spyOn(profileService, 'send').mockReturnValue(of([mockProfile]));

      const result = await service.buildSystemPrompt({
        personaId: 'persona-123',
        profileId: 'profile-456',
      });

      // Phase 1 fix: conversationSummary should NOT be in variables (system prompt is now static)
      expect(result.variables.conversationSummary).toBeUndefined();
      
      // Verify template does NOT include conversation context section
      const templateMessages = await result.template.formatMessages(result.variables);
      const systemMessage = templateMessages[0].content as string;
      expect(systemMessage).not.toContain('# CONVERSATION CONTEXT');
    });
  });
});
