import { z } from 'zod';
import {
  ToolFactory,
  getToolResultContent,
  TOOL_OUTPUT_BLACKLIST,
  TOOL_RESULT_SUMMARIES,
} from './tool-factory.service';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ToolsService } from './tools.service';

describe('getToolResultContent', () => {
  it('returns the summary message for blacklisted tools', () => {
    expect(getToolResultContent('list_tools', { anything: true })).toBe(
      TOOL_RESULT_SUMMARIES['list_tools']
    );
  });

  it('falls back to a default message for a blacklisted tool with no summary registered', () => {
    const originalSummary = TOOL_RESULT_SUMMARIES['list_tools'];
    delete TOOL_RESULT_SUMMARIES['list_tools'];
    expect(getToolResultContent('list_tools', {})).toBe(
      'Tool executed successfully'
    );
    TOOL_RESULT_SUMMARIES['list_tools'] = originalSummary;
  });

  it('returns string output as-is', () => {
    expect(getToolResultContent('create_task', 'plain text result')).toBe(
      'plain text result'
    );
  });

  it('JSON-stringifies non-string output', () => {
    expect(getToolResultContent('create_task', { id: 1 })).toBe(
      JSON.stringify({ id: 1 }, null, 2)
    );
  });

  it('confirms the default blacklist contains list_tools', () => {
    expect(TOOL_OUTPUT_BLACKLIST).toContain('list_tools');
  });
});

