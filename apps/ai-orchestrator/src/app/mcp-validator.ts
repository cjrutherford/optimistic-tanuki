/**
 * MCP Validator
 *
 * Provides validation utilities for MCP tool calls, results, and messages.
 * Ensures strict adherence to the MCP protocol.
 */

import { Logger } from '@nestjs/common';
import {
  ToolCall,
  ToolCallSchema,
  ParsedToolCall,
  ToolResult,
  ToolResultSchema,
  MCPMessage,
  MCPMessageSchema,
  AssistantMessage,
  AssistantMessageSchema,
  ToolMessage,
  ToolMessageSchema,
  ToolExecutionContext,
  ToolExecutionContextSchema,
  MCPError,
  MCPErrorCode,
  ValidationResult,
} from '@optimistic-tanuki/models';

export class MCPValidator {
  private readonly logger = new Logger(MCPValidator.name);

  /**
   * Validate a tool call and parse its arguments
   */
  validateToolCall(toolCall: any): ValidationResult<ParsedToolCall> {
    try {
      // Validate structure
      const validatedCall = ToolCallSchema.parse(toolCall);

      // Parse and validate arguments JSON
      let parsedArgs: Record<string, any>;
      try {
        parsedArgs = JSON.parse(validatedCall.function.arguments);
        if (
          typeof parsedArgs !== 'object' ||
          parsedArgs === null ||
          Array.isArray(parsedArgs)
        ) {
          throw new Error('Arguments must be a JSON object');
        }
      } catch (error) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_ARGUMENTS,
            message: `Failed to parse tool arguments: ${error.message}`,
            details: { arguments: validatedCall.function.arguments },
          },
        };
      }

      return {
        success: true,
        data: {
          id: validatedCall.id,
          name: validatedCall.function.name,
          arguments: parsedArgs,
        },
      };
    } catch (error) {
      this.logger.error('Tool call validation failed:', error);
      return {
        success: false,
        error: {
          code: MCPErrorCode.INVALID_TOOL_CALL,
          message: `Invalid tool call structure: ${error.message}`,
          details: { toolCall, zodError: error },
        },
      };
    }
  }

  /**
   * Validate multiple tool calls
   */
  validateToolCalls(toolCalls: any[]): ValidationResult<ParsedToolCall[]> {
    const results: ParsedToolCall[] = [];
    const errors: any[] = [];

    for (let i = 0; i < toolCalls.length; i++) {
      const result = this.validateToolCall(toolCalls[i]);
      if (result.success && result.data) {
        results.push(result.data);
      } else {
        errors.push({
          index: i,
          error: result.error,
        });
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: MCPErrorCode.INVALID_TOOL_CALL,
          message: `${errors.length} tool call(s) failed validation`,
          details: { errors, validCount: results.length },
        },
      };
    }

    return {
      success: true,
      data: results,
    };
  }

  /**
   * Validate a tool result
   */
  validateToolResult(toolResult: any): ValidationResult<ToolResult> {
    try {
      const validated = ToolResultSchema.parse(toolResult);

      // Additional business logic validation
      if (validated.success && !validated.result) {
        this.logger.warn(
          `Tool result for ${validated.toolName} marked as success but has no result data`
        );
      }

      if (!validated.success && !validated.error) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.VALIDATION_FAILED,
            message:
              'Tool result marked as failure but has no error information',
            details: toolResult,
          },
        };
      }

      return {
        success: true,
        data: validated as unknown as ToolResult,
      };
    } catch (error) {
      this.logger.error('Tool result validation failed:', error);
      return {
        success: false,
        error: {
          code: MCPErrorCode.VALIDATION_FAILED,
          message: `Invalid tool result structure: ${error.message}`,
          details: { toolResult, zodError: error },
        },
      };
    }
  }

  /**
   * Validate an MCP message
   */
  validateMessage(message: any): ValidationResult<MCPMessage> {
    try {
      const validated = MCPMessageSchema.parse(message);
      return {
        success: true,
        data: validated as unknown as MCPMessage,
      };
    } catch (error) {
      this.logger.error('Message validation failed:', error);
      return {
        success: false,
        error: {
          code: MCPErrorCode.VALIDATION_FAILED,
          message: `Invalid message structure: ${error.message}`,
          details: { message, zodError: error },
        },
      };
    }
  }

  /**
   * Validate an assistant message with tool calls
   */
  validateAssistantMessage(message: any): ValidationResult<AssistantMessage> {
    try {
      const validated = AssistantMessageSchema.parse(message);

      // If tool_calls are present, validate them
      if (validated.tool_calls && validated.tool_calls.length > 0) {
        const toolCallsValidation = this.validateToolCalls(
          validated.tool_calls
        );
        if (!toolCallsValidation.success) {
          return {
            success: false,
            error: toolCallsValidation.error,
          };
        }
      }

      return {
        success: true,
        data: validated as unknown as AssistantMessage,
      };
    } catch (error) {
      this.logger.error('Assistant message validation failed:', error);

      // If the parse error came from invalid tool_calls specifically,
      // normalize it to INVALID_TOOL_CALL so callers can distinguish
      // structural issues with tool calls from general message validation.
      const issues: any[] = (error && (error.errors || error.issues)) || [];
      const hasToolCallsError = issues.some((iss) => {
        try {
          return Array.isArray(iss.path) && iss.path[0] === 'tool_calls';
        } catch (_) {
          return false;
        }
      });

      if (hasToolCallsError) {
        return {
          success: false,
          error: {
            code: MCPErrorCode.INVALID_TOOL_CALL,
            message: 'Assistant message contains invalid tool_calls',
            details: { message, zodError: error },
          },
        };
      }

      return {
        success: false,
        error: {
          code: MCPErrorCode.VALIDATION_FAILED,
          message: `Invalid assistant message: ${error.message}`,
          details: { message, zodError: error },
        },
      };
    }
  }

  /**
   * Validate a tool message
   */
  validateToolMessage(message: any): ValidationResult<ToolMessage> {
    try {
      const validated = ToolMessageSchema.parse(message);
      return {
        success: true,
        data: validated as unknown as ToolMessage,
      };
    } catch (error) {
      this.logger.error('Tool message validation failed:', error);
      return {
        success: false,
        error: {
          code: MCPErrorCode.VALIDATION_FAILED,
          message: `Invalid tool message: ${error.message}`,
          details: { message, zodError: error },
        },
      };
    }
  }

  /**
   * Validate tool execution context
   */
  validateContext(context: any): ValidationResult<ToolExecutionContext> {
    try {
      const validated = ToolExecutionContextSchema.parse(context);
      return {
        success: true,
        data: validated as unknown as ToolExecutionContext,
      };
    } catch (error) {
      this.logger.error('Context validation failed:', error);
      return {
        success: false,
        error: {
          code: MCPErrorCode.CONTEXT_MISSING,
          message: `Invalid execution context: ${error.message}`,
          details: { context, zodError: error },
        },
      };
    }
  }

  /**
   * Create a standardized error tool result
   */
  createErrorResult(
    toolCallId: string,
    toolName: string,
    error: Error | MCPError,
    executionTime?: number
  ): ToolResult {
    const errorCode =
      error instanceof MCPError
        ? error.code
        : MCPErrorCode.TOOL_EXECUTION_FAILED;

    const errorDetails = error instanceof MCPError ? error.details : undefined;

    return {
      toolCallId,
      toolName,
      success: false,
      error: {
        code: errorCode,
        message: error.message,
        details: errorDetails,
      },
      metadata: {
        executionTime,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Create a standardized success tool result
   */
  createSuccessResult(
    toolCallId: string,
    toolName: string,
    result: any,
    executionTime?: number
  ): ToolResult {
    return {
      toolCallId,
      toolName,
      success: true,
      result,
      metadata: {
        executionTime,
        timestamp: new Date(),
      },
    };
  }
}
