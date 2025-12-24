import { Test, TestingModule } from '@nestjs/testing';
import { MCPToolExecutor } from './mcp-tool-executor';
import { ToolsService } from './tools.service';
import { MCPErrorCode, ToolExecutionContext } from '@optimistic-tanuki/models';

describe('MCPToolExecutor', () => {
  let executor: MCPToolExecutor;
  let toolsService: ToolsService;

  const mockContext: ToolExecutionContext = {
    userId: 'user-123',
    profileId: 'profile-456',
    conversationId: 'conv-789',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MCPToolExecutor,
        {
          provide: ToolsService,
          useValue: {
            callTool: jest.fn(),
            listTools: jest.fn(),
          },
        },
      ],
    }).compile();

    executor = module.get<MCPToolExecutor>(MCPToolExecutor);
    toolsService = module.get<ToolsService>(ToolsService);
  });

  describe('executeToolCall', () => {
    it('should execute a valid tool call successfully', async () => {
      const toolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'list_projects',
          arguments: JSON.stringify({ userId: 'user-123' }),
        },
      };

      const mockResult = { projects: [], count: 0 };
      jest.spyOn(toolsService, 'callTool').mockResolvedValue(mockResult);

      const result = await executor.executeToolCall(toolCall, mockContext);

      expect(result.success).toBe(true);
      expect(result.toolCallId).toBe('call_123');
      expect(result.toolName).toBe('list_projects');
      expect(result.result).toEqual(mockResult);
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.timestamp).toBeInstanceOf(Date);
    });

    it('should reject tool call with invalid context', async () => {
      const toolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'list_projects',
          arguments: '{}',
        },
      };

      const invalidContext = { userId: '' } as any;

      const result = await executor.executeToolCall(toolCall, invalidContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.CONTEXT_MISSING);
      expect(toolsService.callTool).not.toHaveBeenCalled();
    });

    it('should reject invalid tool call', async () => {
      const toolCall = {
        id: '',
        type: 'function' as const,
        function: {
          name: 'list_projects',
          arguments: '{}',
        },
      };

      const result = await executor.executeToolCall(toolCall, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
      expect(toolsService.callTool).not.toHaveBeenCalled();
    });

    it('should handle tool execution failure', async () => {
      const toolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'create_project',
          arguments: JSON.stringify({ name: 'Test' }),
        },
      };

      jest
        .spyOn(toolsService, 'callTool')
        .mockRejectedValue(new Error('Database connection failed'));

      const result = await executor.executeToolCall(toolCall, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.TOOL_EXECUTION_FAILED);
      expect(result.error?.message).toContain('Database connection failed');
    });

    it('should normalize userId in arguments', async () => {
      const toolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'list_projects',
          arguments: '{}',
        },
      };

      jest.spyOn(toolsService, 'callTool').mockResolvedValue({ projects: [] });

      await executor.executeToolCall(toolCall, mockContext);

      expect(toolsService.callTool).toHaveBeenCalledWith('list_projects', {
        userId: 'profile-456',
        profileId: 'profile-456',
        createdBy: 'profile-456',
      });
    });

    it('should normalize create_project arguments', async () => {
      const toolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'create_project',
          arguments: JSON.stringify({ title: 'My Project' }),
        },
      };

      jest.spyOn(toolsService, 'callTool').mockResolvedValue({ id: 'proj-1' });

      await executor.executeToolCall(toolCall, mockContext);

      expect(toolsService.callTool).toHaveBeenCalledWith('create_project', {
        name: 'My Project', // title mapped to name
        userId: 'profile-456',
        profileId: 'profile-456',
        createdBy: 'profile-456',
        status: 'PLANNING',
        description: '',
      });
    });

    it('should normalize members array from string', async () => {
      const toolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'create_project',
          arguments: JSON.stringify({
            name: 'Test',
            members: 'member-1',
          }),
        },
      };

      jest.spyOn(toolsService, 'callTool').mockResolvedValue({ id: 'proj-1' });

      await executor.executeToolCall(toolCall, mockContext);

      const call = (toolsService.callTool as jest.Mock).mock.calls[0];
      expect(call[1].members).toEqual(['member-1']);
    });

    it('should normalize create_task arguments', async () => {
      const toolCall = {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'create_task',
          arguments: JSON.stringify({
            title: 'Task 1',
            projectId: 'proj-1',
          }),
        },
      };

      jest.spyOn(toolsService, 'callTool').mockResolvedValue({ id: 'task-1' });

      await executor.executeToolCall(toolCall, mockContext);

      const call = (toolsService.callTool as jest.Mock).mock.calls[0];
      expect(call[1]).toMatchObject({
        title: 'Task 1',
        projectId: 'proj-1',
        createdBy: 'profile-456',
        status: 'TODO',
        priority: 'MEDIUM',
      });
    });
  });

  describe('executeToolCalls', () => {
    it('should execute multiple valid tool calls sequentially', async () => {
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function' as const,
          function: {
            name: 'list_projects',
            arguments: '{}',
          },
        },
        {
          id: 'call_2',
          type: 'function' as const,
          function: {
            name: 'create_project',
            arguments: JSON.stringify({ name: 'New Project' }),
          },
        },
      ];

      jest
        .spyOn(toolsService, 'callTool')
        .mockResolvedValueOnce({ projects: [] })
        .mockResolvedValueOnce({ id: 'proj-1' });

      const results = await executor.executeToolCalls(toolCalls, mockContext);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].toolName).toBe('list_projects');
      expect(results[1].success).toBe(true);
      expect(results[1].toolName).toBe('create_project');
    });

    it('should stop execution if a tool call fails', async () => {
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function' as const,
          function: {
            name: 'list_projects',
            arguments: '{}',
          },
        },
        {
          id: 'call_2',
          type: 'function' as const,
          function: {
            name: 'create_project',
            arguments: '{}',
          },
        },
        {
          id: 'call_3',
          type: 'function' as const,
          function: {
            name: 'list_tasks',
            arguments: '{"projectId": "proj-1"}',
          },
        },
      ];

      jest
        .spyOn(toolsService, 'callTool')
        .mockResolvedValueOnce({ projects: [] })
        .mockRejectedValueOnce(new Error('Failed'));

      const results = await executor.executeToolCalls(toolCalls, mockContext);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(toolsService.callTool).toHaveBeenCalledTimes(2); // Third call not executed
    });

    it('should create error results for invalid tool calls', async () => {
      const toolCalls = [
        {
          id: '',
          type: 'function' as const,
          function: {
            name: 'list_projects',
            arguments: '{}',
          },
        },
      ];

      const results = await executor.executeToolCalls(toolCalls, mockContext);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error?.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
    });

    it('should handle empty tool calls array', async () => {
      const results = await executor.executeToolCalls([], mockContext);

      expect(results).toEqual([]);
      expect(toolsService.callTool).not.toHaveBeenCalled();
    });
  });

  describe('validateResult', () => {
    it('should validate a correct tool result', () => {
      const result = {
        toolCallId: 'call_123',
        toolName: 'list_projects',
        success: true,
        result: { projects: [] },
      };

      const validated = executor.validateResult(result);

      expect(validated).not.toBeNull();
      expect(validated?.success).toBe(true);
    });

    it('should return null for invalid result', () => {
      const result = {
        toolCallId: '',
        toolName: 'list_projects',
        success: true,
      };

      const validated = executor.validateResult(result);

      expect(validated).toBeNull();
    });
  });
});
