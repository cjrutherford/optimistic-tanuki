import { Injectable, Logger } from '@nestjs/common';

export interface ToolValidationResult {
    isValid: boolean;
    errors: string[];
    suggestions?: string[];
    retryableErrors?: string[];
}

export interface ToolCallResult {
    success: boolean;
    result?: unknown;
    error?: string;
    retryable?: boolean;
    suggestedFix?: string;
}

type ToolParameters = Record<string, unknown>;

@Injectable()
export class ToolValidationService {
    private readonly logger = new Logger(ToolValidationService.name);

    /**
     * Generic tool validation that can be extended for specific tools
     */
    validateToolCall(toolName: string, parameters: ToolParameters): ToolValidationResult {
        const errors: string[] = [];
        const suggestions: string[] = [];
        const retryableErrors: string[] = [];

        try {
            // Basic validation that applies to all tools
            if (!parameters || typeof parameters !== 'object') {
                errors.push('Parameters must be a valid object');
                suggestions.push('Provide parameters as an object with key-value pairs');
                return { isValid: false, errors, suggestions, retryableErrors };
            }

            // Try to validate with specific validators if they exist
            const specificValidator = this.getToolValidator(toolName);
            if (specificValidator) {
                return specificValidator(parameters);
            }

            // Generic validation - check for empty required fields
            const requiredFields = this.getCommonRequiredFields(toolName);
            for (const field of requiredFields) {
                if (!parameters[field] || (typeof parameters[field] === 'string' && (parameters[field] as string).trim() === '')) {
                    errors.push(`${field} is required`);
                    suggestions.push(`Provide a value for ${field}`);
                    retryableErrors.push(`missing_${field}`);
                }
            }

            return { isValid: errors.length === 0, errors, suggestions, retryableErrors };
        } catch (error) {
            this.logger.error(`Error validating tool ${toolName}:`, error);
            errors.push(`Validation error: ${error.message}`);
            return { isValid: false, errors, suggestions, retryableErrors };
        }
    }

    /**
     * Get tool-specific validator function if it exists
     */
    private getToolValidator(toolName: string): ((params: ToolParameters) => ToolValidationResult) | null {
        const validators: Record<string, (params: ToolParameters) => ToolValidationResult> = {
            createProject: this.validateCreateProject.bind(this),
            createTask: this.validateCreateTask.bind(this),
            updateTask: this.validateUpdateTask.bind(this),
            searchProjects: this.validateSearchProjects.bind(this),
            getProfile: this.validateGetProfile.bind(this)
        };

        return validators[toolName] || null;
    }

    /**
     * Get common required fields for a tool based on naming patterns
     */
    private getCommonRequiredFields(toolName: string): string[] {
        // Common patterns for required fields
        if (toolName.startsWith('create')) {
            return ['name', 'title'].filter(field => field); // At least one is usually required
        }
        if (toolName.startsWith('update')) {
            return ['id', 'taskId', 'projectId'].filter(field => field); // Some ID is usually required
        }
        if (toolName.startsWith('get')) {
            return ['id', 'userId', 'profileId'].filter(field => field); // Some ID is usually required
        }
        return [];
    }

    private validateCreateProject(params: any): ToolValidationResult {
        const errors: string[] = [];
        const suggestions: string[] = [];
        const retryableErrors: string[] = [];

        if (!params.name || typeof params.name !== 'string') {
            errors.push('Project name is required and must be a string');
            suggestions.push('Provide a descriptive project name (e.g., "Website Redesign")');
            retryableErrors.push('missing_name');
        }

        if (!params.description) {
            errors.push('Project description is required');
            suggestions.push('Provide a brief description of what this project will accomplish');
            retryableErrors.push('missing_description');
        }

        if (params.startDate && !this.isValidDate(params.startDate)) {
            errors.push('startDate must be a valid date string (YYYY-MM-DD format)');
            suggestions.push('Use format: YYYY-MM-DD (e.g., "2026-02-01")');
            retryableErrors.push('invalid_start_date');
        }

        if (params.endDate && !this.isValidDate(params.endDate)) {
            errors.push('endDate must be a valid date string (YYYY-MM-DD format)');
            suggestions.push('Use format: YYYY-MM-DD (e.g., "2026-03-01")');
            retryableErrors.push('invalid_end_date');
        }

        if (params.priority && !['low', 'medium', 'high', 'critical'].includes(params.priority)) {
            errors.push('priority must be one of: low, medium, high, critical');
            suggestions.push('Use one of these priority values: low, medium, high, critical');
            retryableErrors.push('invalid_priority');
        }

        return { isValid: errors.length === 0, errors, suggestions, retryableErrors };
    }

