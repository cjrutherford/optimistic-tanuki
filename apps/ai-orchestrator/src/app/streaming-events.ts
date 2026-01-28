/**
 * Streaming Event Types
 *
 * Defines event types that can be streamed to the chat interface
 */

export enum StreamingEventType {
  THINKING = 'thinking',
  TOOL_START = 'tool_start',
  TOOL_END = 'tool_end',
  ERROR = 'error',
  MESSAGE = 'message',
  CHUNK = 'chunk',
  FINAL_RESPONSE = 'final_response',
}

export interface StreamingEvent {
  type: StreamingEventType;
  content: any;
  timestamp?: Date;
}

export interface ThinkingEvent extends StreamingEvent {
  type: StreamingEventType.THINKING;
  content: {
    text: string;
    raw: string;
  };
}

export interface ToolStartEvent extends StreamingEvent {
  type: StreamingEventType.TOOL_START;
  content: {
    tool: string;
    input: unknown;
  };
}

export interface ToolEndEvent extends StreamingEvent {
  type: StreamingEventType.TOOL_END;
  content: {
    tool: string;
    output: unknown;
    success: boolean;
  };
}

export interface ErrorEvent extends StreamingEvent {
  type: StreamingEventType.ERROR;
  content: {
    message: string;
    details?: any;
  };
}

export interface MessageEvent extends StreamingEvent {
  type: StreamingEventType.MESSAGE;
  content: string;
}

export interface ChunkEvent extends StreamingEvent {
  type: StreamingEventType.CHUNK;
  content: string;
}

export interface FinalResponseEvent extends StreamingEvent {
  type: StreamingEventType.FINAL_RESPONSE;
  content: {
    text: string;
    toolCalls?: Array<{
      tool: string;
      input: unknown;
      output: unknown;
    }>;
  };
}
