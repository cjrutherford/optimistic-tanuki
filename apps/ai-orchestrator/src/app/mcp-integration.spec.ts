/**
 * MCP Integration Tests
 *
 * End-to-end tests for the complete MCP (Model Context Protocol) flow.
 * These tests validate the entire pipeline from tool discovery to execution
 * and result handling.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { ToolsService } from './tools.service';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ClientProxy } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import {
  ServiceTokens,
  ProfileCommands,
  PersonaTelosCommands,
  PromptCommands,
  ChatCommands,
} from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import {
  PersonaTelosDto,
  ProfileDto,
  ChatConversation,
} from '@optimistic-tanuki/models';
import * as promptGeneration from '@optimistic-tanuki/prompt-generation';

jest.mock('@optimistic-tanuki/prompt-generation');

describe('MCP Integration Tests', () => {
  let appService: AppService;
  let toolsService: ToolsService;
  let mcpExecutor: MCPToolExecutor;
  let promptProxy: ClientProxy;
  let profileService: ClientProxy;
  let chatCollectorService: ClientProxy;

  const mockProfile: ProfileDto = {
    id: 'profile-123',
    profileName: 'Test User',
    email: 'test@example.com',
    bio: '',
    avatarUrl: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    appScope: 'test-app',
  };

  const mockPersona: PersonaTelosDto = {
    id: 'persona-123',
    name: 'Test Assistant',
    description: 'A helpful assistant',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: ToolsService,
          useValue: {
            listTools: jest.fn(),
            callTool: jest.fn(),
            getResource: jest.fn().mockResolvedValue(null),
            listResources: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MCPToolExecutor,
          useValue: {
            executeToolCall: jest.fn(),
            executeToolCalls: jest.fn(),
          },
        },
        {
          provide: ServiceTokens.TELOS_DOCS_SERVICE,
          useValue: { send: jest.fn() },
        },
        {
          provide: ServiceTokens.PROMPT_PROXY,
          useValue: { send: jest.fn() },
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: { send: jest.fn() },
        },
        {
          provide: ServiceTokens.CHAT_COLLECTOR_SERVICE,
          useValue: { send: jest.fn() },
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
          useValue: { 'test-app': 'Test Application' },
        },
      ],
    }).compile();

    appService = module.get<AppService>(AppService);
    toolsService = module.get<ToolsService>(ToolsService);
    mcpExecutor = module.get<MCPToolExecutor>(MCPToolExecutor);
    promptProxy = module.get<ClientProxy>(ServiceTokens.PROMPT_PROXY);
    profileService = module.get<ClientProxy>(ServiceTokens.PROFILE_SERVICE);
    chatCollectorService = module.get<ClientProxy>(
      ServiceTokens.CHAT_COLLECTOR_SERVICE
    );

    (
      promptGeneration.generatePersonaSystemMessage as jest.Mock
    ).mockReturnValue('System prompt');
  });

  describe('End-to-End Tool Calling Flow', () => {
    it('should handle successful tool call with OpenAI format', async () => {
      const conversation: ChatConversation = {
        id: 'conv-123',
        participants: ['profile-123', 'persona-123'],
        createdAt: new Date(),
        updatedAt: new Date(),
        privacy: 'private',
        addMessage: jest.fn(),
        messages: [
          {
            id: 'msg-1',
            conversationId: 'conv-123',
            senderId: 'profile-123',
            senderName: 'Test User',
            recipientId: ['persona-123'],
            recipientName: ['Test Assistant'],
            content: 'List my projects',
            timestamp: new Date(),
            role: 'user',
            type: 'chat',
          },
        ],
      };

      // Mock profile service
      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));

      // Mock tools service to return available tools
      jest.spyOn(toolsService, 'listTools').mockResolvedValue([
        {
          name: 'list_projects',
          description: 'List all projects for a user',
          inputSchema: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
            },
            required: ['userId'],
          },
        },
      ]);

      // Mock LLM response with tool call
      jest
        .spyOn(promptProxy, 'send')
        .mockReturnValueOnce(of({ message: { content: 'summary' } })) // Conversation summary
        .mockReturnValueOnce(
          of({
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'list_projects',
                    arguments: '{"userId": "profile-123"}',
                  },
                },
              ],
            },
          })
        )
        .mockReturnValueOnce(
          of({
            message: {
              content: 'You have 2 projects: Project A and Project B.',
            },
          })
        );

      // Mock tool execution
      jest.spyOn(mcpExecutor, 'executeToolCall').mockResolvedValue({
        toolCallId: 'call_123',
        toolName: 'list_projects',
        success: true,
        result: {
          projects: [
            { id: 'proj-1', name: 'Project A' },
            { id: 'proj-2', name: 'Project B' },
          ],
          count: 2,
        },
        metadata: {
          executionTime: 50,
          timestamp: new Date(),
        },
      });

      // Mock chat collector
      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));

      // Execute
      const result = await appService.updateConversation({
        conversation,
        aiPersonas: [mockPersona],
      });

      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('Project A');
      expect(result[0].content).toContain('Project B');
      expect(mcpExecutor.executeToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'call_123',
          function: expect.objectContaining({
            name: 'list_projects',
          }),
        }),
        expect.objectContaining({
          userId: 'profile-123',
          profileId: 'profile-123',
          conversationId: 'conv-123',
        })
      );
    });

    it('should handle tool execution failure gracefully', async () => {
      const conversation: ChatConversation = {
        id: 'conv-123',
        participants: ['profile-123', 'persona-123'],
        createdAt: new Date(),
        updatedAt: new Date(),
        privacy: 'private',
        addMessage: jest.fn(),
        messages: [
          {
            id: 'msg-1',
            conversationId: 'conv-123',
            senderId: 'profile-123',
            senderName: 'Test User',
            recipientId: ['persona-123'],
            recipientName: ['Test Assistant'],
            content: 'Create a project',
            timestamp: new Date(),
            role: 'user',
            type: 'chat',
          },
        ],
      };

      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      jest.spyOn(toolsService, 'listTools').mockResolvedValue([]);

      // Mock LLM responses
      jest
        .spyOn(promptProxy, 'send')
        .mockReturnValueOnce(of({ message: { content: 'summary' } }))
        .mockReturnValueOnce(
          of({
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call_456',
                  type: 'function',
                  function: {
                    name: 'create_project',
                    arguments: '{"name": "Test Project"}',
                  },
                },
              ],
            },
          })
        )
        .mockReturnValueOnce(
          of({
            message: {
              content:
                'I encountered an error creating the project. Please try again.',
            },
          })
        );

      // Mock tool execution failure
      jest.spyOn(mcpExecutor, 'executeToolCall').mockResolvedValue({
        toolCallId: 'call_456',
        toolName: 'create_project',
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project name must be at least 3 characters',
          details: { field: 'name', minLength: 3 },
        },
        metadata: {
          executionTime: 30,
          timestamp: new Date(),
        },
      });

      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));

      // Execute
      const result = await appService.updateConversation({
        conversation,
        aiPersonas: [mockPersona],
      });

      // Verify error handling
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('error');
      expect(mcpExecutor.executeToolCall).toHaveBeenCalled();
    });

    it('should handle legacy JSON format tool calls', async () => {
      const conversation: ChatConversation = {
        id: 'conv-123',
        participants: ['profile-123', 'persona-123'],
        createdAt: new Date(),
        updatedAt: new Date(),
        privacy: 'private',
        addMessage: jest.fn(),
        messages: [
          {
            id: 'msg-1',
            conversationId: 'conv-123',
            senderId: 'profile-123',
            senderName: 'Test User',
            recipientId: ['persona-123'],
            recipientName: ['Test Assistant'],
            content: 'List projects',
            timestamp: new Date(),
            role: 'user',
            type: 'chat',
          },
        ],
      };

      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      jest.spyOn(toolsService, 'listTools').mockResolvedValue([]);

      // Mock LLM response with legacy JSON format
      jest
        .spyOn(promptProxy, 'send')
        .mockReturnValueOnce(of({ message: { content: 'summary' } }))
        .mockReturnValueOnce(
          of({
            message: {
              content: JSON.stringify({
                tool: 'list_projects',
                args: { userId: 'profile-123' },
              }),
            },
          })
        )
        .mockReturnValueOnce(
          of({
            message: {
              content: 'Here are your projects.',
            },
          })
        );

      // Mock tool execution
      jest.spyOn(mcpExecutor, 'executeToolCall').mockResolvedValue({
        toolCallId: expect.any(String),
        toolName: 'list_projects',
        success: true,
        result: { projects: [], count: 0 },
        metadata: {
          executionTime: 40,
          timestamp: new Date(),
        },
      });

      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));

      // Execute
      const result = await appService.updateConversation({
        conversation,
        aiPersonas: [mockPersona],
      });

      // Verify legacy format was converted and executed
      expect(result).toHaveLength(1);
      expect(mcpExecutor.executeToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'function',
          function: expect.objectContaining({
            name: 'list_projects',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should stop after maximum iterations', async () => {
      const conversation: ChatConversation = {
        id: 'conv-123',
        participants: ['profile-123', 'persona-123'],
        createdAt: new Date(),
        updatedAt: new Date(),
        privacy: 'private',
        addMessage: jest.fn(),
        messages: [
          {
            id: 'msg-1',
            conversationId: 'conv-123',
            senderId: 'profile-123',
            senderName: 'Test User',
            recipientId: ['persona-123'],
            recipientName: ['Test Assistant'],
            content: 'Test message',
            timestamp: new Date(),
            role: 'user',
            type: 'chat',
          },
        ],
      };

      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      jest.spyOn(toolsService, 'listTools').mockResolvedValue([]);

      // Mock LLM to keep calling tools indefinitely
      jest
        .spyOn(promptProxy, 'send')
        .mockReturnValueOnce(of({ message: { content: 'summary' } }))
        .mockReturnValue(
          of({
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call_loop',
                  type: 'function',
                  function: {
                    name: 'list_projects',
                    arguments: '{}',
                  },
                },
              ],
            },
          })
        );

      jest.spyOn(mcpExecutor, 'executeToolCall').mockResolvedValue({
        toolCallId: 'call_loop',
        toolName: 'list_projects',
        success: true,
        result: { projects: [] },
        metadata: { executionTime: 10, timestamp: new Date() },
      });

      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));

      // Execute
      const result = await appService.updateConversation({
        conversation,
        aiPersonas: [mockPersona],
      });

      // Verify it stopped at max iterations
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('unable to complete');
    });

    it('should handle multiple personas', async () => {
      const conversation: ChatConversation = {
        id: 'conv-123',
        participants: ['profile-123', 'persona-1', 'persona-2'],
        createdAt: new Date(),
        updatedAt: new Date(),
        privacy: 'private',
        addMessage: jest.fn(),
        messages: [
          {
            id: 'msg-1',
            conversationId: 'conv-123',
            senderId: 'profile-123',
            senderName: 'Test User',
            recipientId: ['persona-1', 'persona-2'],
            recipientName: ['Persona 1', 'Persona 2'],
            content: 'Hello',
            timestamp: new Date(),
            role: 'user',
            type: 'chat',
          },
        ],
      };

      const personas: PersonaTelosDto[] = [
        { ...mockPersona, id: 'persona-1', name: 'Persona 1' },
        { ...mockPersona, id: 'persona-2', name: 'Persona 2' },
      ];

      jest.spyOn(profileService, 'send').mockReturnValue(of(mockProfile));
      jest.spyOn(toolsService, 'listTools').mockResolvedValue([]);

      jest
        .spyOn(promptProxy, 'send')
        .mockReturnValue(of({ message: { content: 'Hello from persona' } }));

      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));

      // Execute
      const result = await appService.updateConversation({
        conversation,
        aiPersonas: personas,
      });

      // Verify both personas responded
      expect(result).toHaveLength(2);
      expect(chatCollectorService.send).toHaveBeenCalledTimes(2);
    });
  });
});
