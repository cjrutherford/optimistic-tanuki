# AI Orchestration Improvements - Implementation Guide

## Overview

This document describes the comprehensive improvements made to the AI Orchestration service to enhance prompt consistency, thinking token streaming, persona TELOS integration, and benchmarking capabilities.

## Key Changes

### 1. Centralized Prompt Template Service

**File**: `apps/ai-orchestrator/src/app/prompt-template.service.ts`

The `PromptTemplateService` centralizes all prompt generation to ensure consistency and prevent confusion with user input.

**Features**:
- **System Prompt Template**: Includes full persona TELOS information (goals, skills, limitations, core objective)
- **Agent Prompt Template**: For multi-step reasoning with LangGraph
- **Workflow Detection Template**: For classifying user prompts
- **Formatting Helpers**: Format persona and user profile data for prompts

**Usage**:
```typescript
// In LangChainService
const promptTemplate = this.promptTemplate.createSystemPromptTemplate();
const personaTelos = this.promptTemplate.formatPersonaTelos(persona);
const userProfile = this.promptTemplate.formatUserProfile(profile);

const systemMessages = await promptTemplate.formatMessages({
  ...personaTelos,
  ...userProfile,
  conversationSummary,
  projectContext,
});
```

### 2. Streaming Event Infrastructure

**File**: `apps/ai-orchestrator/src/app/streaming-events.ts`

Defines structured event types for streaming to the chat interface:

- `THINKING`: Thinking tokens extracted from model responses
- `TOOL_START`: Tool call initiated with input parameters
- `TOOL_END`: Tool call completed with output and success status
- `ERROR`: Error occurred during processing
- `MESSAGE`: Regular message content
- `CHUNK`: Streaming chunk for real-time updates
- `FINAL_RESPONSE`: Final response with optional tool call summary

**Usage**:
```typescript
// Emit thinking token event
await onStreamEvent({
  type: StreamingEventType.THINKING,
  content: {
    text: thinkingText,
    raw: fullResponse,
  },
  timestamp: new Date(),
});

// Emit tool start event
await onStreamEvent({
  type: StreamingEventType.TOOL_START,
  content: {
    tool: toolCall.name,
    input: toolCall.args,
  },
  timestamp: new Date(),
});
```

### 3. Enhanced Thinking Token Handling

**File**: `apps/ai-orchestrator/src/app/workflow-control.service.ts`

**New Method**: `extractThinkingTokens(response: string)`

Extracts thinking tokens from model responses before filtering them out. This allows thinking tokens to be streamed to the UI while keeping the final response clean.

```typescript
const { thinking, filtered } = this.workflowControl.extractThinkingTokens(response);

// Emit thinking tokens as events
for (const thinkingText of thinking) {
  await onStreamEvent({
    type: StreamingEventType.THINKING,
    content: { text: thinkingText, raw: response },
  });
}

// Return filtered response to user
return { response: filtered };
```

**Detected Patterns**:
- `<think>...</think>`
- `[THINKING]...[/THINKING]`
- `**Thinking:**...`

### 4. Persona TELOS Integration

System prompts now include complete persona TELOS information:

```
You are an AI assistant named {personaName}.

{personaDescription}

# YOUR CAPABILITIES AND ROLE
Goals: {personaGoals}
Skills: {personaSkills}
Limitations: {personaLimitations}
Core Objective: {personaCoreObjective}
```

This ensures the LLM understands and leverages the persona's full capabilities and constraints.

### 5. Benchmark Script

**File**: `apps/ai-orchestrator/src/benchmark.ts`

Comprehensive benchmark script to test AI orchestration capabilities:

**Test Categories**:
1. **Workflow Control Detection**
   - Tests classification of prompts as conversational, tool_calling, or hybrid
   - Validates workflow detection accuracy

2. **Conversational Responses**
   - Tests natural language responses
   - Uses real persona configurations
   - Validates response quality and length

3. **Tool Calling**
   - Tests tool call detection and formatting
   - Validates JSON structure
   - Tests with real tool scenarios

**Usage**:
```bash
# Run with all available models
node apps/ai-orchestrator/src/benchmark.ts

# Run with specific models
node apps/ai-orchestrator/src/benchmark.ts --models qwen2.5:3b,deepseek-r1-8b

# Specify output file
node apps/ai-orchestrator/src/benchmark.ts --output custom-results.json

# Set Ollama endpoint via environment
OLLAMA_HOST=192.168.1.100 OLLAMA_PORT=11434 node apps/ai-orchestrator/src/benchmark.ts
```

**Output**:
```json
{
  "timestamp": "2026-01-14T22:46:05.991Z",
  "totalTests": 24,
  "passed": 20,
  "failed": 4,
  "averageResponseTime": 1234.56,
  "results": [...],
  "byType": {
    "workflow_control": [...],
    "conversation": [...],
    "tool_calling": [...]
  }
}
```