describe('ToolFactory', () => {
  let toolsService: jest.Mocked<Pick<ToolsService, 'listTools'>>;
  let mcpExecutor: jest.Mocked<Pick<MCPToolExecutor, 'executeToolCall'>>;
  let factory: ToolFactory;

  const sampleMcpTool = {
    name: 'create_task',
    description: 'Create a task',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        priority: { type: 'string', enum: ['low', 'high'] },
        estimatedHours: { type: 'number' },
        completed: { type: 'boolean' },
        tags: { type: 'array' },
        metadata: { type: 'object' },
        anything: {},
        userId: { type: 'string' },
      },
      required: ['title', 'userId'],
    },
  } as any;

  beforeEach(() => {
    toolsService = { listTools: jest.fn() };
    mcpExecutor = { executeToolCall: jest.fn() };
    factory = new ToolFactory(toolsService as any, mcpExecutor as any);
  });

  describe('createTools', () => {
    it('creates a prioritized tool list including the list_tools discovery tool', async () => {
      toolsService.listTools.mockResolvedValue([sampleMcpTool]);
      const tools = await factory.createTools({ userId: 'u1' });
      expect(tools.map((t) => t.name)).toEqual(['list_tools', 'create_task']);
    });

    it('continues with an empty tool list when listTools throws', async () => {
      toolsService.listTools.mockRejectedValue(new Error('mcp down'));
      const tools = await factory.createTools({ userId: 'u1' });
      expect(tools.map((t) => t.name)).toEqual(['list_tools']);
    });

    it('skips a tool that fails conversion without throwing', async () => {
      const badTool = { name: 'bad_tool', inputSchema: null };
      Object.defineProperty(badTool, 'inputSchema', {
        get() {
          throw new Error('schema blew up');
        },
      });
      toolsService.listTools.mockResolvedValue([sampleMcpTool, badTool as any]);
      const tools = await factory.createTools({ userId: 'u1' });
      expect(tools.map((t) => t.name)).toEqual(['list_tools', 'create_task']);
    });
  });

  describe('createMCPTool', () => {
    it('builds a DynamicStructuredTool with a zod schema derived from the MCP schema', () => {
      const tool = factory.createMCPTool(sampleMcpTool, { userId: 'u1' });
      expect(tool).not.toBeNull();
      expect(tool!.name).toBe('create_task');
      expect(tool!.description).toBe('Create a task');
    });

    it('falls back to a default description when the MCP tool has none', () => {
      const tool = factory.createMCPTool(
        { name: 'no_desc', inputSchema: { properties: {} } } as any,
        { userId: 'u1' }
      );
      expect(tool!.description).toBe('Tool: no_desc');
    });

    it('returns null and logs when tool creation throws', () => {
      const badTool = { name: 'broken_tool' } as any;
      Object.defineProperty(badTool, 'inputSchema', {
        get() {
          throw new Error('boom');
        },
      });
      expect(factory.createMCPTool(badTool, { userId: 'u1' })).toBeNull();
    });

    it('enriches input with userId/profileId/createdBy and returns the success content', async () => {
      mcpExecutor.executeToolCall.mockResolvedValue({
        success: true,
        result: { ok: true },
      } as any);
      const tool = factory.createMCPTool(sampleMcpTool, {
        userId: 'user-1',
        conversationId: 'conv-1',
      });
      const output = await tool!.func({ title: 'Do it' } as any);
      expect(output).toBe(JSON.stringify({ ok: true }, null, 2));

      const [toolCall, context] = mcpExecutor.executeToolCall.mock.calls[0];
      expect(toolCall.function.name).toBe('create_task');
      const args = JSON.parse(toolCall.function.arguments);
      expect(args).toMatchObject({
        title: 'Do it',
        userId: 'user-1',
        profileId: 'user-1',
        createdBy: 'user-1',
      });
      expect(context).toMatchObject({
        userId: 'user-1',
        conversationId: 'conv-1',
      });
    });

    it('preserves explicit userId/profileId/createdBy values from input', async () => {
      mcpExecutor.executeToolCall.mockResolvedValue({
        success: true,
        result: 'done',
      } as any);
      const tool = factory.createMCPTool(sampleMcpTool, {
        userId: 'default-u',
      });
      await tool!.func({
        title: 'x',
        userId: 'explicit-u',
        profileId: 'explicit-p',
        createdBy: 'explicit-c',
      } as any);
      const [toolCall] = mcpExecutor.executeToolCall.mock.calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      expect(args.userId).toBe('explicit-u');
      expect(args.profileId).toBe('explicit-p');
      expect(args.createdBy).toBe('explicit-c');
    });

    it('returns a validation-specific error message for validation failures', async () => {
      mcpExecutor.executeToolCall.mockResolvedValue({
        success: false,
        error: { message: 'required property missing: title' },
      } as any);
      const tool = factory.createMCPTool(sampleMcpTool, { userId: 'u1' });
      const output = await tool!.func({ title: 'x' } as any);
      expect(output).toContain('Error: Validation failed');
      expect(output).toContain('required property missing: title');
    });

    it('returns a generic error message for non-validation failures', async () => {
      mcpExecutor.executeToolCall.mockResolvedValue({
        success: false,
        error: { message: 'downstream service unavailable' },
      } as any);
      const tool = factory.createMCPTool(sampleMcpTool, { userId: 'u1' });
      const output = await tool!.func({ title: 'x' } as any);
      expect(output).toBe('Error: downstream service unavailable');
    });

    it('falls back to "Unknown error" when the failure has no error message', async () => {
      mcpExecutor.executeToolCall.mockResolvedValue({
        success: false,
      } as any);
      const tool = factory.createMCPTool(sampleMcpTool, { userId: 'u1' });
      const output = await tool!.func({ title: 'x' } as any);
      expect(output).toBe('Error: Unknown error');
    });
  });

  describe('createListToolsTool', () => {
    it('formats tool descriptions including required/optional and enum values', async () => {
      const listTool = factory.createListToolsTool([sampleMcpTool]);
      expect(listTool.name).toBe('list_tools');
      const output = await listTool.func({} as any);
      expect(output).toContain('### create_task');
      expect(output).toContain('title (string) **[REQUIRED]**: Task title');
      expect(output).toContain(
        'priority (string) (values: low, high) [optional]'
      );
    });

    it('reports "No parameters" for a tool without an input schema', async () => {
      const listTool = factory.createListToolsTool([
        { name: 'bare_tool' } as any,
      ]);
      const output = await listTool.func({} as any);
      expect(output).toContain('### bare_tool');
      expect(output).toContain('No parameters');
    });

    it('uses default text when tool/parameter descriptions are missing', async () => {
      const listTool = factory.createListToolsTool([
        {
          name: 'no_desc_tool',
          inputSchema: { properties: { x: { type: 'string' } } },
        } as any,
      ]);
      const output = await listTool.func({} as any);
      expect(output).toContain('No description');
    });
  });

  describe('jsonSchemaToZod (via createMCPTool)', () => {
    it('handles every primitive type, arrays, objects, and untyped/any fields', () => {
      const tool = factory.createMCPTool(sampleMcpTool, { userId: 'u1' });
      const shape = (tool!.schema as z.ZodObject<any>).shape;
      expect(shape.title).toBeDefined();
      expect(shape.priority).toBeDefined();
      expect(shape.estimatedHours).toBeDefined();
      expect(shape.completed).toBeDefined();
      expect(shape.tags).toBeDefined();
      expect(shape.metadata).toBeDefined();
      expect(shape.anything).toBeDefined();
    });

    it('returns an empty object schema when the MCP tool has no properties', () => {
      const tool = factory.createMCPTool(
        { name: 'empty_schema', inputSchema: {} } as any,
        { userId: 'u1' }
      );
      const shape = (tool!.schema as z.ZodObject<any>).shape;
      expect(Object.keys(shape)).toEqual([]);
    });

    it('treats auto-injected fields as optional even when marked required', () => {
      const tool = factory.createMCPTool(
        {
          name: 'auto_inject',
          inputSchema: {
            properties: {
              userId: { type: 'string' },
              title: { type: 'string' },
            },
            required: ['userId', 'title'],
          },
        } as any,
        { userId: 'u1' }
      );
      const result = (tool!.schema as z.ZodObject<any>).safeParse({
        title: 'set',
      });
      expect(result.success).toBe(true);
    });
  });
});
