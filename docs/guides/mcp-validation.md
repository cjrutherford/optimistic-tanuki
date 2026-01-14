# MCP Tool Call Validation and Standardization

## Overview

This document describes the standardized approach to Model Context Protocol (MCP) tool calling, validation, and execution within the Optimistic Tanuki platform.

## Architecture

### Components

1. **MCP Types** (`libs/models/src/lib/libs/mcp-types.ts`)

   - Canonical TypeScript interfaces for all MCP operations
   - Zod schemas for runtime validation
   - Error codes and error handling types

2. **MCP Validator** (`apps/ai-orchestrator/src/app/mcp-validator.ts`)

   - Validates tool calls before execution
   - Validates tool results after execution
   - Validates MCP messages and execution context
   - Provides helper methods for creating standardized results

3. **MCP Tool Executor** (`apps/ai-orchestrator/src/app/mcp-tool-executor.ts`)

   - Executes tool calls with full validation pipeline
   - Normalizes arguments based on context
   - Handles errors consistently
   - Tracks execution metrics

4. **AI Orchestrator** (`apps/ai-orchestrator/src/app/app.service.ts`)
   - Uses MCPToolExecutor for all tool execution
   - Manages conversation flow
   - Handles both OpenAI and legacy JSON formats

## Tool Call Flow

```
1. LLM Response
   ↓
2. Tool Call Validation (MCPValidator)
   ↓
3. Context Validation (MCPValidator)
   ↓
4. Argument Normalization (MCPToolExecutor)
   ↓
5. Tool Execution (ToolsService)
   ↓
6. Result Formatting (MCPToolExecutor)
   ↓
7. Result Validation (MCPValidator)
   ↓
8. Response to LLM
```

## Tool Call Formats

### OpenAI Format (Standard)

```typescript
{
  id: "call_123",
  type: "function",
  function: {
    name: "create_project",
    arguments: '{"name": "My Project", "userId": "user-123"}'
  }
}
```

### Legacy JSON Format (Supported)

```typescript
{
  tool: "create_project",
  args: {
    name: "My Project",
    userId: "user-123"
  }
}
```

Both formats are automatically converted to the standard OpenAI format before execution.

## Tool Result Format

All tool executions return a standardized `ToolResult`:

```typescript
interface ToolResult {
  toolCallId: string; // ID of the tool call
  toolName: string; // Name of the tool
  success: boolean; // Whether execution succeeded
  result?: any; // Result data (if successful)
  error?: {
    // Error information (if failed)
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    // Execution metadata
    executionTime?: number;
    timestamp?: Date;
  };
}
```

### Success Example

```typescript
{
  toolCallId: "call_123",
  toolName: "create_project",
  success: true,
  result: {
    id: "proj-456",
    name: "My Project",
    status: "PLANNING"
  },
  metadata: {
    executionTime: 150,
    timestamp: new Date()
  }
}
```

### Error Example

```typescript
{
  toolCallId: "call_123",
  toolName: "create_project",
  success: false,
  error: {
    code: "INVALID_ARGUMENTS",
    message: "Project name is required",
    details: { field: "name" }
  },
  metadata: {
    executionTime: 50,
    timestamp: new Date()
  }
}
```

## Validation Rules

### Tool Call Validation

1. **ID Required**: Tool call must have a non-empty ID
2. **Type Must Be 'function'**: Only function-type tools are supported
3. **Name Required**: Function name must be non-empty
4. **Arguments Must Be Valid JSON**: Arguments must parse as JSON object
5. **Arguments Must Be Object**: Parsed arguments must be an object (not array or null)

### Context Validation

1. **userId Required**: Non-empty user ID must be provided
2. **profileId Required**: Non-empty profile ID must be provided
3. **conversationId Optional**: Conversation ID is optional

### Result Validation

1. **toolCallId Required**: Must match the original tool call ID
2. **toolName Required**: Must match the tool that was executed
3. **Success Flag Required**: Must be boolean
4. **Result or Error Required**: If success=true, result should be present; if success=false, error must be present

## Argument Normalization

The MCPToolExecutor automatically normalizes arguments based on context and tool type:

### Global Normalization

- **userId**: Always set to current user's profile ID
- **profileId**: Always set to current user's profile ID
- **createdBy**: Always set to current user's profile ID

### Tool-Specific Normalization

#### create_project

- Maps `title` → `name`
- Maps `createdBy` → `userId`
- Sets default `status` to 'PLANNING'
- Sets default `description` to empty string
- Converts `members` string to array