### 6. Updated LangChainService

**File**: `apps/ai-orchestrator/src/app/langchain.service.ts`

**Changes**:
- Uses `PromptTemplateService` instead of inline prompts
- Emits streaming events for thinking tokens, tool calls, and errors
- Properly extracts and filters thinking tokens
- Includes full persona TELOS in system messages

**New Signature**:
```typescript
async executeConversation(
  persona: PersonaTelosDto,
  profile: ProfileDto,
  conversationHistory: ChatMessage[],
  userMessage: string,
  conversationSummary: string,
  conversationId: string,
  onStreamEvent?: (event: StreamingEvent) => void | Promise<void>
)
```

**Event Flow**:
1. Thinking tokens extracted and emitted as events
2. Tool calls emit TOOL_START events before execution
3. Tool calls emit TOOL_END events after completion (or ERROR on failure)
4. Final response emitted with cleaned text (thinking tokens removed)

### 7. App Module Updates

**File**: `apps/ai-orchestrator/src/app/app.module.ts`

Added `PromptTemplateService` to the providers list.

## Integration Guide

### For Services Using LangChainService

Update your code to handle the new streaming events:

```typescript
// Before
const result = await this.langChainService.executeConversation(
  persona,
  profile,
  history,
  message,
  summary,
  convId
);

// After - with event handling
const result = await this.langChainService.executeConversation(
  persona,
  profile,
  history,
  message,
  summary,
  convId,
  async (event: StreamingEvent) => {
    switch (event.type) {
      case StreamingEventType.THINKING:
        // Display thinking process to user
        console.log('[AI Thinking]:', event.content.text);
        break;
      
      case StreamingEventType.TOOL_START:
        // Show tool being called
        console.log('[Tool Called]:', event.content.tool);
        break;
      
      case StreamingEventType.TOOL_END:
        // Show tool result
        console.log('[Tool Result]:', event.content.output);
        break;
      
      case StreamingEventType.ERROR:
        // Show error
        console.error('[Error]:', event.content.message);
        break;
    }
  }
);
```

### For Frontend/Chat Interface

The chat interface should handle and display streaming events:

```typescript
// Example WebSocket/SSE handler
socket.on('ai-event', (event: StreamingEvent) => {
  switch (event.type) {
    case 'thinking':
      // Show thinking indicator with faded text
      ui.showThinking(event.content.text);
      break;
    
    case 'tool_start':
      // Show "Calling tool: create_project..."
      ui.showToolIndicator(event.content.tool, 'start');
      break;
    
    case 'tool_end':
      // Update tool indicator to "complete"
      ui.showToolIndicator(event.content.tool, 'complete');
      break;
    
    case 'error':
      // Show error message
      ui.showError(event.content.message);
      break;
    
    case 'chunk':
      // Append to streaming message
      ui.appendToMessage(event.content);
      break;
    
    case 'final_response':
      // Finalize message display
      ui.finalizeMessage(event.content.text);
      break;
  }
});
```

## Testing

### Unit Tests

Run existing tests to ensure no regressions:

```bash
pnpm exec nx test ai-orchestrator
```

### Benchmark Tests

Run the benchmark script to validate performance:

```bash
cd apps/ai-orchestrator
node src/benchmark.ts --models qwen2.5:3b --output results.json
```

### Manual Testing

1. Start the AI orchestrator service
2. Send a conversational request
3. Verify thinking tokens are emitted as events
4. Send a tool-calling request
5. Verify TOOL_START and TOOL_END events
6. Verify final response has thinking tokens removed

## Benefits

1. **Consistency**: All prompts generated through centralized service
2. **Transparency**: Users can see thinking process and tool calls
3. **Debugging**: Easier to debug with visible thinking and tool execution
4. **Persona Awareness**: LLM properly uses persona capabilities
5. **Quality Assurance**: Benchmark script validates performance
6. **Clean Responses**: Thinking tokens filtered from final output
7. **Real-time Feedback**: Streaming events provide immediate user feedback

## Migration Notes

- **Breaking Change**: `executeConversation` signature changed (added optional `onStreamEvent` parameter)
- **Breaking Change**: `streamConversation` now yields `StreamingEvent` instead of `{ type: string; content: string }`
- Services using these methods should be updated to handle new event types
- Old behavior is maintained if `onStreamEvent` parameter is omitted

## Future Enhancements

1. **Configurable thinking display**: Allow users to toggle thinking visibility
2. **Tool call approval**: Optional user approval before executing tools
3. **Benchmark dashboard**: Web UI to visualize benchmark results
4. **A/B testing**: Compare different models side-by-side
5. **Custom personas**: Allow users to create custom personas for benchmarking