    private validateCreateTask(params: any): ToolValidationResult {
        const errors: string[] = [];
        const suggestions: string[] = [];
        const retryableErrors: string[] = [];

        if (!params.title || typeof params.title !== 'string') {
            errors.push('Task title is required and must be a string');
            suggestions.push('Provide a clear task title describing what needs to be done');
            retryableErrors.push('missing_title');
        }

        if (!params.projectId) {
            errors.push('projectId is required for task creation');
            suggestions.push('Specify which project this task belongs to. Use searchProjects first if needed.');
            retryableErrors.push('missing_project_id');
        }

        if (params.dueDate && !this.isValidDate(params.dueDate)) {
            errors.push('dueDate must be a valid date string (YYYY-MM-DD format)');
            suggestions.push('Use format: YYYY-MM-DD (e.g., "2026-02-15")');
            retryableErrors.push('invalid_due_date');
        }

        if (params.priority && !['low', 'medium', 'high', 'critical'].includes(params.priority)) {
            errors.push('priority must be one of: low, medium, high, critical');
            suggestions.push('Use one of these priority values: low, medium, high, critical');
            retryableErrors.push('invalid_priority');
        }

        if (params.estimatedHours && (typeof params.estimatedHours !== 'number' || params.estimatedHours < 0)) {
            errors.push('estimatedHours must be a positive number');
            suggestions.push('Provide estimated hours as a positive number (e.g., 8, 2.5)');
            retryableErrors.push('invalid_estimated_hours');
        }

        return { isValid: errors.length === 0, errors, suggestions, retryableErrors };
    }

    private validateUpdateTask(params: any): ToolValidationResult {
        const errors: string[] = [];
        const suggestions: string[] = [];
        const retryableErrors: string[] = [];

        if (!params.taskId) {
            errors.push('taskId is required for task updates');
            suggestions.push('Specify which task to update using its ID');
            retryableErrors.push('missing_task_id');
        }

        if (params.status && !['todo', 'in_progress', 'completed', 'blocked'].includes(params.status)) {
            errors.push('status must be one of: todo, in_progress, completed, blocked');
            suggestions.push('Use one of these status values: todo, in_progress, completed, blocked');
            retryableErrors.push('invalid_status');
        }

        if (params.dueDate && !this.isValidDate(params.dueDate)) {
            errors.push('dueDate must be a valid date string (YYYY-MM-DD format)');
            suggestions.push('Use format: YYYY-MM-DD (e.g., "2026-02-15")');
            retryableErrors.push('invalid_due_date');
        }

        return { isValid: errors.length === 0, errors, suggestions, retryableErrors };
    }

    private validateSearchProjects(params: any): ToolValidationResult {
        const errors: string[] = [];
        const suggestions: string[] = [];

        // Search projects is more flexible - just validate basic types if provided
        if (params.status && !['active', 'completed', 'on_hold', 'cancelled'].includes(params.status)) {
            errors.push('status filter must be one of: active, completed, on_hold, cancelled');
            suggestions.push('Use one of these status values for filtering: active, completed, on_hold, cancelled');
        }

        return { isValid: errors.length === 0, errors, suggestions };
    }

    private validateGetProfile(params: any): ToolValidationResult {
        const errors: string[] = [];
        const suggestions: string[] = [];

        if (!params.profileId && !params.userId) {
            errors.push('Either profileId or userId is required');
            suggestions.push('Provide either a profileId or userId to fetch profile information');
        }

        return { isValid: errors.length === 0, errors, suggestions };
    }

