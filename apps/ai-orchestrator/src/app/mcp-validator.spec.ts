import { MCPValidator } from './mcp-validator';
import { MCPErrorCode } from '@optimistic-tanuki/models';

describe('MCPValidator', () => {
  let validator: MCPValidator;

  beforeEach(() => {
    validator = new MCPValidator();
  });

  describe('validateToolCall', () => {
    it('should validate a correct tool call', () => {
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'create_project',
          arguments: JSON.stringify({
            name: 'Test Project',
            userId: 'user-123',
          }),
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        id: 'call_123',
        name: 'create_project',
        arguments: { name: 'Test Project', userId: 'user-123' },
      });
      expect(result.error).toBeUndefined();
    });

    it('should reject tool call with empty id', () => {
      const toolCall = {
        id: '',
        type: 'function',
        function: {
          name: 'create_project',
          arguments: '{}',
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
      expect(result.data).toBeUndefined();
    });

    it('should reject tool call with missing type', () => {
      const toolCall = {
        id: 'call_123',
        function: {
          name: 'create_project',
          arguments: '{}',
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
    });

    it('should reject tool call with wrong type', () => {
      const toolCall = {
        id: 'call_123',
        type: 'invalid',
        function: {
          name: 'create_project',
          arguments: '{}',
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
    });

    it('should reject tool call with empty function name', () => {
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: '',
          arguments: '{}',
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
    });

    it('should reject tool call with invalid JSON arguments', () => {
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'create_project',
          arguments: 'not valid json',
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_ARGUMENTS);
      expect(result.error?.message).toContain('Failed to parse tool arguments');
    });

    it('should reject tool call with array arguments', () => {
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'create_project',
          arguments: JSON.stringify(['not', 'an', 'object']),
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_ARGUMENTS);
      expect(result.error?.message).toContain('must be a JSON object');
    });

    it('should reject tool call with null arguments', () => {
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'create_project',
          arguments: 'null',
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_ARGUMENTS);
    });

    it('should accept empty object arguments', () => {
      const toolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'list_projects',
          arguments: '{}',
        },
      };

      const result = validator.validateToolCall(toolCall);

      expect(result.success).toBe(true);
      expect(result.data?.arguments).toEqual({});
    });
  });

  describe('validateToolCalls', () => {
    it('should validate multiple correct tool calls', () => {
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'list_projects',
            arguments: '{"userId": "user-123"}',
          },
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'create_project',
            arguments: '{"name": "Project", "userId": "user-123"}',
          },
        },
      ];

      const result = validator.validateToolCalls(toolCalls);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].name).toBe('list_projects');
      expect(result.data?.[1].name).toBe('create_project');
    });

    it('should fail if any tool call is invalid', () => {
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'list_projects',
            arguments: '{"userId": "user-123"}',
          },
        },
        {
          id: '',
          type: 'function',
          function: {
            name: 'create_project',
            arguments: '{}',
          },
        },
      ];

      const result = validator.validateToolCalls(toolCalls);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
      expect(result.error?.details?.errors).toHaveLength(1);
      expect(result.error?.details?.validCount).toBe(1);
    });

    it('should handle empty array', () => {
      const result = validator.validateToolCalls([]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('validateToolResult', () => {
    it('should validate a successful tool result', () => {
      const toolResult = {
        toolCallId: 'call_123',
        toolName: 'create_project',
        success: true,
        result: { id: 'proj-1', name: 'Test Project' },
        metadata: {
          executionTime: 150,
          timestamp: new Date(),
        },
      };

      const result = validator.validateToolResult(toolResult);

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
      expect(result.data?.result).toEqual({
        id: 'proj-1',
        name: 'Test Project',
      });
    });

    it('should validate a failed tool result with error', () => {
      const toolResult = {
        toolCallId: 'call_123',
        toolName: 'create_project',
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project name is required',
          details: { field: 'name' },
        },
        metadata: {
          executionTime: 50,
        },
      };

      const result = validator.validateToolResult(toolResult);

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(false);
      expect(result.data?.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should fail validation if success=false but no error provided', () => {
      const toolResult = {
        toolCallId: 'call_123',
        toolName: 'create_project',
        success: false,
      };

      const result = validator.validateToolResult(toolResult);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.VALIDATION_FAILED);
      expect(result.error?.message).toContain('no error information');
    });

    it('should reject tool result with empty toolCallId', () => {
      const toolResult = {
        toolCallId: '',
        toolName: 'create_project',
        success: true,
        result: {},
      };

      const result = validator.validateToolResult(toolResult);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.VALIDATION_FAILED);
    });

    it('should reject tool result with empty toolName', () => {
      const toolResult = {
        toolCallId: 'call_123',
        toolName: '',
        success: true,
        result: {},
      };

      const result = validator.validateToolResult(toolResult);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.VALIDATION_FAILED);
    });
  });

  describe('validateMessage', () => {
    it('should validate a system message', () => {
      const message = {
        role: 'system',
        content: 'You are a helpful assistant',
      };

      const result = validator.validateMessage(message);

      expect(result.success).toBe(true);
      expect(result.data?.role).toBe('system');
    });

    it('should validate a user message', () => {
      const message = {
        role: 'user',
        content: 'Create a project',
      };

      const result = validator.validateMessage(message);

      expect(result.success).toBe(true);
      expect(result.data?.role).toBe('user');
    });

    it('should reject message with invalid role', () => {
      const message = {
        role: 'invalid',
        content: 'Test',
      };

      const result = validator.validateMessage(message);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.VALIDATION_FAILED);
    });

    it('should reject message without content', () => {
      const message = {
        role: 'user',
      };

      const result = validator.validateMessage(message);

      expect(result.success).toBe(false);
    });
  });

  describe('validateAssistantMessage', () => {
    it('should validate assistant message without tool calls', () => {
      const message = {
        role: 'assistant',
        content: 'I can help you with that.',
      };

      const result = validator.validateAssistantMessage(message);

      expect(result.success).toBe(true);
      expect(result.data?.role).toBe('assistant');
      expect(result.data?.tool_calls).toBeUndefined();
    });

    it('should validate assistant message with tool calls', () => {
      const message = {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'create_project',
              arguments: '{"name": "Test"}',
            },
          },
        ],
      };

      const result = validator.validateAssistantMessage(message);

      expect(result.success).toBe(true);
      expect(result.data?.tool_calls).toHaveLength(1);
    });

    it('should fail if tool calls are invalid', () => {
      const message = {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: '',
            type: 'function',
            function: {
              name: 'create_project',
              arguments: '{}',
            },
          },
        ],
      };

      const result = validator.validateAssistantMessage(message);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.INVALID_TOOL_CALL);
    });
  });

  describe('validateToolMessage', () => {
    it('should validate a tool message', () => {
      const message = {
        role: 'tool',
        tool_call_id: 'call_123',
        content: JSON.stringify({ result: 'success' }),
        name: 'create_project',
      };

      const result = validator.validateToolMessage(message);

      expect(result.success).toBe(true);
      expect(result.data?.role).toBe('tool');
      expect(result.data?.tool_call_id).toBe('call_123');
    });

    it('should reject tool message without tool_call_id', () => {
      const message = {
        role: 'tool',
        content: 'result',
      };

      const result = validator.validateToolMessage(message);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.VALIDATION_FAILED);
    });

    it('should accept tool message without name', () => {
      const message = {
        role: 'tool',
        tool_call_id: 'call_123',
        content: 'result',
      };

      const result = validator.validateToolMessage(message);

      expect(result.success).toBe(true);
    });
  });

  describe('validateContext', () => {
    it('should validate a complete context', () => {
      const context = {
        userId: 'user-123',
        profileId: 'profile-456',
        conversationId: 'conv-789',
        metadata: { source: 'chat' },
      };

      const result = validator.validateContext(context);

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe('user-123');
      expect(result.data?.profileId).toBe('profile-456');
    });

    it('should validate context without optional fields', () => {
      const context = {
        userId: 'user-123',
        profileId: 'profile-456',
      };

      const result = validator.validateContext(context);

      expect(result.success).toBe(true);
      expect(result.data?.conversationId).toBeUndefined();
    });

    it('should reject context without userId', () => {
      const context = {
        profileId: 'profile-456',
      };

      const result = validator.validateContext(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.CONTEXT_MISSING);
    });

    it('should reject context without profileId', () => {
      const context = {
        userId: 'user-123',
      };

      const result = validator.validateContext(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(MCPErrorCode.CONTEXT_MISSING);
    });

    it('should reject context with empty userId', () => {
      const context = {
        userId: '',
        profileId: 'profile-456',
      };

      const result = validator.validateContext(context);

      expect(result.success).toBe(false);
    });
  });

  describe('createErrorResult', () => {
    it('should create error result from regular Error', () => {
      const error = new Error('Something went wrong');
      const result = validator.createErrorResult(
        'call_123',
        'create_project',
        error,
        100
      );

      expect(result.success).toBe(false);
      expect(result.toolCallId).toBe('call_123');
      expect(result.toolName).toBe('create_project');
      expect(result.error?.code).toBe(MCPErrorCode.TOOL_EXECUTION_FAILED);
      expect(result.error?.message).toBe('Something went wrong');
      expect(result.metadata?.executionTime).toBe(100);
      expect(result.metadata?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('createSuccessResult', () => {
    it('should create success result', () => {
      const data = { id: 'proj-1', name: 'Test Project' };
      const result = validator.createSuccessResult(
        'call_123',
        'create_project',
        data,
        150
      );

      expect(result.success).toBe(true);
      expect(result.toolCallId).toBe('call_123');
      expect(result.toolName).toBe('create_project');
      expect(result.result).toEqual(data);
      expect(result.error).toBeUndefined();
      expect(result.metadata?.executionTime).toBe(150);
      expect(result.metadata?.timestamp).toBeInstanceOf(Date);
    });

    it('should create success result without execution time', () => {
      const data = { success: true };
      const result = validator.createSuccessResult(
        'call_123',
        'list_projects',
        data
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTime).toBeUndefined();
      expect(result.metadata?.timestamp).toBeInstanceOf(Date);
    });
  });
});
