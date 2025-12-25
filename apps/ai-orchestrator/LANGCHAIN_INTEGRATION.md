# LangChain.js Integration Guide

## Overview

The AI orchestrator has been fully migrated to use LangChain.js, replacing the custom prompt engineering and tool execution implementation. This provides better performance, consistency, and maintainability.

## Architecture

### Before (Custom Implementation)

```
User Message
  ↓
Custom buildConversationPreamble() (100+ lines)
  ↓
Manual tool call parsing (OpenAI, XML, JSON formats)
  ↓
Custom MCPToolExecutor
  ↓
Manual message assembly and emission
```

### After (LangChain)

```
User Message
  ↓
LangChain ChatPromptTemplate
  ↓
ChatOllama (qwen3-coder)
  ↓
DynamicStructuredTool (auto-converted from MCP)
  ↓
MCPToolExecutor (preserved for MCP compatibility)
  ↓
Streaming response with real-time emission
```

## Key Components

### 1. LangChainService

**Purpose**: Central service for all AI orchestration using LangChain

**Features**:
- ChatOllama integration for qwen3-coder model
- Automatic prompt template creation from persona + profile
- MCP tool to LangChain tool conversion
- Streaming support for real-time updates

**Example Usage**:
```typescript
const result = await langChainService.executeConversation(
  persona,      // PersonaTelosDto
  profile,      // ProfileDto  
  history,      // ChatMessage[]
  userMessage,  // string
  summary,      // string
  convId        // string
);

console.log(result.response);
console.log(result.intermediateSteps);
```

### 2. Tool Conversion

**MCP Tools → LangChain DynamicStructuredTool**

The service automatically converts MCP tools to LangChain format:

```typescript
// MCP Tool
{
  name: "create_project",
  description: "Create a new project",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      userId: { type: "string" }
    },
    required: ["name"]
  }
}

// Converted to DynamicStructuredTool
new DynamicStructuredTool({
  name: "create_project",
  description: "Create a new project",
  schema: z.object({
    name: z.string(),
    userId: z.string().optional()
  }),
  func: async (input) => {
    // Enriches with userId, profileId
    // Calls MCPToolExecutor
    // Returns result
  }
})
```

### 3. Prompt Management

**System Prompt Template**:

```typescript
`You are ${persona.name}, ${persona.description}

# USER CONTEXT
- User ID: ${profile.id}
- User Name: ${profile.profileName}

# CONVERSATION SUMMARY
${conversationSummary}

# RULES
- Always use userId/profileId = ${profile.id}
- Use ONE tool per response
- Provide clear responses after tool execution`
```

**Simplified from 100+ lines to ~20 lines**

### 4. Message Conversion

LangChain uses specific message types:

```typescript
// User messages
new HumanMessage("User input")

// AI responses  
new AIMessage("AI response")

// System prompts
new SystemMessage("System instructions")
```

Automatic conversion from ChatMessage format:
- `role: 'user'` → HumanMessage
- `role: 'assistant'` → AIMessage
- `type: 'system'` → SystemMessage

## Migration Benefits

### 1. Code Simplification

**Before**:
- `app.service.ts`: 700+ lines
- `prompt-engineering.ts`: 166 lines
- `xml-tool-parser.ts`: 144 lines
- **Total**: 1000+ lines

**After**:
- `app.service.ts`: ~300 lines
- `langchain.service.ts`: ~150 lines
- **Total**: 450 lines

**Reduction**: 55% less code

### 2. Improved Maintainability

- No manual prompt string concatenation
- No custom tool call parsers
- Built-in error handling
- Standardized patterns

### 3. Better Performance

- Optimized token management
- Efficient streaming
- Built-in caching (future)
- Retry logic (future)

### 4. Enhanced Features

- **Streaming**: Real-time token-by-token responses
- **Memory**: Built-in conversation memory (can be added)
- **Observability**: LangSmith integration (can be added)
- **Tool Chaining**: Sequential tool calls

## Configuration

### Environment Variables

```bash
# Ollama base URL (defaults to prompt-proxy)
OLLAMA_BASE_URL=http://prompt-proxy:11434

# LangSmith tracing (optional, for observability)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-api-key
```

### Model Configuration

Currently using `qwen3-coder` via Ollama:

```typescript
new ChatOllama({
  model: 'qwen3-coder',
  baseUrl: process.env.OLLAMA_BASE_URL,
  temperature: 0.7,
});
```

**Easily switchable to other models**:
- `llama2`
- `mistral`
- `codellama`
- Or any OpenAI-compatible model

## Real-Time Message Delivery

### Preserved Functionality

The polling mechanism for real-time message delivery is **preserved**:

1. User sends message
2. Gateway starts 500ms polling
3. LangChain streams responses
4. Each chunk posted to chat collector
5. Polling detects new messages
6. Clients updated in real-time

### Streaming Implementation