    private isValidDate(dateString: string): boolean {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;

        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime()) && date.toISOString().startsWith(dateString);
    }

    /**
     * Analyzes a tool call error and suggests fixes
     */
    analyzeToolCallError(toolName: string, parameters: ToolParameters, error: string): ToolCallResult {
        this.logger.warn(`Tool call failed - ${toolName}:`, { parameters, error });

        const validation = this.validateToolCall(toolName, parameters);

        let retryable = false;
        let suggestedFix = '';

        // Check if it's a validation error that can be fixed
        if (!validation.isValid && validation.retryableErrors?.length > 0) {
            retryable = true;
            suggestedFix = this.generateRetryInstructions(toolName, validation);
        } else if (error.includes('not found') || error.includes('404')) {
            retryable = true;
            suggestedFix = this.generateNotFoundFix(toolName, parameters);
        } else if (error.includes('permission') || error.includes('unauthorized')) {
            retryable = false;
            suggestedFix = 'You may not have permission to perform this action. Please check if you have the required permissions.';
        } else if (error.includes('network') || error.includes('timeout') || error.includes('connection')) {
            retryable = true;
            suggestedFix = 'Network error occurred. This is usually temporary - you can retry the same request.';
        } else if (error.includes('required') || error.includes('missing')) {
            retryable = true;
            suggestedFix = this.generateMissingParameterFix(toolName, error);
        }

        return {
            success: false,
            error,
            retryable,
            suggestedFix: suggestedFix || 'The tool call failed. Please check your parameters and try again.'
        };
    }

    private generateRetryInstructions(toolName: string, validation: ToolValidationResult): string {
        const instructions: string[] = [
            `To fix the ${toolName} tool call, please address these issues:`
        ];

        validation.errors.forEach((error, index) => {
            instructions.push(`${index + 1}. ${error}`);
            if (validation.suggestions && validation.suggestions[index]) {
                instructions.push(`   Suggestion: ${validation.suggestions[index]}`);
            }
        });

        instructions.push('\nPlease retry with corrected parameters.');
        return instructions.join('\n');
    }

    private generateNotFoundFix(toolName: string, parameters: any): string {
        switch (toolName) {
            case 'updateTask':
                return `The task with ID "${parameters.taskId}" was not found. Please verify the task ID is correct or search for tasks first.`;
            case 'createTask':
                return `The project with ID "${parameters.projectId}" was not found. Please verify the project exists or create it first.`;
            default:
                return 'The requested resource was not found. Please verify the ID is correct.';
        }
    }

    private generateMissingParameterFix(toolName: string, error: string): string {
        const missingParam = this.extractMissingParameter(error);
        const toolHelp = this.getToolParameterHelp(toolName, missingParam);

        return `Missing required parameter: ${missingParam}. ${toolHelp}`;
    }

    private extractMissingParameter(error: string): string {
        // Try to extract parameter name from common error patterns
        const patterns = [
            /required.*?'(\w+)'/,
            /missing.*?'(\w+)'/,
            /(\w+).*?is required/,
            /(\w+).*?missing/
        ];

        for (const pattern of patterns) {
            const match = error.match(pattern);
            if (match) return match[1];
        }

        return 'parameter';
    }

    private getToolParameterHelp(toolName: string, paramName: string): string {
        const helpMap = {
            createProject: {
                name: 'Provide a descriptive project name',
                description: 'Provide a brief description of the project',
                startDate: 'Use YYYY-MM-DD format for start date',
                endDate: 'Use YYYY-MM-DD format for end date'
            },
            createTask: {
                title: 'Provide a clear task title',
                projectId: 'Specify which project this task belongs to',
                description: 'Provide task description',
                dueDate: 'Use YYYY-MM-DD format for due date'
            }
        };

        return helpMap[toolName]?.[paramName] || `Please provide a valid value for ${paramName}`;
    }

    /**
     * Generates helpful error messages for tool calls
     */
    generateToolHelpMessage(toolName: string): string {
        const toolHelp = {
            createProject: `To create a project, I need:
        - name (required): A descriptive project name
        - description (required): What this project will accomplish
        - startDate (optional): Start date in YYYY-MM-DD format
        - endDate (optional): End date in YYYY-MM-DD format
        - priority (optional): low, medium, high, or critical`,

            createTask: `To create a task, I need:
        - title (required): Clear description of what needs to be done
        - projectId (required): Which project this task belongs to
        - description (optional): Detailed task description
        - dueDate (optional): Due date in YYYY-MM-DD format
        - priority (optional): low, medium, high, or critical
        - estimatedHours (optional): How many hours this task will take`,

            updateTask: `To update a task, I need:
        - taskId (required): Which task to update
        - Any fields to update: title, description, status, dueDate, priority, etc.`,

            searchProjects: `To search projects, you can provide:
        - name (optional): Search by project name
        - status (optional): active, completed, on_hold, or cancelled
        - All parameters are optional for general search`,

            getProfile: `To get profile information, I need:
        - profileId OR userId: Which user's profile to retrieve`
        };

        return toolHelp[toolName] || `Please provide the required information for the ${toolName} action.`;
    }
}