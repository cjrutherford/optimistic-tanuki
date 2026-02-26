import { Test, TestingModule } from '@nestjs/testing';
import { LangChainAgentService } from './langchain-agent.service';
import { ConfigService } from '@nestjs/config';
import { ToolsService } from './tools.service';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ModelInitializerService } from './model-initializer.service';
import { WorkflowControlService } from './workflow-control.service';
import { SystemPromptBuilder } from './system-prompt-builder.service';
import { ToolFactory } from './tool-factory.service';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOllama } from '@langchain/ollama';
import { of } from 'rxjs';

// Mock external libraries
jest.mock('@langchain/ollama', () => ({
  ChatOllama: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: jest.fn(),
}));

jest.mock('@langchain/core/tools', () => ({
  DynamicStructuredTool: jest.fn().mockImplementation((config) => ({
    name: config.name,
    description: config.description,
    func: config.func,
  })),
}));

// Helper for mock messages
const mockMsg = (role: string, content: string, additional: any = {}) => ({
  content,
  _getType: () => role,
  ...additional,
});

describe('LangChainAgentService', () => {
  let service: LangChainAgentService;
  let toolsService: ToolsService;
  let mcpExecutor: MCPToolExecutor;
  let systemPromptBuilder: SystemPromptBuilder;
  let workflowControl: WorkflowControlService;
  let mockAgentStream: jest.Mock;

  const mockProfile = { id: 'user-123' } as any;
  const mockPersona = { id: 'persona-123' } as any;

  beforeEach(async () => {
    mockAgentStream = jest.fn();
    (createReactAgent as jest.Mock).mockReturnValue({
      stream: mockAgentStream,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LangChainAgentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'ollama') return { host: 'localhost', port: 11434 };
              return null;
            }),
          },
        },
        {
          provide: ToolsService,
          useValue: {
            listTools: jest.fn().mockResolvedValue([
              {
                name: 'create_project',
                description: 'Create a project',
                inputSchema: {
                  type: 'object',
                  properties: { name: { type: 'string' } },
                  required: ['name'],
                },
              },
            ]),
          },
        },
        {
          provide: MCPToolExecutor,
          useValue: {
            executeToolCall: jest.fn(),
          },
        },
        {
          provide: ModelInitializerService,
          useValue: {
            getModelConfig: jest
              .fn()
              .mockReturnValue({ name: 'mock-model', temperature: 0.7 }),
          },
        },
        {
          provide: WorkflowControlService,
          useValue: {
            extractThinkingTokens: jest
              .fn()
              .mockReturnValue({ thinking: [], cleanContent: 'content' }),
            filterThinkingTokens: jest.fn((content) => content),
          },
        },
        {
          provide: SystemPromptBuilder,
          useValue: {
            buildSystemPrompt: jest.fn().mockResolvedValue({
              template: {
                formatMessages: jest
                  .fn()
                  .mockResolvedValue([{ content: 'System prompt' }]),
              },
              variables: {},
            }),
          },
        },
        {
          provide: ToolFactory,
          useValue: {
            createTools: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<LangChainAgentService>(LangChainAgentService);
    toolsService = module.get<ToolsService>(ToolsService);
    mcpExecutor = module.get<MCPToolExecutor>(MCPToolExecutor);
    systemPromptBuilder = module.get<SystemPromptBuilder>(SystemPromptBuilder);
    workflowControl = module.get<WorkflowControlService>(
      WorkflowControlService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initializeAgent', () => {
    let toolFactory: { createTools: jest.Mock };

    beforeEach(() => {
      toolFactory = {
        createTools: jest.fn().mockResolvedValue([]),
      };
    });

    it('should initialize agent with tools', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LangChainAgentService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key) => {
                if (key === 'ollama') return { host: 'localhost', port: 11434 };
                return null;
              }),
            },
          },
          {
            provide: ToolsService,
            useValue: {
              listTools: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: MCPToolExecutor,
            useValue: {
              executeToolCall: jest.fn(),
            },
          },
          {
            provide: ModelInitializerService,
            useValue: {
              getModelConfig: jest
                .fn()
                .mockReturnValue({ name: 'mock-model', temperature: 0.7 }),
            },
          },
          {
            provide: WorkflowControlService,
            useValue: {
              extractThinkingTokens: jest
                .fn()
                .mockReturnValue({ thinking: [], cleanContent: 'content' }),
              filterThinkingTokens: jest.fn((content) => content),
            },
          },
          {
            provide: SystemPromptBuilder,
            useValue: {
              buildSystemPrompt: jest.fn().mockResolvedValue({
                template: {
                  formatMessages: jest
                    .fn()
                    .mockResolvedValue([{ content: 'System prompt' }]),
                },
                variables: {},
              }),
            },
          },
          {
            provide: ToolFactory,
            useValue: toolFactory,
          },
        ],
      }).compile();

      service = module.get<LangChainAgentService>(LangChainAgentService);
      toolsService = module.get<ToolsService>(ToolsService);
      mcpExecutor = module.get<MCPToolExecutor>(MCPToolExecutor);
      systemPromptBuilder =
        module.get<SystemPromptBuilder>(SystemPromptBuilder);
      workflowControl = module.get<WorkflowControlService>(
        WorkflowControlService
      );

      await service.initializeAgent('user-123', 'conv-123');

      expect(toolFactory.createTools).toHaveBeenCalled();
      expect(createReactAgent).toHaveBeenCalled();
      expect(service.isInitialized()).toBe(true);
    });

    it('should not re-initialize if already initialized', async () => {
      await service.initializeAgent('user-123', 'conv-123');
      const callCount = (createReactAgent as jest.Mock).mock.calls.length;

      await service.initializeAgent('user-123', 'conv-123');
      expect((createReactAgent as jest.Mock).mock.calls.length).toBe(callCount);
    });

    it('should handle tool normalization with various schema types', async () => {
      toolFactory.createTools.mockResolvedValue([
        {
          name: 'complex_tool',
          description: 'Complex',
          inputSchema: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              metadata: { type: 'object' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      ]);

      await service.initializeAgent('user-123', 'conv-123');
      expect(createReactAgent).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset initialization state', async () => {
      await service.initializeAgent('user-123', 'conv-123');
      expect(service.isInitialized()).toBe(true);

      service.reset();
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('executeAgent', () => {
    beforeEach(async () => {
      await service.initializeAgent('user-123', 'conv-123');
    });

    it('should execute agent workflow successfully', async () => {
      // Mock stream output
      const mockFinalState = {
        messages: [
          mockMsg('system', 'System'),
          mockMsg('human', 'Hello'),
          mockMsg('ai', 'Response content'),
        ],
      };

      // Mock an async generator for the stream
      async function* generator() {
        yield mockFinalState;
      }
      mockAgentStream.mockReturnValue(generator());

      const result = await service.executeAgent(
        'Hello',
        [],
        mockProfile,
        mockPersona
      );

      expect(systemPromptBuilder.buildSystemPrompt).toHaveBeenCalled();
      expect(mockAgentStream).toHaveBeenCalled();
      expect(result.output).toBe('Response content');
    });

    it('should handle thinking tokens in stream', async () => {
      (workflowControl.extractThinkingTokens as jest.Mock).mockReturnValue({
        thinking: ['Thinking...'],
        cleanContent: 'Response',
      });

      const mockState = {
        messages: [
          mockMsg('ai', '<think>Thinking...</think>Response', {
            tool_calls: [],
          }),
        ],
      };

      async function* generator() {
        yield mockState;
      }
      mockAgentStream.mockReturnValue(generator());

      const onProgress = jest.fn();
      await service.executeAgent(
        'Hello',
        [],
        mockProfile,
        mockPersona,
        undefined,
        onProgress
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'thinking',
          content: expect.objectContaining({ text: 'Thinking...' }),
        })
      );
    });

    it('should detect and report tool calls', async () => {
      const toolCall = {
        name: 'create_project',
        args: { name: 'Test' },
        id: 'call_1',
      };
      const mockState = {
        messages: [mockMsg('ai', '', { tool_calls: [toolCall] })],
      };

      async function* generator() {
        yield mockState;
      }
      mockAgentStream.mockReturnValue(generator());

      const onProgress = jest.fn();
      await service.executeAgent(
        'Create project',
        [],
        mockProfile,
        mockPersona,
        undefined,
        onProgress
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_start',
          content: { tool: 'create_project', input: { name: 'Test' } },
        })
      );
    });

    it('should handle tool outputs', async () => {
      // Mock a tool output message
      const toolOutputMsg = mockMsg('tool', 'Success', {
        name: 'create_project',
        tool_call_id: 'call_1',
      });

      const mockState = {
        messages: [
          mockMsg('ai', '', {
            tool_calls: [{ id: 'call_1', name: 'create_project', args: {} }],
          }),
          toolOutputMsg,
        ],
      };

      async function* generator() {
        yield mockState;
      }
      mockAgentStream.mockReturnValue(generator());

      const onProgress = jest.fn();
      const result = await service.executeAgent(
        'Create project',
        [],
        mockProfile,
        mockPersona,
        undefined,
        onProgress
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool_end',
          content: expect.objectContaining({
            tool: 'create_project',
            output: 'Success',
          }),
        })
      );

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].output).toBe('Success');
    });

    it('should fallback to manual JSON parsing if no tool calls detected but JSON in output', async () => {
      // Simulate model outputting JSON instead of tool call
      const jsonOutput = `Here is the JSON: { "name": "create_project", "arguments": { "name": "Manual" } }`;
      const mockState = {
        messages: [mockMsg('ai', jsonOutput, { tool_calls: [] })],
      };

      async function* generator() {
        yield mockState;
      }
      mockAgentStream.mockReturnValue(generator());

      (mcpExecutor.executeToolCall as jest.Mock).mockResolvedValue({
        result: 'Manual Success',
      });

      const result = await service.executeAgent(
        'Create project manually',
        [],
        mockProfile,
        mockPersona
      );

      expect(mcpExecutor.executeToolCall).toHaveBeenCalled();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].tool).toBe('create_project');
      expect(result.output).toContain("I've executed the create_project tool");
    });
  });
});