```typescript
const stream = langChainService.streamConversation(...);

for await (const chunk of stream) {
  if (chunk.type === 'tool_call') {
    // Emit tool notification
    await postMessage({
      content: chunk.content,  // "🔧 Calling tool: X"
      type: 'system'
    });
  }
  
  if (chunk.type === 'final_response') {
    // Emit final response
    await postMessage({
      content: chunk.content,
      type: 'chat'
    });
  }
}
```

## Tool Execution Flow

### 1. Tool Discovery

```typescript
const mcpTools = await toolsService.listTools();
// Returns: [{ name, description, inputSchema }, ...]
```

### 2. Schema Conversion

```typescript
const zodSchema = convertToZodSchema(mcpTool.inputSchema);
// JSON Schema → Zod schema for validation
```

### 3. Tool Creation

```typescript
new DynamicStructuredTool({
  name: tool.name,
  schema: zodSchema,
  func: async (input) => {
    // Enrich with context
    // Execute via MCPToolExecutor
    // Return result
  }
})
```

### 4. Tool Execution

```typescript
// LangChain handles:
// - Schema validation
// - Input formatting
// - Error catching
// - Result parsing

const result = await tool.func({ name: "Project" });
```

## Error Handling

### Tool Execution Errors

```typescript
try {
  const result = await tool.func(input);
  return result;
} catch (error) {
  // LangChain catches and formats error
  throw new Error(`Tool execution failed: ${error.message}`);
}
```

### LLM Errors

```typescript
try {
  const response = await llm.invoke(messages);
  return response;
} catch (error) {
  logger.error('LangChain execution failed:', error);
  // Falls back to error response
  throw new RpcException('AI orchestration failed');
}
```

## Testing

### Unit Tests

```typescript
describe('LangChainService', () => {
  it('should execute conversation', async () => {
    const result = await service.executeConversation(
      mockPersona,
      mockProfile,
      [],
      'Hello',
      '',
      'conv-1'
    );
    
    expect(result.response).toBeDefined();
  });

  it('should stream conversation', async () => {
    const stream = service.streamConversation(...);
    const chunks = [];
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    expect(chunks.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('AI Orchestrator with LangChain', () => {
  it('should handle tool calls', async () => {
    // Send message requiring tool
    const response = await updateConversation({
      conversation,
      aiPersonas: [persona]
    });
    
    // Verify tool call message
    expect(response).toContainEqual(
      expect.objectContaining({
        content: expect.stringContaining('🔧 Calling tool:')
      })
    );
  });
});
```

## Future Enhancements

### 1. Memory Integration

```typescript
import { BufferMemory } from 'langchain/memory';

const memory = new BufferMemory({
  returnMessages: true,
  memoryKey: 'chat_history',
});

// Automatic conversation history management
```

### 2. LangSmith Observability

```typescript
// Enable tracing
process.env.LANGCHAIN_TRACING_V2 = 'true';

// All LangChain calls automatically traced
// View in LangSmith dashboard:
// - Prompts
// - Tool calls
// - Responses
// - Latencies
```

### 3. Agent Executor

```typescript
import { AgentExecutor } from 'langchain/agents';

// Multi-step reasoning
const agent = new AgentExecutor({
  agent,
  tools,
  maxIterations: 6,
});

// Handles complex multi-tool workflows
```

### 4. Custom Chains

```typescript
import { LLMChain } from 'langchain/chains';

// Custom conversation chains
const chain = new LLMChain({
  llm,
  prompt,
  memory,
});
```

## Migration Checklist

- [x] Install LangChain dependencies
- [x] Create LangChainService
- [x] Convert prompts to LangChain format
- [x] Convert tools to DynamicStructuredTool
- [x] Update app.service.ts
- [x] Update app.module.ts
- [x] Preserve real-time polling
- [x] Preserve tool call notifications
- [x] TypeScript compilation passing
- [ ] Add unit tests for LangChainService
- [ ] Add integration tests
- [ ] Enable LangSmith observability (optional)
- [ ] Add memory management (optional)
- [ ] Optimize prompt templates (ongoing)

## Troubleshooting

### Issue: Tool not found

**Cause**: MCP tool list empty or tool name mismatch

**Solution**:
```typescript
const tools = await toolsService.listTools();
console.log('Available tools:', tools.map(t => t.name));
```

### Issue: Schema validation fails

**Cause**: Input doesn't match Zod schema

**Solution**:
```typescript
// Check generated schema
const schema = convertToZodSchema(jsonSchema);
console.log(schema);

// Validate manually
schema.parse(input);
```

### Issue: Streaming not working

**Cause**: Model doesn't support streaming

**Solution**:
```typescript
// Fall back to non-streaming
const result = await llm.invoke(messages);
// Instead of: await llm.stream(messages)
```

## Summary

✅ **Migrated**: Custom → LangChain
✅ **Simplified**: 1000+ lines → 450 lines  
✅ **Performance**: Built-in optimizations
✅ **Maintainability**: Standardized patterns
✅ **Features**: Streaming, tools, memory (future)
✅ **Compatibility**: All existing features preserved

LangChain.js provides a robust foundation for AI orchestration, replacing fragile custom implementations with battle-tested, community-maintained code.
