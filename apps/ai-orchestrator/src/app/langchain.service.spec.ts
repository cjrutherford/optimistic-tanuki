import { Test, TestingModule } from '@nestjs/testing';
import { LangChainService } from './langchain.service';
import { ConfigService } from '@nestjs/config';
import { ToolsService } from './tools.service';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ModelInitializerService } from './model-initializer.service';
import { WorkflowControlService } from './workflow-control.service';
import { SystemPromptBuilder } from './system-prompt-builder.service';
import { ChatOllama } from '@langchain/ollama';
import { AIMessage } from '@langchain/core/messages';

// Mock ChatOllama
jest.mock('@langchain/ollama', () => {
  return {
    ChatOllama: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({ content: 'AI Response' }),
      bindTools: jest.fn().mockReturnThis(),
      stream: jest.fn(), // Will mock return value in tests
    })),
  };
});

describe('LangChainService', () => {
  let service: LangChainService;
  let toolsService: ToolsService;
  let mcpExecutor: MCPToolExecutor;
  let systemPromptBuilder: SystemPromptBuilder;
  let workflowControl: WorkflowControlService;
  let mockConversationalLLM: any;
  let mockToolCallingLLM: any;

  const mockProfile = { id: 'user-123' } as any;
  const mockPersona = { id: 'persona-123' } as any;

  beforeEach(async () => {
    // Reset mocks
    (ChatOllama as unknown as jest.Mock).mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LangChainService,
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
            listResources: jest.fn().mockResolvedValue([]),
            getResource: jest.fn().mockResolvedValue(null),
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
            getModelConfig: jest.fn().mockReturnValue({ name: 'mock-model', temperature: 0.7 }),
          },
        },
        {
          provide: WorkflowControlService,
          useValue: {
            detectWorkflow: jest.fn().mockResolvedValue({ type: 'conversational', requiresToolCalling: false }),
            extractThinkingTokens: jest.fn().mockReturnValue({ thinking: [], filtered: 'AI Response' }),
          },
        },
        {
          provide: SystemPromptBuilder,
          useValue: {
            buildSystemPrompt: jest.fn().mockResolvedValue({
              template: {
                formatMessages: jest.fn().mockResolvedValue([{ content: 'System prompt' }]),
              },
              variables: {},
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LangChainService>(LangChainService);
    toolsService = module.get<ToolsService>(ToolsService);
    mcpExecutor = module.get<MCPToolExecutor>(MCPToolExecutor);
    systemPromptBuilder = module.get<SystemPromptBuilder>(SystemPromptBuilder);
    workflowControl = module.get<WorkflowControlService>(WorkflowControlService);
    
    // Get the mock instances
    const results = (ChatOllama as unknown as jest.Mock).mock.results;
    if (results.length > 0) {
      mockConversationalLLM = results[0].value;
    }
    if (results.length > 1) {
      mockToolCallingLLM = results[1].value;
    } else {
      mockToolCallingLLM = mockConversationalLLM;
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Helper Methods', () => {
    const s = () => service as any;

    it('getAvailableResources should return formatted list', async () => {
      (toolsService.listResources as jest.Mock).mockResolvedValue([
        { uri: 'res1', description: 'desc1' },
      ]);
      const result = await s().getAvailableResources();
      expect(result).toContain('Available MCP Resources');
      expect(result).toContain('res1: desc1');
    });

    it('getAvailableResources should handle empty list', async () => {
      (toolsService.listResources as jest.Mock).mockResolvedValue([]);
      const result = await s().getAvailableResources();
      expect(result).toBe('No additional resources available.');
    });

    it('enrichWithProjectContext should fetch context if project ID present', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000';
      (toolsService.getResource as jest.Mock).mockResolvedValue({
        _meta: { contents: [{ text: 'Context content' }] },
      });

      const result = await s().enrichWithProjectContext([], `Check project: ${projectId}`);
      expect(toolsService.getResource).toHaveBeenCalledWith(`project://${projectId}/context`);
      expect(result).toContain('PROJECT CONTEXT');
      expect(result).toContain('Context content');
    });
  });

  describe('createTools (private)', () => {
    it('should create tools including list_tools', async () => {
      (toolsService.listTools as jest.Mock).mockResolvedValue([
        { 
          name: 'project_tool', 
          description: 'desc', 
          inputSchema: { properties: { userId: { type: 'string' } } } 
        }
      ]);

      // Access private createTools via executeConversation or direct cast
      const s = service as any;
      const tools = await s.createTools('user-1', 'conv-1');
      
      expect(tools.length).toBeGreaterThan(0);
      const listTools = tools.find((t: any) => t.name === 'list_tools');
      expect(listTools).toBeDefined();

      // Test list_tools execution
      const listResult = await listTools.func({});
      expect(listResult).toContain('AVAILABLE TOOLS');
      expect(listResult).toContain('project_tool');
    });

    it('should inject context parameters into tool calls', async () => {
        const mockToolImpl = {
            name: 'test_tool',
            inputSchema: { 
                properties: { 
                    userId: { type: 'string' },
                    createdBy: { type: 'string' },
                    owner: { type: 'string' }
                } 
            }
        };
        (toolsService.listTools as jest.Mock).mockResolvedValue([mockToolImpl]);
        (mcpExecutor.executeToolCall as jest.Mock).mockResolvedValue({ success: true, result: 'ok' });

        const s = service as any;
        const tools = await s.createTools('user-1', 'conv-1');
        const tool = tools.find((t: any) => t.name === 'test_tool');

        await tool.func({ someArg: 'val' });

        // Verify mcpExecutor called with injected params
        expect(mcpExecutor.executeToolCall).toHaveBeenCalledWith(
            expect.objectContaining({
                function: expect.objectContaining({
                    arguments: expect.stringContaining('"userId":"user-1"')
                })
            }),
            expect.anything()
        );
    });
  });

  describe('executeConversation', () => {
    it('should execute simple conversation without tools', async () => {
      const result = await service.executeConversation(
        mockPersona,
        mockProfile,
        [],
        'Hello',
        'conv-123'
      );

      expect(systemPromptBuilder.buildSystemPrompt).toHaveBeenCalled();
      expect(mockConversationalLLM.invoke).toHaveBeenCalled();
      expect(result.response).toBe('AI Response');
    });

    it('should use tool calling model if workflow requires it', async () => {
      (workflowControl.detectWorkflow as jest.Mock).mockResolvedValue({ 
        type: 'complex', 
        requiresToolCalling: true 
      });

      (toolsService.listTools as jest.Mock).mockResolvedValue([{ name: 'tool1', inputSchema: {} }]);

      await service.executeConversation(
        mockPersona,
        mockProfile,
        [{ role: 'user', content: 'prev' }] as any,
        'Use tool',
        'conv-123'
      );

      expect(mockToolCallingLLM.bindTools).toHaveBeenCalled();
      expect(mockToolCallingLLM.invoke).toHaveBeenCalled();
    });

    it('should execute tool calls returned by LLM', async () => {
        (workflowControl.detectWorkflow as jest.Mock).mockResolvedValue({ 
            type: 'complex', 
            requiresToolCalling: true 
        });
        (toolsService.listTools as jest.Mock).mockResolvedValue([{ name: 'tool1', inputSchema: {} }]);

        // Mock LLM response with tool calls
        mockToolCallingLLM.invoke.mockResolvedValueOnce({
            content: '',
            tool_calls: [{ name: 'tool1', args: { arg: 'val' }, id: 'call_1' }]
        }).mockResolvedValueOnce({
            content: 'Final response'
        });

        (mcpExecutor.executeToolCall as jest.Mock).mockResolvedValue({ result: 'success' });
        (workflowControl.extractThinkingTokens as jest.Mock).mockReturnValue({ thinking: [], filtered: 'Final response' });

        const result = await service.executeConversation(
            mockPersona,
            mockProfile,
            [{ role: 'user', content: 'prev' }] as any,
            'Use tool',
            'conv-123'
        );

        expect(mcpExecutor.executeToolCall).toHaveBeenCalled();
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].output).toBe('success');
        expect(result.response).toBe('Final response');
    });
  });

  describe('streamConversation', () => {
    it('should stream chunks', async () => {
        // Mock stream
        async function* generator() {
            yield { content: 'Chunk 1' };
            yield { content: 'Chunk 2' };
        }
        mockConversationalLLM.stream.mockReturnValue(generator());

        const stream = service.streamConversation(
            mockPersona,
            mockProfile,
            [], // First message
            'Hello',
            'conv-123'
        );

        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].content).toEqual({ text: 'Chunk 1' });
    });
  });
});