/**
 * Standardized MCP (Model Context Protocol) Types
 * 
 * This file defines the canonical types for tool calling, tool results,
 * and MCP protocol messages used throughout the platform.
 */

import { z } from 'zod';

/**
 * OpenAI-compatible tool call format
 * This is the standard format for LLM tool calls
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Zod schema for validating tool calls
 */
export const ToolCallSchema = z.object({
  id: z.string().min(1, 'Tool call ID is required'),
  type: z.literal('function'),
  function: z.object({
    name: z.string().min(1, 'Function name is required'),
    arguments: z.string(), // Will be validated as JSON separately
  }),
});

/**
 * Parsed tool call with validated arguments
 */
export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * MCP Tool Result - standardized format for tool execution results
 */
export interface ToolResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTime?: number;
    timestamp?: Date;
  };
}

/**
 * Zod schema for validating tool results
 */
export const ToolResultSchema = z.object({
  toolCallId: z.string().min(1, 'Tool call ID is required'),
  toolName: z.string().min(1, 'Tool name is required'),
  success: z.boolean(),
  result: z.any().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    })
    .optional(),
  metadata: z
    .object({
      executionTime: z.number().optional(),
      timestamp: z.date().optional(),
    })
    .optional(),
});

/**
 * Tool execution context - provides context for tool execution
 */
export interface ToolExecutionContext {
  userId: string;
  profileId: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

/**
 * Zod schema for tool execution context
 */
export const ToolExecutionContextSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  profileId: z.string().min(1, 'Profile ID is required'),
  conversationId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * MCP Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Base message interface
 */
export interface BaseMessage {
  role: MessageRole;
  content: string;
}

/**
 * Assistant message with optional tool calls
 */
export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  tool_calls?: ToolCall[];
}

/**
 * Tool response message
 */
export interface ToolMessage extends BaseMessage {
  role: 'tool';
  tool_call_id: string;
  name?: string;
}

/**
 * Union type for all message types
 */
export type MCPMessage = BaseMessage | AssistantMessage | ToolMessage;

/**
 * Zod schema for base messages
 */
export const BaseMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
});

/**
 * Zod schema for assistant messages
 */
export const AssistantMessageSchema = BaseMessageSchema.extend({
  role: z.literal('assistant'),
  tool_calls: z.array(ToolCallSchema).optional(),
});

/**
 * Zod schema for tool messages
 */
export const ToolMessageSchema = BaseMessageSchema.extend({
  role: z.literal('tool'),
  tool_call_id: z.string().min(1, 'Tool call ID is required'),
  name: z.string().optional(),
});

/**
 * Zod schema for MCP messages
 */
export const MCPMessageSchema = z.union([
  BaseMessageSchema,
  AssistantMessageSchema,
  ToolMessageSchema,
]);

/**
 * Tool definition in OpenAI format
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
      [key: string]: any;
    };
  };
}

/**
 * Zod schema for tool definitions
 */
export const ToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().min(1, 'Function name is required'),
    description: z.string(),
    parameters: z.object({
      type: z.literal('object'),
      properties: z.record(z.any()),
      required: z.array(z.string()).optional(),
    }).passthrough(), // Allow additional properties
  }),
});

/**
 * Error codes for MCP operations
 */
export enum MCPErrorCode {
  INVALID_TOOL_CALL = 'INVALID_TOOL_CALL',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONTEXT_MISSING = 'CONTEXT_MISSING',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

/**
 * MCP Error class for standardized error handling
 */
export class MCPError extends Error {
  constructor(
    public code: MCPErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: MCPErrorCode;
    message: string;
    details?: any;
  };
}
