import { ToolValidationService } from './tool-validation.service';

describe('ToolValidationService', () => {
  let service: ToolValidationService;

  beforeEach(() => {
    service = new ToolValidationService();
  });

  describe('validateToolCall', () => {
    it('rejects non-object parameters', () => {
      const result = service.validateToolCall('createProject', null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Parameters must be a valid object');
    });

    it('uses the specific createProject validator', () => {
      const result = service.validateToolCall('createProject', {});
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Project name is required and must be a string',
          'Project description is required',
        ])
      );
    });

    it('passes createProject validation with valid parameters', () => {
      const result = service.validateToolCall('createProject', {
        name: 'My Project',
        description: 'A project',
        startDate: '2026-02-01',
        endDate: '2026-03-01',
        priority: 'high',
      });
      expect(result).toEqual({
        isValid: true,
        errors: [],
        suggestions: [],
        retryableErrors: [],
      });
    });

    it('flags invalid dates and priority on createProject', () => {
      const result = service.validateToolCall('createProject', {
        name: 'X',
        description: 'Y',
        startDate: 'not-a-date',
        endDate: 'also-bad',
        priority: 'urgent',
      });
      expect(result.retryableErrors).toEqual(
        expect.arrayContaining([
          'invalid_start_date',
          'invalid_end_date',
          'invalid_priority',
        ])
      );
    });

    it('uses the specific createTask validator', () => {
      const result = service.validateToolCall('createTask', {});
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Task title is required and must be a string',
          'projectId is required for task creation',
        ])
      );
    });

    it('flags invalid dueDate, priority, and estimatedHours on createTask', () => {
      const result = service.validateToolCall('createTask', {
        title: 'Task',
        projectId: 'p1',
        dueDate: 'bad',
        priority: 'urgent',
        estimatedHours: -5,
      });
      expect(result.retryableErrors).toEqual(
        expect.arrayContaining([
          'invalid_due_date',
          'invalid_priority',
          'invalid_estimated_hours',
        ])
      );
    });

    it('passes createTask validation with valid parameters', () => {
      const result = service.validateToolCall('createTask', {
        title: 'Task',
        projectId: 'p1',
        dueDate: '2026-02-15',
        priority: 'low',
        estimatedHours: 4,
      });
      expect(result.isValid).toBe(true);
    });

    it('validates updateTask requiring a taskId and valid status', () => {
      const missing = service.validateToolCall('updateTask', {});
      expect(missing.errors).toContain('taskId is required for task updates');

      const badStatus = service.validateToolCall('updateTask', {
        taskId: 't1',
        status: 'bogus',
        dueDate: 'bad-date',
      });
      expect(badStatus.retryableErrors).toEqual(
        expect.arrayContaining(['invalid_status', 'invalid_due_date'])
      );

      const good = service.validateToolCall('updateTask', {
        taskId: 't1',
        status: 'in_progress',
        dueDate: '2026-02-15',
      });
      expect(good.isValid).toBe(true);
    });

    it('validates searchProjects status filter', () => {
      const bad = service.validateToolCall('searchProjects', {
        status: 'nope',
      });
      expect(bad.isValid).toBe(false);

      const good = service.validateToolCall('searchProjects', {
        status: 'active',
      });
      expect(good.isValid).toBe(true);

      const empty = service.validateToolCall('searchProjects', {});
      expect(empty.isValid).toBe(true);
    });

    it('validates getProfile requiring profileId or userId', () => {
      const bad = service.validateToolCall('getProfile', {});
      expect(bad.isValid).toBe(false);
      expect(bad.errors).toContain('Either profileId or userId is required');

      expect(
        service.validateToolCall('getProfile', { profileId: 'p1' }).isValid
      ).toBe(true);
      expect(
        service.validateToolCall('getProfile', { userId: 'u1' }).isValid
      ).toBe(true);
    });

    it('falls back to generic required-field validation for create* tools without a specific validator', () => {
      const result = service.validateToolCall('createWidget', {});
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining(['name is required', 'title is required'])
      );
    });

    it('falls back to generic required-field validation for update* tools', () => {
      const result = service.validateToolCall('updateWidget', {
        id: '',
        taskId: '  ',
        projectId: 'p1',
      });
      expect(result.errors).toEqual(
        expect.arrayContaining(['id is required', 'taskId is required'])
      );
      expect(result.errors).not.toContain('projectId is required');
    });

    it('falls back to generic required-field validation for get* tools', () => {
      const result = service.validateToolCall('getWidget', {
        id: 'x',
        userId: 'y',
        profileId: 'z',
      });
      expect(result.isValid).toBe(true);
    });

    it('returns no required fields for unrecognized tool name patterns', () => {
      const result = service.validateToolCall('doSomethingElse', {});
      expect(result).toEqual({
        isValid: true,
        errors: [],
        suggestions: [],
        retryableErrors: [],
      });
    });

    it('catches unexpected errors during validation and reports them', () => {
      const badParams: any = {};
      Object.defineProperty(badParams, 'name', {
        get() {
          throw new Error('boom');
        },
      });
      const result = service.validateToolCall('createWidget', badParams);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Validation error: boom');
    });
  });

  describe('isValidDate (via createProject)', () => {
    it('rejects malformed date strings and non-existent calendar dates', () => {
      const badFormat = service.validateToolCall('createProject', {
        name: 'n',
        description: 'd',
        startDate: '02-01-2026',
      });
      expect(badFormat.retryableErrors).toContain('invalid_start_date');

      const badDate = service.validateToolCall('createProject', {
        name: 'n',
        description: 'd',
        startDate: '2026-13-40',
      });
      expect(badDate.retryableErrors).toContain('invalid_start_date');
    });

    it('accepts a valid YYYY-MM-DD date', () => {
      const result = service.validateToolCall('createProject', {
        name: 'n',
        description: 'd',
        startDate: '2026-02-01',
      });
      expect(result.retryableErrors).not.toContain('invalid_start_date');
    });
  });

  describe('analyzeToolCallError', () => {
    it('returns retryable validation-fix instructions when parameters are invalid', () => {
      const result = service.analyzeToolCallError(
        'createProject',
        {},
        'some backend error'
      );
      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.suggestedFix).toContain('createProject');
      expect(result.suggestedFix).toContain('Project name is required');
    });

    it('suggests a not-found fix for updateTask 404 errors', () => {
      const result = service.analyzeToolCallError(
        'updateTask',
        { taskId: 't1', status: 'todo' },
        'Resource not found (404)'
      );
      expect(result.retryable).toBe(true);
      expect(result.suggestedFix).toContain('task with ID "t1"');
    });

    it('suggests a not-found fix for createTask 404 errors', () => {
      const result = service.analyzeToolCallError(
        'createTask',
        { title: 'T', projectId: 'p1' },
        'not found'
      );
      expect(result.suggestedFix).toContain('project with ID "p1"');
    });

    it('gives a generic not-found fix for unknown tools', () => {
      const result = service.analyzeToolCallError(
        'someOtherTool',
        { id: '1' },
        '404 not found'
      );
      expect(result.suggestedFix).toContain('requested resource was not found');
    });

    it('marks permission errors as non-retryable', () => {
      const result = service.analyzeToolCallError(
        'createTask',
        { title: 'T', projectId: 'p1' },
        'unauthorized: permission denied'
      );
      expect(result.retryable).toBe(false);
      expect(result.suggestedFix).toContain('permission');
    });

    it('marks network errors as retryable', () => {
      const result = service.analyzeToolCallError(
        'createTask',
        { title: 'T', projectId: 'p1' },
        'network timeout occurred'
      );
      expect(result.retryable).toBe(true);
      expect(result.suggestedFix).toContain('Network error');
    });

    it('generates a missing-parameter fix, extracting the param name from the error', () => {
      const result = service.analyzeToolCallError(
        'createProject',
        { name: 'n', description: 'd' },
        "required: 'name'"
      );
      expect(result.retryable).toBe(true);
      expect(result.suggestedFix).toContain('Missing required parameter: name');
      expect(result.suggestedFix).toContain(
        'Provide a descriptive project name'
      );
    });

    it('falls back to a generic parameter help message for unmapped tools/params', () => {
      const result = service.analyzeToolCallError(
        'unknownTool',
        {},
        'xyz is missing'
      );
      expect(result.suggestedFix).toContain('valid value for xyz');
    });

    it('falls back to a default message when nothing else matches', () => {
      const result = service.analyzeToolCallError(
        'createTask',
        { title: 'T', projectId: 'p1' },
        'totally unrecognized failure'
      );
      expect(result.retryable).toBe(false);
      expect(result.suggestedFix).toBe(
        'The tool call failed. Please check your parameters and try again.'
      );
    });

    it('defaults the extracted parameter to "parameter" when no pattern matches', () => {
      const result = service.analyzeToolCallError(
        'createProject',
        { name: 'n', description: 'd' },
        'field required but not specified'
      );
      expect(result.suggestedFix).toContain(
        'Missing required parameter: parameter'
      );
    });
  });

  describe('generateToolHelpMessage', () => {
    it.each([
      'createProject',
      'createTask',
      'updateTask',
      'searchProjects',
      'getProfile',
    ])('returns tool-specific help for %s', (toolName) => {
      const help = service.generateToolHelpMessage(toolName);
      expect(help.length).toBeGreaterThan(10);
      expect(help).not.toContain('Please provide the required information');
    });

    it('returns a generic message for unknown tools', () => {
      const help = service.generateToolHelpMessage('mysteryTool');
      expect(help).toBe(
        'Please provide the required information for the mysteryTool action.'
      );
    });
  });
});
