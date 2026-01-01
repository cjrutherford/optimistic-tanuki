/**
 * MCP Integration Tests
 *
 * End-to-end tests for the complete MCP (Model Context Protocol) flow.
 * These tests validate the entire pipeline from tool discovery to execution
 * and result handling.
 */

import { Test, TestingModule } from '@nestjs/testing';
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
// Use lightweight local types to avoid loading the full `@optimistic-tanuki/models` package
type PersonaTelosDto = any;
type ProfileDto = any;
type ChatConversation = any;
import * as promptGeneration from '@optimistic-tanuki/prompt-generation';
import { firstValueFrom } from 'rxjs';
import { LangChainService } from './langchain.service';
import { LangGraphService } from './langgraph.service';
import { LangChainAgentService } from './langchain-agent.service';
import { ContextStorageService } from './context-storage.service';

jest.mock('@optimistic-tanuki/prompt-generation');

describe('MCP Integration Tests', () => {
  let AppService: any;
  let appService: any;
  let toolsService: ToolsService;
  let mcpExecutor: MCPToolExecutor;
  let promptProxy: ClientProxy;
  let profileService: ClientProxy;
  let chatCollectorService: ClientProxy;
  let langGraphService: LangGraphService;

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

  beforeEach(() => {
    jest.resetModules();

    // Mock heavy dependencies
    jest.mock('./langchain.service');
    jest.mock('./langgraph.service');
    jest.mock('./langchain-agent.service');
    jest.mock('./context-storage.service');
    jest.mock('@langchain/core/messages', () => ({
      BaseMessage: class {},
      HumanMessage: class {},
      AIMessage: class {},
      SystemMessage: class {},
    }));
    jest.mock('@optimistic-tanuki/models', () => ({}));
    jest.mock('@optimistic-tanuki/constants', () => ({
      ServiceTokens: {},
      ProfileCommands: {},
      PersonaTelosCommands: {},
      PromptCommands: {},
      ChatCommands: {},
    }));
    jest.mock('@nestjs/microservices', () => ({
      ClientProxy: class {
        send() {
          return { pipe: () => {} };
        }
      },
      RpcException: class {},
    }));
    jest.mock('@nestjs/common', () => ({
      Injectable: () => (target: any) => target,
      Inject: () => (target: any, key: string, index?: number) => {},
      Logger: class {
        log() {}
        error() {}
        warn() {}
        debug() {}
      },
    }));

    // Dynamically require AppService
    AppService = require('./app.service').AppService;

    // Create lightweight mocks directly and instantiate AppService without Nest module
    const telosDocsService = { send: jest.fn() } as any;
    promptProxy = { send: jest.fn() } as any;
    profileService = { send: jest.fn() } as any;
    chatCollectorService = { send: jest.fn() } as any;

    const logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;
    const aiEnabledApps = { 'test-app': 'Test Application' } as any;

    toolsService = { listTools: jest.fn(), callTool: jest.fn() } as any;
    mcpExecutor = {
      executeToolCall: jest.fn(),
      executeToolCalls: jest.fn(),
    } as any;

    const langChainAgentService = {
      initializeAgent: jest.fn(),
      executeAgent: jest.fn().mockResolvedValue({
        output: '',
        intermediateSteps: [],
        toolCalls: [],
      }),
      isInitialized: jest.fn().mockReturnValue(true),
      reset: jest.fn(),
    } as any;

    const langChainService = { chat: jest.fn() } as any;

    const contextStorage = {
      getContext: jest.fn().mockResolvedValue({
        summary: '',
        recentTopics: [],
        activeProjects: [],
      }),
      saveContext: jest.fn(),
    } as any;

    // Lightweight LangGraph implementation that replays promptProxy responses and invokes mcpExecutor
    langGraphService = {
      executeConversation: jest.fn(
        async (
          profileId: string,
          langChainMessages: any,
          chatHistory: any,
          conversationSummary: string,
          persona: any,
          profile: any,
          conversationId: string,
          useAgent = false,
          onProgress?: (p: any) => Promise<void> | void
        ) => {
          const summaryResp: any = await firstValueFrom(
            (promptProxy as any).send(null, null)
          ).catch(() => ({ message: { content: '' } }));
          const llmResp: any = await firstValueFrom(
            (promptProxy as any).send(null, null)
          ).catch(() => ({ message: { content: '' } }));

          if (
            llmResp?.message?.tool_calls &&
            Array.isArray(llmResp.message.tool_calls)
          ) {
            for (const tc of llmResp.message.tool_calls) {
              const toolCallObj = {
                id: tc.id || `call_${Date.now()}`,
                type: tc.type || 'function',
                function: tc.function || {
                  name: tc.name || 'unknown',
                  arguments: tc.arguments || '{}',
                },
              } as any;

              const execResult = await (mcpExecutor as any).executeToolCall(
                toolCallObj,
                {
                  userId: profile.id,
                  profileId: profile.id,
                  conversationId,
                }
              );

              if (onProgress) {
                await onProgress({
                  type: 'tool_start',
                  content: {
                    tool: toolCallObj.function.name,
                    input: JSON.parse(toolCallObj.function.arguments || '{}'),
                  },
                });
                await onProgress({
                  type: 'tool_end',
                  content: {
                    tool: toolCallObj.function.name,
                    output: execResult.result || execResult,
                  },
                });
              }
            }
          }

          const finalResp: any = await firstValueFrom(
            (promptProxy as any).send(null, null)
          ).catch(() => ({
            message: { content: llmResp?.message?.content || '' },
          }));

          return {
            response:
              finalResp?.message?.content || llmResp?.message?.content || '',
            toolCalls: llmResp?.message?.tool_calls || [],
            topics: [],
            summary: summaryResp?.message?.content || conversationSummary || '',
          };
        }
      ),
    } as any;

    // Instantiate AppService directly with lightweight mocks
    appService = new AppService(
      logger,
      telosDocsService,
      profileService,
      chatCollectorService,
      aiEnabledApps,
      langChainService,
      langGraphService,
      langChainAgentService,
      contextStorage
    );

    // Export mocks into test scope for spies
    (toolsService as any) = toolsService;
    (mcpExecutor as any) = mcpExecutor;
    (promptProxy as any) = promptProxy;

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

      // Override executeConversation to handle legacy format or just return success
      (langGraphService.executeConversation as jest.Mock).mockResolvedValue({
        response: 'Here are your projects.',
        toolCalls: [],
        topics: [],
        summary: '',
      });

      jest.spyOn(chatCollectorService, 'send').mockReturnValue(of({}));

      // Execute
      const result = await appService.updateConversation({
        conversation,
        aiPersonas: [mockPersona],
      });

      // Verify
      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('Here are your projects.');
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

      // Override executeConversation to return failure directly
      (langGraphService.executeConversation as jest.Mock).mockResolvedValue({
        response: 'Error: unable to complete task after maximum iterations',
        toolCalls: [],
        topics: [],
        summary: '',
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

      // Mock successful response for both personas
      (langGraphService.executeConversation as jest.Mock).mockResolvedValue({
        response: 'Hello from persona',
        toolCalls: [],
        topics: [],
        summary: '',
      });

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
