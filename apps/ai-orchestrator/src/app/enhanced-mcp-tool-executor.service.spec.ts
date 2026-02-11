import { Test, TestingModule } from '@nestjs/testing';
import { EnhancedMCPToolExecutor } from './enhanced-mcp-tool-executor.service';
import { ToolValidationService } from './tool-validation.service';
import { MCPToolExecutor } from './mcp-tool-executor';

describe('EnhancedMCPToolExecutor', () => {
  let service: EnhancedMCPToolExecutor;
  let toolValidation: jest.Mocked<ToolValidationService>;
  let mcpExecutor: jest.Mocked<MCPToolExecutor>;

  beforeEach(async () => {
    const mockToolValidation = {
      validateToolCall: jest.fn(),
      analyzeToolCallError: jest.fn(),
      generateToolHelpMessage: jest.fn().mockReturnValue('Tool help message'),
    };

    const mockMCPExecutor = {
      testTool: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedMCPToolExecutor,
        {
          provide: ToolValidationService,
          useValue: mockToolValidation,
        },
        {
          provide: MCPToolExecutor,
          useValue: mockMCPExecutor,
        },
      ],
    }).compile();

    service = module.get<EnhancedMCPToolExecutor>(EnhancedMCPToolExecutor);
    toolValidation = module.get(ToolValidationService);
    mcpExecutor = module.get(MCPToolExecutor);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeToolWithRetry', () => {
    it('should return validation error when parameters are invalid', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: false,
        errors: ['Missing required parameter: id'],
        suggestions: ['Add id parameter'],
        retryableErrors: [],
      });

      const result = await service.executeToolWithRetry('testTool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool validation failed');
      expect(result.retryable).toBe(false);
      expect(result.suggestedFix).toBeDefined();
    });

    it('should return validation error with retryable flag when retryable errors exist', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: false,
        errors: ['Connection timeout'],
        suggestions: ['Check network connection'],
        retryableErrors: ['Connection timeout'],
      });

      const result = await service.executeToolWithRetry('testTool', {});

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.suggestedFix).toBeDefined();
    });

    it('should execute tool successfully on first attempt', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      mcpExecutor.testTool.mockResolvedValue({ data: 'success' });

      const result = await service.executeToolWithRetry('testTool', { id: '123' });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'success' });
      expect(mcpExecutor.testTool).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      toolValidation.analyzeToolCallError.mockReturnValue({
        retryable: true,
        suggestedFix: 'Retry the operation',
      });

      mcpExecutor.testTool
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ data: 'success' });

      const result = await service.executeToolWithRetry(
        'testTool',
        { id: '123' },
        { retryDelay: 10 }
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'success' });
      expect(mcpExecutor.testTool).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries with retryable error', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      toolValidation.analyzeToolCallError.mockReturnValue({
        retryable: true,
        suggestedFix: 'Retry the operation',
      });

      mcpExecutor.testTool.mockRejectedValue(new Error('Persistent error'));

      const result = await service.executeToolWithRetry(
        'testTool',
        { id: '123' },
        { maxRetries: 2, retryDelay: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent error');
      expect(result.retryable).toBe(false);
      expect(mcpExecutor.testTool).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      toolValidation.analyzeToolCallError.mockReturnValue({
        retryable: false,
        suggestedFix: 'Fix the parameter',
      });

      mcpExecutor.testTool.mockRejectedValue(new Error('Invalid parameter'));

      const result = await service.executeToolWithRetry('testTool', { id: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameter');
      expect(result.retryable).toBe(false);
      expect(result.suggestedFix).toBe('Fix the parameter');
      expect(mcpExecutor.testTool).toHaveBeenCalledTimes(1);
    });

    it('should use custom retry options', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      toolValidation.analyzeToolCallError.mockReturnValue({
        retryable: true,
        suggestedFix: 'Retry',
      });

      mcpExecutor.testTool.mockRejectedValue(new Error('Error'));

      const startTime = Date.now();
      await service.executeToolWithRetry(
        'testTool',
        { id: '123' },
        { maxRetries: 2, retryDelay: 50 }
      );
      const elapsed = Date.now() - startTime;

      // Should wait at least 50ms before the second attempt
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some timing variance
      expect(mcpExecutor.testTool).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeToolWithGuidance', () => {
    it('should return result on success', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      mcpExecutor.testTool.mockResolvedValue({ data: 'success' });

      const result = await service.executeToolWithGuidance('testTool', { id: '123' });

      expect(result.result).toEqual({ data: 'success' });
      expect(result.error).toBeUndefined();
      expect(result.guidance).toBeUndefined();
    });

    it('should return error and guidance on failure with retryable error after max retries', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      toolValidation.analyzeToolCallError.mockReturnValue({
        retryable: true,
        suggestedFix: 'Network issue',
      });

      mcpExecutor.testTool.mockRejectedValue(new Error('Connection failed'));

      const result = await service.executeToolWithGuidance('testTool', { id: '123' });

      expect(result.result).toBeUndefined();
      expect(result.error).toBe('Connection failed');
      expect(result.guidance).toContain('Network issue');
      // After max retries, retryable becomes false, so we get the non-retryable message
      expect(result.guidance).toContain('check your parameters');
    });

    it('should return error and guidance on failure with non-retryable error', async () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: false,
        errors: ['Invalid id'],
        suggestions: ['Provide valid id'],
        retryableErrors: [],
      });

      const result = await service.executeToolWithGuidance('testTool', {});

      expect(result.result).toBeUndefined();
      expect(result.error).toContain('Tool validation failed');
      expect(result.guidance).toContain('check your parameters');
      expect(result.guidance).toContain('Tool help message');
    });
  });

  describe('generateSelfCorrectionPrompt', () => {
    it('should generate prompt with validation errors', () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: false,
        errors: ['Missing required parameter: id', 'Invalid type for name'],
        suggestions: ['Add id parameter', 'name must be a string'],
        retryableErrors: [],
      });

      toolValidation.analyzeToolCallError.mockReturnValue({
        retryable: false,
        suggestedFix: 'Check required parameters',
      });

      const prompt = service.generateSelfCorrectionPrompt(
        'testTool',
        {},
        'Validation failed',
        1
      );

      expect(prompt).toContain('testTool tool call failed');
      expect(prompt).toContain('Validation failed');
      expect(prompt).toContain('Parameter validation errors');
      expect(prompt).toContain('Missing required parameter: id');
      expect(prompt).toContain('Add id parameter');
      expect(prompt).toContain('Check required parameters');
      expect(prompt).toContain('Tool help message');
    });

    it('should suggest retry for retryable errors', () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      toolValidation.analyzeToolCallError.mockReturnValue({
        retryable: true,
        suggestedFix: 'Temporary network issue',
      });

      const prompt = service.generateSelfCorrectionPrompt(
        'testTool',
        { id: '123' },
        'Connection timeout',
        1
      );

      expect(prompt).toContain('appears to be retryable');
      expect(prompt).toContain('Temporary network issue');
    });

    it('should suggest asking user for non-retryable errors at max attempts', () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      toolValidation.analyzeToolCallError.mockReturnValue({
        retryable: false,
        suggestedFix: 'Invalid data',
      });

      const prompt = service.generateSelfCorrectionPrompt(
        'testTool',
        { id: 'invalid' },
        'Invalid format',
        3
      );

      expect(prompt).toContain('ask the user for clarification');
      expect(prompt).toContain('Invalid data');
    });
  });

  describe('validateAndPrepareParameters', () => {
    it('should return valid result when parameters are valid', () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = service.validateAndPrepareParameters('testTool', { id: '123' });

      expect(result.valid).toBe(true);
      expect(result.parameters).toEqual({ id: '123' });
      expect(result.message).toBeUndefined();
    });

    it('should return error message when parameters are invalid', () => {
      toolValidation.validateToolCall.mockReturnValue({
        isValid: false,
        errors: ['Missing id', 'Invalid name'],
        suggestions: ['Add id parameter', 'name must be string'],
      });

      const result = service.validateAndPrepareParameters('testTool', {});

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Tool testTool validation failed');
      expect(result.message).toContain('Missing id (Add id parameter)');
      expect(result.message).toContain('Invalid name (name must be string)');
      expect(result.message).toContain('Tool help message');
      expect(result.parameters).toBeUndefined();
    });
  });
});