#### create_task

- Sets default `status` to 'TODO'
- Sets default `priority` to 'MEDIUM'
- Ensures `createdBy` is set

#### create_risk

- Sets default `status` to 'IDENTIFIED'

#### create_change

- Sets default `changeStatus` to 'PROPOSED'

#### create_journal_entry

- Ensures both `profileId` and `userId` are set

## Error Codes

```typescript
enum MCPErrorCode {
  INVALID_TOOL_CALL = 'INVALID_TOOL_CALL',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONTEXT_MISSING = 'CONTEXT_MISSING',
  UNAUTHORIZED = 'UNAUTHORIZED',
}
```

## Usage Examples

### Executing a Tool Call

```typescript
const executor = new MCPToolExecutor(toolsService);

const toolCall = {
  id: 'call_123',
  type: 'function',
  function: {
    name: 'create_project',
    arguments: JSON.stringify({ name: 'My Project' }),
  },
};

const context = {
  userId: 'user-123',
  profileId: 'profile-456',
  conversationId: 'conv-789',
};

const result = await executor.executeToolCall(toolCall, context);

if (result.success) {
  console.log('Project created:', result.result);
} else {
  console.error('Error:', result.error);
}
```

### Validating Tool Calls

```typescript
const validator = new MCPValidator();

const validation = validator.validateToolCall(toolCall);

if (!validation.success) {
  console.error('Invalid tool call:', validation.error);
} else {
  const parsed = validation.data;
  console.log('Tool:', parsed.name);
  console.log('Arguments:', parsed.arguments);
}
```

## Testing

### Unit Tests

- **mcp-validator.spec.ts**: 90+ test cases covering all validation scenarios
- **mcp-tool-executor.spec.ts**: Comprehensive executor tests including normalization
- **tool-formatter.spec.ts**: Tool transformation tests

### Integration Tests

- **mcp-integration.spec.ts**: End-to-end flow tests
  - Successful tool execution
  - Error handling
  - Legacy format support
  - Multiple iterations
  - Multiple personas

## Best Practices

1. **Always Use MCPToolExecutor**: Don't call ToolsService directly
2. **Provide Complete Context**: Include userId, profileId, and conversationId
3. **Handle Both Success and Failure**: Check `result.success` before accessing data
4. **Log Execution Metrics**: Use `metadata.executionTime` for performance monitoring
5. **Validate Before Execution**: Use MCPValidator for pre-flight checks
6. **Use Typed Interfaces**: Import types from `@optimistic-tanuki/models`

## Migration Guide

### From Direct ToolsService Calls

**Before:**

```typescript
const response = await this.toolsService.callTool('create_project', args);
```

**After:**

```typescript
const context: ToolExecutionContext = {
  userId: profile.id,
  profileId: profile.id,
  conversationId: conversation.id,
};

const toolCall = {
  id: 'call_123',
  type: 'function',
  function: {
    name: 'create_project',
    arguments: JSON.stringify(args),
  },
};

const result = await this.mcpExecutor.executeToolCall(toolCall, context);
```

### From Manual Normalization

The executor handles all normalization automatically. Remove manual argument manipulation:

**Before:**

```typescript
if (!args.userId) {
  args.userId = profileId;
}
if (args.title) {
  args.name = args.title;
  delete args.title;
}
```

**After:**

```typescript
// Normalization happens automatically in executeToolCall
```

## Security Considerations

1. **Context Isolation**: Each tool execution gets its own context
2. **User Validation**: userId and profileId are always validated
3. **Argument Sanitization**: All arguments are validated before execution
4. **Error Information**: Error details don't expose sensitive data
5. **Execution Tracking**: All executions are logged with timestamps

## Performance Monitoring

Track these metrics from `ToolResult.metadata`:

- **executionTime**: Time taken to execute the tool (milliseconds)
- **timestamp**: When the tool was executed

Use these for:

- Identifying slow tools
- Detecting performance regressions
- Optimizing tool implementations
- Setting appropriate timeouts

## Future Enhancements

1. **Tool Call Batching**: Execute multiple independent tools in parallel
2. **Caching**: Cache tool results for idempotent operations
3. **Rate Limiting**: Prevent excessive tool calls from single users
4. **Tool Permissions**: Role-based access control for tools
5. **Retry Logic**: Automatic retry for transient failures
6. **Circuit Breaker**: Prevent cascading failures
