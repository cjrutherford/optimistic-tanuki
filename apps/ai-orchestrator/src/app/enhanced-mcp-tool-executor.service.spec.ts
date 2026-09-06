import { EnhancedMCPToolExecutor } from './enhanced-mcp-tool-executor.service';
import { ToolValidationService } from './tool-validation.service';
import { MCPToolExecutor } from './mcp-tool-executor';

describe('EnhancedMCPToolExecutor', () => {
  let toolValidation: ToolValidationService;
  let mcpExecutor: Record<string, jest.Mock>;
  let executor: EnhancedMCPToolExecutor;

  beforeEach(() => {
    toolValidation = new ToolValidationService();
    mcpExecutor = {};
    executor = new EnhancedMCPToolExecutor(
      toolValidation,
      mcpExecutor as unknown as MCPToolExecutor
    );
  });

  describe('executeToolWithRetry', () => {
    it('fails fast with the validation error when parameters are invalid', async () => {
      const result = await executor.executeToolWithRetry('createTask', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool validation failed');
      expect(result.retryable).toBe(true);
    });

    it('emits an update and reports non-retryable when there are no retryable validation errors', async () => {
      const result = await executor.executeToolWithRetry(
        'searchProjects',
        { status: 'bogus' },
        { conversationId: 'c1' }
      );
      expect(result.success).toBe(false);
      expect(result.retryable).toBeFalsy();
      expect(result.suggestedFix).toBeDefined();
    });

    it('succeeds on the first attempt by delegating to a matching mcpExecutor method', async () => {
      mcpExecutor['createTask'] = jest.fn().mockResolvedValue({ id: 't1' });
      const result = await executor.executeToolWithRetry('createTask', {
        title: 'Task',
        projectId: 'p1',
      });
      expect(result).toEqual({ success: true, result: { id: 't1' } });
      expect(mcpExecutor['createTask']).toHaveBeenCalledWith({
        title: 'Task',
        projectId: 'p1',
      });
    });

    it('falls back to an executeX-style method name when the direct name is not a function', async () => {
      mcpExecutor['executeCreateTask'] = jest
        .fn()
        .mockResolvedValue({ id: 't2' });
      const result = await executor.executeToolWithRetry('createTask', {
        title: 'Task',
        projectId: 'p1',
      });
      expect(result).toEqual({ success: true, result: { id: 't2' } });
    });

    it('falls back to a callX-style method name', async () => {
      mcpExecutor['callCreateTask'] = jest.fn().mockResolvedValue('done');
      const result = await executor.executeToolWithRetry('createTask', {
        title: 'Task',
        projectId: 'p1',
      });
      expect(result).toEqual({ success: true, result: 'done' });
    });

    it('retries a retryable failure then succeeds, waiting between attempts', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('ok');
      mcpExecutor['createTask'] = fn;
      const result = await executor.executeToolWithRetry(
        'createTask',
        { title: 'Task', projectId: 'p1' },
        { maxRetries: 3, retryDelay: 1, conversationId: 'c1' }
      );
      expect(result).toEqual({ success: true, result: 'ok' });
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('gives up after exhausting retries on a persistently retryable error', async () => {
      mcpExecutor['createTask'] = jest
        .fn()
        .mockRejectedValue(new Error('connection reset'));
      const result = await executor.executeToolWithRetry(
        'createTask',
        { title: 'Task', projectId: 'p1' },
        { maxRetries: 2, retryDelay: 1 }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('connection reset');
      expect(result.retryable).toBe(false);
    });

    it('stops immediately on a non-retryable error without exhausting retries', async () => {
      const fn = jest
        .fn()
        .mockRejectedValue(new Error('unauthorized: permission denied'));
      mcpExecutor['createTask'] = fn;
      const result = await executor.executeToolWithRetry(
        'createTask',
        { title: 'Task', projectId: 'p1' },
        { maxRetries: 5, retryDelay: 1 }
      );
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws an "Unknown tool" style error when no matching mcpExecutor method exists', async () => {
      const result = await executor.executeToolWithRetry(
        'createTask',
        { title: 'Task', projectId: 'p1' },
        { maxRetries: 1, retryDelay: 1 }
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool: createTask');
    });

    it('defaults the error message to "Unknown error" when the thrown value has none', async () => {
      mcpExecutor['createTask'] = jest.fn().mockRejectedValue({});
      const result = await executor.executeToolWithRetry(
        'createTask',
        { title: 'Task', projectId: 'p1' },
        { maxRetries: 1, retryDelay: 1 }
      );
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('executeToolWithGuidance', () => {
    it('returns the raw result on success', async () => {
      mcpExecutor['createTask'] = jest.fn().mockResolvedValue({ id: 't1' });
      const outcome = await executor.executeToolWithGuidance('createTask', {
        title: 'Task',
        projectId: 'p1',
      });
      expect(outcome).toEqual({ result: { id: 't1' } });
    });

    it('appends a retry hint for retryable failures', async () => {
      const outcome = await executor.executeToolWithGuidance('createTask', {});
      expect(outcome.error).toContain('Tool validation failed');
      expect(outcome.guidance).toContain('temporary');
    });

    it('appends tool help guidance for non-retryable failures', async () => {
      mcpExecutor['createTask'] = jest
        .fn()
        .mockRejectedValue(new Error('unauthorized'));
      const outcome = await executor.executeToolWithGuidance(
        'createTask',
        { title: 'Task', projectId: 'p1' },
        'c1'
      );
      expect(outcome.guidance).toContain('check your parameters');
      expect(outcome.guidance).toContain('To create a task');
    });
  });

  describe('generateSelfCorrectionPrompt', () => {
    it('includes validation errors, suggested fixes, and retry guidance for a retryable error', () => {
      const prompt = executor.generateSelfCorrectionPrompt(
        'createTask',
        {},
        'network timeout',
        0
      );
      expect(prompt).toContain('createTask tool call failed');
      expect(prompt).toContain('Parameter validation errors');
      expect(prompt).toContain('retryable');
    });

    it('asks for clarification when the error is not retryable or retries are exhausted', () => {
      const prompt = executor.generateSelfCorrectionPrompt(
        'createTask',
        { title: 'T', projectId: 'p1' },
        'unauthorized',
        5
      );
      expect(prompt).toContain('ask the user for clarification');
      expect(prompt).toContain('To create a task');
    });
  });

  describe('validateAndPrepareParameters', () => {
    it('returns valid with the original parameters when validation passes', () => {
      const params = { title: 'T', projectId: 'p1' };
      const result = executor.validateAndPrepareParameters(
        'createTask',
        params
      );
      expect(result).toEqual({ valid: true, parameters: params });
    });

    it('returns a formatted error message including suggestions and tool help when invalid', () => {
      const result = executor.validateAndPrepareParameters('createTask', {});
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Tool createTask validation failed');
      expect(result.message).toContain('•');
      expect(result.message).toContain('To create a task');
    });
  });
});
