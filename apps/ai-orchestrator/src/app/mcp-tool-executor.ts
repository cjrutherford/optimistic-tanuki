/**
 * MCP Tool Executor
 *
 * Provides a standardized interface for executing MCP tools with strict validation.
 * Ensures all tool calls are properly validated before execution and results are
 * consistently formatted.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ToolCall,
  ParsedToolCall,
  ToolResult,
  ToolExecutionContext,
  MCPError,
  MCPErrorCode,
} from '@optimistic-tanuki/models';
import { MCPValidator } from './mcp-validator';
import { ToolsService } from './tools.service';

@Injectable()
export class MCPToolExecutor {
  private readonly logger = new Logger(MCPToolExecutor.name);
  private readonly validator: MCPValidator;

  constructor(private readonly toolsService: ToolsService) {
    this.validator = new MCPValidator();
  }

  /**
   * Execute a single tool call with validation
   */
  async executeToolCall(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Validate context
      const contextValidation = this.validator.validateContext(context);
      if (!contextValidation.success) {
        this.logger.error('Invalid execution context', contextValidation.error);
        return this.validator.createErrorResult(
          toolCall.id,
          toolCall.function.name,
          new MCPError(
            MCPErrorCode.CONTEXT_MISSING,
            contextValidation.error?.message || 'Invalid execution context',
            contextValidation.error?.details
          ),
          Date.now() - startTime
        );
      }

      // Validate tool call
      const toolCallValidation = this.validator.validateToolCall(toolCall);
      if (!toolCallValidation.success || !toolCallValidation.data) {
        this.logger.error('Invalid tool call', toolCallValidation.error);
        return this.validator.createErrorResult(
          toolCall.id,
          toolCall.function.name,
          new MCPError(
            MCPErrorCode.INVALID_TOOL_CALL,
            toolCallValidation.error?.message || 'Invalid tool call',
            toolCallValidation.error?.details
          ),
          Date.now() - startTime
        );
      }

      const parsedCall = toolCallValidation.data;

      // Normalize arguments with context
      const normalizedArgs = await this.normalizeToolArguments(
        parsedCall.name,
        parsedCall.arguments,
        context
      );

      this.logger.log(
        `Executing tool: ${parsedCall.name} with args: ${JSON.stringify(
          normalizedArgs
        )}`
      );

      // Execute the tool
      const rawResult = await this.toolsService.callTool(
        parsedCall.name,
        normalizedArgs
      );

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `Tool ${parsedCall.name} executed successfully in ${executionTime}ms`
      );

      // Create success result
      return this.validator.createSuccessResult(
        toolCall.id,
        parsedCall.name,
        rawResult,
        executionTime
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Tool execution failed: ${error.message}`, error.stack);

      return this.validator.createErrorResult(
        toolCall.id,
        toolCall.function.name,
        error instanceof MCPError
          ? error
          : new MCPError(
              MCPErrorCode.TOOL_EXECUTION_FAILED,
              `Tool execution failed: ${error.message}`,
              { originalError: error.message, stack: error.stack }
            ),
        executionTime
      );
    }
  }

  /**
   * Execute multiple tool calls sequentially
   * NOTE: LLM should only call one tool at a time, but this handles edge cases
   */
  async executeToolCalls(
    toolCalls: ToolCall[],
    context: ToolExecutionContext
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    // Validate all tool calls first
    const validation = this.validator.validateToolCalls(toolCalls);
    if (!validation.success) {
      this.logger.warn('Some tool calls failed validation', validation.error);
      // For invalid calls, create error results
      for (const toolCall of toolCalls) {
        const callValidation = this.validator.validateToolCall(toolCall);
        if (!callValidation.success) {
          results.push(
            this.validator.createErrorResult(
              toolCall.id,
              toolCall.function.name,
              new MCPError(
                MCPErrorCode.INVALID_TOOL_CALL,
                callValidation.error?.message || 'Invalid tool call',
                callValidation.error?.details
              )
            )
          );
        }
      }
    }

    // Execute valid tool calls sequentially
    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall, context);
      results.push(result);

      // If a tool call fails, stop executing subsequent calls
      if (!result.success) {
        this.logger.warn(
          `Tool ${result.toolName} failed, stopping subsequent executions`
        );
        break;
      }
    }

    return results;
  }

  /**
   * Normalize tool arguments by injecting context and fixing common issues
   */
  private async normalizeToolArguments(
    toolName: string,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Record<string, any>> {
    const normalized = { ...args };

    // Always inject userId/profileId if not present or invalid
    if (!normalized['userId'] || normalized['userId'] === context.profileId) {
      normalized['userId'] = context.profileId;
    }

    if (!normalized['profileId']) {
      normalized['profileId'] = context.profileId;
    }

    if (!normalized['createdBy']) {
      normalized['createdBy'] = context.profileId;
    }

    // Specific normalizations per tool type
    switch (toolName) {
      case 'create_project':
        return this.normalizeCreateProject(normalized, context);
      case 'create_task':
        return await this.normalizeCreateTask(normalized, context);
      case 'create_risk':
        return this.normalizeCreateRisk(normalized, context);
      case 'create_change':
        return this.normalizeCreateChange(normalized, context);
      case 'create_journal_entry':
        return this.normalizeCreateJournalEntry(normalized, context);
      default:
        return normalized;
    }
  }

  private normalizeCreateProject(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Record<string, any> {
    const normalized = { ...args };

    // Map 'title' to 'name'
    if (normalized['title'] && !normalized['name']) {
      normalized['name'] = normalized['title'];
      delete normalized['title'];
    }

    // Ensure required fields
    if (!normalized['userId']) {
      normalized['userId'] = context.profileId;
    }

    if (!normalized['status']) {
      normalized['status'] = 'PLANNING';
    }

    if (!normalized['description']) {
      normalized['description'] = '';
    }

    // Fix members array
    if (normalized['members']) {
      if (typeof normalized['members'] === 'string') {
        try {
          normalized['members'] = JSON.parse(normalized['members']);
        } catch {
          normalized['members'] = [normalized['members']];
        }
      }
      if (!Array.isArray(normalized['members'])) {
        normalized['members'] = [normalized['members']];
      }
    }

    return normalized;
  }

  private async normalizeCreateTask(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<Record<string, any>> {
    const normalized = { ...args };

    // Map 'name' to 'title' if title is missing
    if (normalized['name'] && !normalized['title']) {
      normalized['title'] = normalized['name'];
      delete normalized['name'];
    }

    // Ensure createdBy is set
    if (!normalized['createdBy']) {
      normalized['createdBy'] = context.profileId;
    }

    // Default status and normalize to uppercase
    if (!normalized['status']) {
      normalized['status'] = 'TODO';
    } else if (typeof normalized['status'] === 'string') {
      normalized['status'] = normalized['status'].toUpperCase();
    }

    // Default priority and normalize to uppercase
    if (!normalized['priority']) {
      normalized['priority'] = 'MEDIUM';
    } else if (typeof normalized['priority'] === 'string') {
      normalized['priority'] = normalized['priority'].toUpperCase();
    }

    // Check for invalid projectId (e.g. matching profileId)
    if (
      !normalized['projectId'] ||
      normalized['projectId'] === context.profileId
    ) {
      this.logger.warn(
        `Detected invalid projectId in create_task: ${normalized['projectId']}. Attempting to resolve...`
      );
      try {
        // Try to list projects to find a valid one
        const projectsResponse = await this.toolsService.callTool(
          'list_projects',
          { userId: context.profileId }
        );

        let projects = [];
        if (Array.isArray(projectsResponse)) {
          projects = projectsResponse;
        } else if (
          projectsResponse &&
          Array.isArray(projectsResponse.projects)
        ) {
          projects = projectsResponse.projects;
        } else if (typeof projectsResponse === 'string') {
          try {
            const parsed = JSON.parse(projectsResponse);
            if (Array.isArray(parsed)) projects = parsed;
            else if (parsed.projects && Array.isArray(parsed.projects))
              projects = parsed.projects;
          } catch {}
        }

        if (projects.length > 0) {
          // Use the first project found
          normalized['projectId'] = projects[0].id;
          this.logger.log(`Resolved projectId to: ${normalized['projectId']}`);
        } else {
          this.logger.warn('No projects found to resolve projectId.');
        }
      } catch (e) {
        this.logger.error('Failed to resolve projectId', e);
      }
    }

    return normalized;
  }

  private normalizeCreateRisk(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Record<string, any> {
    const normalized = { ...args };

    if (!normalized['userId']) {
      normalized['userId'] = context.profileId;
    }

    if (!normalized['status']) {
      normalized['status'] = 'IDENTIFIED';
    }

    return normalized;
  }

  private normalizeCreateChange(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Record<string, any> {
    const normalized = { ...args };

    if (!normalized['userId']) {
      normalized['userId'] = context.profileId;
    }

    if (!normalized['changeStatus']) {
      normalized['changeStatus'] = 'PROPOSED';
    }

    return normalized;
  }

  private normalizeCreateJournalEntry(
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Record<string, any> {
    const normalized = { ...args };

    if (!normalized['profileId']) {
      normalized['profileId'] = context.profileId;
    }

    if (!normalized['userId']) {
      normalized['userId'] = context.profileId;
    }

    return normalized;
  }

  /**
   * Validate a tool result
   */
  validateResult(result: any): ToolResult | null {
    const validation = this.validator.validateToolResult(result);
    if (!validation.success) {
      this.logger.error('Tool result validation failed', validation.error);
      return null;
    }
    return validation.data || null;
  }
}
