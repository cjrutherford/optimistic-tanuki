/**
 * LangChain LLM Behavior Tests
 *
 * These tests validate how the LLM responds to various scenarios
 * and which tools it calls. They help ensure the prompt engineering
 * and tool binding are working correctly.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { LangChainService } from './langchain.service';
import { ToolsService } from './tools.service';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ConfigService } from '@nestjs/config';
import {
  PersonaTelosDto,
  ProfileDto,
  ChatMessage,
} from '@optimistic-tanuki/models';

describe('LangChain LLM Behavior Tests', () => {
  let service: LangChainService;
  let toolsService: ToolsService;
  let mcpExecutor: MCPToolExecutor;

  const mockPersona: any = {
    id: 'persona-123',
    name: 'AI Assistant',
    description: 'A helpful AI assistant',
    purpose: 'Help users manage projects',
    ethos: 'Be helpful and accurate',
    logoUrl: '',
    systemPrompt: '',
  };

  const mockProfile: any = {
    id: 'user-456',
    profileName: 'Test User',
    email: 'test@example.com',
  };

  const mockTools = [
    {
      name: 'list_projects',
      description: 'List all projects for a user',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
        required: ['userId'],
      },
    },
    {
      name: 'query_projects',
      description: 'Query projects by name or other criteria',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
          name: { type: 'string', description: 'Project name to search for' },
        },
        required: ['userId'],
      },
    },
    {
      name: 'create_project',
      description: 'Create a new project',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID (owner)' },
          name: { type: 'string', description: 'Project name' },
          description: { type: 'string', description: 'Project description' },
          status: { type: 'string', description: 'Project status' },
        },
        required: ['userId', 'name'],
      },
    },
    {
      name: 'create_task',
      description: 'Create a new task in a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description' },
          status: {
            type: 'string',
            description: 'Task status (TODO, IN_PROGRESS, DONE)',
          },
          priority: {
            type: 'string',
            description: 'Priority (LOW, MEDIUM, HIGH)',
          },
          createdBy: { type: 'string', description: 'User ID of creator' },
        },
        required: ['projectId', 'title', 'createdBy'],
      },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LangChainService,
        {
          provide: ToolsService,
          useValue: {
            listTools: jest.fn().mockResolvedValue(mockTools),
            listResources: jest.fn().mockResolvedValue([]),
            getResource: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: MCPToolExecutor,
          useValue: {
            executeToolCall: jest.fn().mockResolvedValue({
              success: true,
              result: { message: 'Tool executed successfully' },
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ollama') {
                return { host: 'localhost', port: 11434 };
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LangChainService>(LangChainService);
    toolsService = module.get<ToolsService>(ToolsService);
    mcpExecutor = module.get<MCPToolExecutor>(MCPToolExecutor);
  });

  describe('Tool Discovery', () => {
    it('should expose list_tools as a callable tool', async () => {
      // This test verifies that list_tools is available
      const tools = await (service as any).createTools(
        mockProfile.id,
        'conv-123'
      );

      const listToolsTool = tools.find((t) => t.name === 'list_tools');
      expect(listToolsTool).toBeDefined();
      expect(listToolsTool.name).toBe('list_tools');
      expect(listToolsTool.description).toContain('List all available tools');
    });

    it('list_tools should return all MCP tools with schemas', async () => {
      const tools = await (service as any).createTools(
        mockProfile.id,
        'conv-123'
      );
      const listToolsTool = tools.find((t) => t.name === 'list_tools');

      const result = await listToolsTool.func({});

      // Result should be a string containing tool information
      expect(typeof result).toBe('string');
      expect(result).toContain('list_projects');
      expect(result).toContain('create_project');
      expect(result).toContain('create_task');
      expect(result).toContain('query_projects');
    });

    it('list_tools should include parameter information', async () => {
      const tools = await (service as any).createTools(
        mockProfile.id,
        'conv-123'
      );
      const listToolsTool = tools.find((t) => t.name === 'list_tools');

      const result = await listToolsTool.func({});

      // Should describe parameters
      expect(result).toContain('userId');
      expect(result).toContain('projectId');
      expect(result).toContain('name');
      expect(result).toContain('title');
    });
  });

  describe('Tool Binding', () => {
    it('should bind all tools including list_tools to LLM', async () => {
      const tools = await (service as any).createTools(
        mockProfile.id,
        'conv-123'
      );

      // Should have MCP tools + list_tools
      expect(tools.length).toBe(mockTools.length + 1);

      // Verify list_tools is included
      const listToolsTool = tools.find((t) => t.name === 'list_tools');
      expect(listToolsTool).toBeDefined();
    });

    it('should convert JSON schemas to Zod schemas correctly', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Project name' },
          count: { type: 'number', description: 'Count value' },
          active: { type: 'boolean', description: 'Is active' },
        },
        required: ['name'],
      };

      const zodSchema = (service as any).convertToZodSchema(jsonSchema);

      expect(zodSchema).toBeDefined();
      // Zod schema should be usable
      const parsed = zodSchema.safeParse({
        name: 'Test',
        count: 5,
        active: true,
      });
      expect(parsed.success).toBe(true);
    });

    it('should handle optional parameters correctly', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          required_field: { type: 'string' },
          optional_field: { type: 'string' },
        },
        required: ['required_field'],
      };

      const zodSchema = (service as any).convertToZodSchema(jsonSchema);

      // Should accept object with only required field
      const parsed = zodSchema.safeParse({ required_field: 'value' });
      expect(parsed.success).toBe(true);
    });
  });

  describe('System Prompt Generation', () => {
    it('should include tool discovery guidance', () => {
      const systemPrompt = (service as any).createSystemPrompt(
        mockPersona,
        mockProfile,
        'Previous conversation summary'
      );

      expect(systemPrompt).toContain('list_tools');
      expect(systemPrompt).toContain('discover');
      expect(systemPrompt).toContain(mockProfile.id);
    });

    it('should include user context', () => {
      const systemPrompt = (service as any).createSystemPrompt(
        mockPersona,
        mockProfile,
        'Conversation summary'
      );

      expect(systemPrompt).toContain(mockProfile.id);
      expect(systemPrompt).toContain(mockProfile.profileName);
    });

    it('should include operational guidelines', () => {
      const systemPrompt = (service as any).createSystemPrompt(
        mockPersona,
        mockProfile,
        'Summary'
      );

      expect(systemPrompt).toContain('NO ID HALLUCINATION');
      expect(systemPrompt).toContain('ONE TOOL AT A TIME');
      expect(systemPrompt).toContain('JSON ONLY OUTPUT');
    });

    it('should include project context when provided', () => {
      const projectContext =
        '\n\n# PROJECT CONTEXT\nProject: Test Project (proj-123)';
      const systemPrompt = (service as any).createSystemPrompt(
        mockPersona,
        mockProfile,
        'Summary',
        projectContext
      );

      expect(systemPrompt).toContain('PROJECT CONTEXT');
      expect(systemPrompt).toContain('proj-123');
    });
  });

  describe('Chat History Conversion', () => {
    it('should convert user messages correctly', () => {
      const messages: any[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          senderId: 'user-456',
          recipientId: ['ai-123'],
          content: 'Hello',
          timestamp: new Date(),
          role: 'user',
          type: 'chat',
        },
      ];

      const converted = (service as any).convertChatHistory(messages);

      expect(converted.length).toBe(1);
      expect(converted[0].constructor.name).toBe('HumanMessage');
      expect(converted[0].content).toBe('Hello');
    });

    it('should convert assistant messages correctly', () => {
      const messages: any[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          senderId: 'ai-123',
          recipientId: ['user-456'],
          content: 'Hi there!',
          timestamp: new Date(),
          role: 'assistant',
          type: 'chat',
        },
      ];

      const converted = (service as any).convertChatHistory(messages);

      expect(converted.length).toBe(1);
      expect(converted[0].constructor.name).toBe('AIMessage');
      expect(converted[0].content).toBe('Hi there!');
    });

    it('should handle mixed message types', () => {
      const messages: any[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          senderId: 'user-456',
          recipientId: ['ai-123'],
          content: 'Hello',
          timestamp: new Date(),
          role: 'user',
          type: 'chat',
        },
        {
          id: 'msg-2',
          conversationId: 'conv-123',
          senderId: 'ai-123',
          recipientId: ['user-456'],
          content: 'Hi!',
          timestamp: new Date(),
          role: 'assistant',
          type: 'chat',
        },
      ];

      const converted = (service as any).convertChatHistory(messages);

      expect(converted.length).toBe(2);
      expect(converted[0].constructor.name).toBe('HumanMessage');
      expect(converted[1].constructor.name).toBe('AIMessage');
    });
  });

  describe('Project Context Enrichment', () => {
    it('should detect projectId in conversation', async () => {
      const messages: any[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          senderId: 'user-456',
          recipientId: ['ai-123'],
          content: 'Tell me about project: abc-123-def-456-ghi-789-012-345',
          timestamp: new Date(),
          role: 'user',
          type: 'chat',
        },
      ];

      jest.spyOn(toolsService, 'getResource').mockResolvedValue({
        _meta: {
          contents: [
            {
              uri: 'project://abc-123-def-456-ghi-789-012-345/context',
              text: 'Project Context Data',
            },
          ],
        },
      } as any);

      const context = await (service as any).enrichWithProjectContext(
        messages,
        'More info'
      );

      expect(context).toContain('PROJECT CONTEXT');
      expect(context).toContain('Project Context Data');
    });

    it('should return empty string when no projectId found', async () => {
      const messages: any[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          senderId: 'user-456',
          recipientId: ['ai-123'],
          content: 'Hello',
          timestamp: new Date(),
          role: 'user',
          type: 'chat',
        },
      ];

      const context = await (service as any).enrichWithProjectContext(
        messages,
        'More'
      );

      expect(context).toBe('');
    });
  });

  describe('Tool Execution Integration', () => {
    it('should execute tools through MCPToolExecutor', async () => {
      const tools = await (service as any).createTools(
        mockProfile.id,
        'conv-123'
      );
      const createProjectTool = tools.find((t) => t.name === 'create_project');

      const result = await createProjectTool.func({
        name: 'Test Project',
        description: 'A test',
      });

      expect(mcpExecutor.executeToolCall).toHaveBeenCalled();
      expect(result).toContain('successfully');
    });

    it('should enrich tool input with userId and profileId', async () => {
      const tools = await (service as any).createTools('user-789', 'conv-123');
      const createProjectTool = tools.find((t) => t.name === 'create_project');

      await createProjectTool.func({ name: 'Test' });

      const call = (mcpExecutor.executeToolCall as jest.Mock).mock.calls[0];
      const toolCall = call[0];
      const parsedArgs = JSON.parse(toolCall.function.arguments);

      expect(parsedArgs.userId).toBe('user-789');
      expect(parsedArgs.profileId).toBe('user-789');
    });

    it('should throw error when tool execution fails', async () => {
      jest.spyOn(mcpExecutor, 'executeToolCall').mockResolvedValue({
        success: false,
        error: { message: 'Tool failed', code: 'ERROR' },
      } as any);

      const tools = await (service as any).createTools(
        mockProfile.id,
        'conv-123'
      );
      const createProjectTool = tools.find((t) => t.name === 'create_project');

      await expect(createProjectTool.func({ name: 'Test' })).rejects.toThrow(
        'Tool failed'
      );
    });
  });
});
