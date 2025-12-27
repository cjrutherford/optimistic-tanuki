# AI Orchestrator - Remaining Work & Future Enhancements

This document outlines work that could not be completed in the current task cycle and suggests future enhancements to improve the AI orchestration system.

## ✅ Recently Completed

### LangGraph & LangChain Agent Integration (COMPLETED)

**Status**: ✅ Implemented  
**Priority**: High  
**Completed**: Current commit

**What Was Delivered**:

1. **Context Storage Service** (`context-storage.service.ts`)
   - ✅ Redis-based persistent storage (profileId → context mapping)
   - ✅ 7-day TTL with automatic expiration
   - ✅ CRUD operations for conversation context
   - ✅ Statistics and monitoring
   - ✅ Comprehensive tests (context-storage.service.spec.ts)

2. **LangGraph Service** (`langgraph.service.ts`)
   - ✅ StateGraph for conversation flow management
   - ✅ Automatic context loading from Redis
   - ✅ Topic extraction from messages
   - ✅ Summary generation
   - ✅ Context persistence to Redis
   - ✅ State reducers for proper state management

3. **LangChain Agent Service** (`langchain-agent.service.ts`)
   - ✅ AgentExecutor for automatic tool calling
   - ✅ Tool discovery via list_tools
   - ✅ Multi-step reasoning (query → create workflows)
   - ✅ Automatic parameter enrichment (userId, profileId)
   - ✅ Intermediate step tracking
   - ✅ Max iteration safety (10 iterations max)

4. **Documentation** (`LANGGRAPH_AGENT_INTEGRATION.md`)
   - ✅ Complete architecture guide
   - ✅ Usage examples
   - ✅ Integration points
   - ✅ Performance considerations
   - ✅ Troubleshooting guide

5. **Dependencies**
   - ✅ Added @langchain/langgraph to package.json
   - ✅ Registered new services in app.module.ts

**Benefits**:
- 🎯 Persistent context across sessions (Redis-backed)
- 🤖 Intelligent multi-step tool execution (Agent)
- 📊 Structured state management (LangGraph)
- 🔄 Automatic context enrichment
- 📈 Scalable (multi-instance ready via Redis)

**See**: `LANGGRAPH_AGENT_INTEGRATION.md` for complete documentation

---

## 🚧 Incomplete Work

### 1. Full LLM Response Testing with Mocked Ollama

**Status**: Not Implemented  
**Priority**: High  
**Effort**: Medium (2-3 days)

**Description**:
The current test suite (`langchain-behavior.spec.ts`) validates tool binding, schema conversion, and prompt generation, but doesn't test actual LLM responses. We need integration tests that mock the Ollama LLM to validate:

- Which tools the LLM chooses to call for specific user requests
- Tool call parameter accuracy
- Multi-step reasoning (e.g., query_projects → create_task)
- Error handling when tools fail
- Response quality and naturalness

**Implementation Approach**:
```typescript
describe('LLM Response Scenarios', () => {
  beforeEach(() => {
    // Mock ChatOllama to return predefined responses
    jest.mock('@langchain/ollama', () => ({
      ChatOllama: jest.fn().mockImplementation(() => ({
        bindTools: jest.fn().mockReturnValue({
          invoke: mockInvoke,
          stream: mockStream,
        }),
      })),
    }));
  });

  it('should call query_projects when user says "show my projects"', async () => {
    // Mock LLM to return tool call
    mockInvoke.mockResolvedValue({
      content: '',
      tool_calls: [{
        name: 'query_projects',
        args: { userId: 'user-123' },
      }],
    });

    const result = await service.executeConversation(...);
    
    expect(mockInvoke).toHaveBeenCalled();
    // Verify tool call was made
  });

  it('should perform multi-step: query_projects → create_task', async () => {
    // Test that LLM:
    // 1. First queries projects to get projectId
    // 2. Then creates task with that projectId
  });
});
```

**Blocker**:
Mocking the streaming LLM responses requires deep knowledge of LangChain's internal message structure and isn't trivial to set up correctly.

---

### 2. Real-Time Streaming Validation

**Status**: Partially Implemented  
**Priority**: Medium  
**Effort**: Small (1 day)

**Description**:
While real-time streaming is implemented (`streamConversation`), we don't have automated tests to verify that:

- Chunks are emitted in real-time (not buffered)
- Tool call notifications are emitted before tool execution
- Final response is emitted after all processing
- Streaming works correctly when errors occur mid-stream

**Implementation Approach**:
```typescript
describe('Real-Time Streaming', () => {
  it('should emit chunks immediately, not buffered', async () => {
    const chunks: any[] = [];
    const startTime = Date.now();

    for await (const chunk of service.streamConversation(...)) {
      chunks.push({
        ...chunk,
        timestamp: Date.now() - startTime,
      });
    }

    // Verify chunks came in incrementally, not all at once
    expect(chunks[0].timestamp).toBeLessThan(100); // First chunk within 100ms
    expect(chunks[chunks.length - 1].timestamp).toBeGreaterThan(500); // Took some time
  });

  it('should emit tool call notification before executing tool', async () => {
    // Mock tool execution to take 2 seconds
    jest.spyOn(mcpExecutor, 'executeToolCall').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true, result: 'Done' };
    });

    const chunks: any[] = [];
    for await (const chunk of service.streamConversation(...)) {
      chunks.push(chunk);
    }

    // Find tool notification chunk
    const toolNotification = chunks.find(c => c.content.includes('🔧 Calling tool:'));
    const finalResponse = chunks[chunks.length - 1];

    expect(toolNotification).toBeDefined();
    expect(chunks.indexOf(toolNotification)).toBeLessThan(chunks.indexOf(finalResponse));
  });
});
```

**Blocker**:
Requires setting up timing-based tests which can be flaky in CI/CD environments.

---

### 3. Tool Call Format Validation Tests

**Status**: Not Implemented  
**Priority**: Low  
**Effort**: Small (4-6 hours)

**Description**:
The `extractToolCallFromText` method in `app.service.ts` handles 4 different tool call formats (XML, Markdown JSON, Plain JSON, OpenAI). We should have comprehensive tests for all edge cases:

- Malformed JSON in markdown blocks
- Nested XML tags
- Mixed formats in single response
- Unicode and special characters in tool calls
- Very large tool call payloads

**Implementation Approach**:
```typescript
describe('Tool Call Extraction', () => {
  it('should extract tool call from markdown with syntax errors', () => {
    const text = '```json\n{name: "tool", arguments: {id: "123"}}\n```';
    const result = service.extractToolCallFromText(text);
    // Should still parse despite missing quotes
  });

  it('should handle nested XML correctly', () => {
    const text = `
      <tool_call>
        <name>create_project</name>
        <arguments>
          <metadata>
            <tags>
              <tag>important</tag>
            </tags>
          </metadata>
        </arguments>
      </tool_call>
    `;
    const result = service.extractToolCallFromText(text);
    // Should parse nested structure
  });
});
```

**Blocker**:
None - just needs time allocation.

---

## 🔮 Future Enhancements

### 1. LangChain Agent Integration

**Priority**: High  
**Effort**: Large (5-7 days)  
**Impact**: Major performance and capability improvement

**Description**:
Replace the current manual tool calling loop with LangChain's AgentExecutor. This provides:

- Built-in ReAct (Reasoning + Acting) pattern
- Automatic multi-step reasoning
- Better error recovery
- Tool call history management
- Thought process visibility

**Implementation Approach**:
```typescript
import { AgentExecutor } from '@langchain/agents';
import { createReactAgent } from '@langchain/core/agents';

async executeConversationWithAgent(
  persona: PersonaTelosDto,
  profile: ProfileDto,
  conversationHistory: ChatMessage[],
  userMessage: string,
): Promise<any> {
  const tools = await this.createTools(profile.id, conversationId);
  
  const agent = await createReactAgent({
    llm: this.llm,
    tools,
    prompt: this.createAgentPrompt(persona, profile),
  });

  const executor = new AgentExecutor({
    agent,
    tools,
    maxIterations: 10,
    verbose: true,
  });

  return await executor.invoke({
    input: userMessage,
    chat_history: this.convertChatHistory(conversationHistory),
  });
}
```

**Benefits**:
- LLM can perform multi-step reasoning automatically
- Better handling of complex workflows
- Built-in retry logic
- Thought process can be shown to users
- Less custom code to maintain

**Challenges**:
- Need to adapt current real-time streaming approach
- Agent prompts need careful tuning
- May require changes to message emission logic

---

### 2. Conversation Memory with LangChain

**Priority**: Medium  
**Effort**: Medium (2-3 days)  
**Impact**: Improved context awareness

**Description**:
Integrate LangChain's memory modules to maintain better conversation context:

- `BufferMemory` - Keep recent messages
- `ConversationSummaryMemory` - Automatic summarization
- `EntityMemory` - Track entities mentioned (project IDs, task IDs, etc.)

**Implementation Approach**:
```typescript
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';

class LangChainService {
  private conversations: Map<string, BufferMemory> = new Map();

  async executeConversation(...) {
    let memory = this.conversations.get(conversationId);
    if (!memory) {
      memory = new BufferMemory({
        returnMessages: true,
        memoryKey: 'chat_history',
      });
      this.conversations.set(conversationId, memory);
    }

    const chain = new ConversationChain({
      llm: this.llm,
      memory,
    });

    return await chain.invoke({ input: userMessage });
  }
}
```

**Benefits**:
- Automatic context window management
- Better handling of long conversations
- Reduced token usage (summarization)
- Entity tracking for better ID management

---

### 3. LangSmith Integration for Observability

**Priority**: Medium  
**Effort**: Small (1 day)  
**Impact**: Much better debugging and monitoring

**Description**:
Integrate LangSmith (LangChain's observability platform) for:

- Tracing LLM calls and tool executions
- Performance monitoring
- Cost tracking
- Error analysis
- Prompt iteration and testing

**Implementation Approach**:
```typescript
import { LangSmith } from 'langsmith';

// In langchain.service.ts constructor:
this.llm = new ChatOllama({
  model: 'qwen3-coder',
  baseUrl: ...,
  callbacks: [
    {
      handleLLMStart: async (llm, prompts) => {
        await langsmith.logLLMStart({ llm, prompts });
      },
      handleLLMEnd: async (output) => {
        await langsmith.logLLMEnd({ output });
      },
      handleToolStart: async (tool, input) => {
        await langsmith.logToolStart({ tool, input });
      },
      handleToolEnd: async (output) => {
        await langsmith.logToolEnd({ output });
      },
    },
  ],
});
```

**Benefits**:
- Visual trace of LLM reasoning
- Identify slow tool calls
- Track token usage and costs
- A/B test different prompts
- Debug production issues easily

---

### 4. Tool Result Caching

**Priority**: Low  
**Effort**: Medium (2-3 days)  
**Impact**: Better performance for repeated queries

**Description**:
Cache tool results to avoid redundant calls to MCP services:

- Cache `query_projects` results for 30 seconds
- Cache `list_tasks` results per project
- Invalidate cache when mutations occur (`create_*`, `update_*`, `delete_*`)

**Implementation Approach**:
```typescript
import { Cache } from 'cache-manager';

class LangChainService {
  constructor(
    private readonly cache: Cache,
    ...
  ) {}

  private async createTools(...): Promise<DynamicStructuredTool[]> {
    return mcpTools.map(tool => {
      return new DynamicStructuredTool({
        name: tool.name,
        schema: ...,
        func: async (input: any) => {
          // Check cache for read operations
          if (tool.name.startsWith('query_') || tool.name.startsWith('list_')) {
            const cacheKey = `tool:${tool.name}:${JSON.stringify(input)}`;
            const cached = await this.cache.get(cacheKey);
            if (cached) {
              this.logger.log(`Cache hit for ${tool.name}`);
              return cached;
            }
          }

          // Execute tool
          const result = await this.mcpExecutor.executeToolCall(...);

          // Cache read results
          if (tool.name.startsWith('query_') || tool.name.startsWith('list_')) {
            const cacheKey = `tool:${tool.name}:${JSON.stringify(input)}`;
            await this.cache.set(cacheKey, result, 30000); // 30 seconds
          }

          // Invalidate related caches on mutations
          if (tool.name.startsWith('create_') || tool.name.startsWith('update_')) {
            await this.invalidateRelatedCaches(tool.name, input);
          }

          return result;
        },
      });
    });
  }

  private async invalidateRelatedCaches(toolName: string, input: any) {
    // E.g., if create_task was called, invalidate list_tasks for that project
    if (toolName === 'create_task' && input.projectId) {
      await this.cache.del(`tool:list_tasks:*${input.projectId}*`);
    }
  }
}
```

**Benefits**:
- Faster responses for repeated queries
- Reduced load on MCP services
- Better user experience

**Challenges**:
- Cache invalidation is complex
- Need to handle distributed cache if multiple instances
- May cause stale data if not careful

---

### 5. Structured Output with JSON Mode

**Priority**: Medium  
**Effort**: Small (1 day)  
**Impact**: More reliable tool calling

**Description**:
Use LangChain's structured output features to force the LLM to return valid JSON for tool calls:

```typescript
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { StructuredOutputParser } from 'langchain/output_parsers';

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  tool_name: "The name of the tool to call",
  arguments: "The arguments to pass to the tool as a JSON object",
});

const llmWithStructuredOutput = this.llm.pipe(parser);
```

**Benefits**:
- No more parsing failures
- Guaranteed valid JSON
- No need for fallback parsers (XML, markdown, etc.)
- Simpler code

**Challenges**:
- Requires LLM support for JSON mode (Ollama may not support this yet)
- Need fallback for older models

---

### 6. Tool Call Confidence Scoring

**Priority**: Low  
**Effort**: Medium (2-3 days)  
**Impact**: Better error prevention

**Description**:
Before executing a tool call, validate that:

- All required parameters are present
- Parameter types match schema
- Parameter values are reasonable (e.g., no empty strings for IDs)
- Tool exists and is callable

Add a confidence score and only execute if confidence > threshold:

```typescript
interface ToolCallValidation {
  valid: boolean;
  confidence: number; // 0-1
  warnings: string[];
  errors: string[];
}

async validateToolCall(
  toolCall: ToolCall,
  availableTools: DynamicStructuredTool[]
): Promise<ToolCallValidation> {
  const tool = availableTools.find(t => t.name === toolCall.function.name);
  
  if (!tool) {
    return {
      valid: false,
      confidence: 0,
      warnings: [],
      errors: ['Tool not found'],
    };
  }

  const args = JSON.parse(toolCall.function.arguments);
  const validation = tool.schema.safeParse(args);
  
  if (!validation.success) {
    return {
      valid: false,
      confidence: 0,
      warnings: [],
      errors: validation.error.errors.map(e => e.message),
    };
  }

  // Check for suspicious values
  const warnings: string[] = [];
  if (args.projectId && !args.projectId.match(/^[a-f0-9-]{36}$/)) {
    warnings.push('projectId does not look like a valid UUID');
  }

  const confidence = warnings.length === 0 ? 1.0 : 0.7;
  
  return {
    valid: true,
    confidence,
    warnings,
    errors: [],
  };
}
```

**Benefits**:
- Catch errors before execution
- Ask user for clarification when confidence is low
- Better error messages

---

### 7. Prompt Versioning and A/B Testing

**Priority**: Low  
**Effort**: Medium (2-3 days)  
**Impact**: Continuous improvement

**Description**:
Version control prompts and run A/B tests:

- Store prompts in database with version numbers
- Randomly assign users to prompt versions
- Track metrics (tool call accuracy, response time, user satisfaction)
- Automatically promote better-performing prompts

**Implementation Approach**:
```typescript
interface PromptVersion {
  id: string;
  version: number;
  systemPrompt: string;
  toolGuidance: string;
  active: boolean;
  metrics: {
    toolCallAccuracy: number;
    avgResponseTime: number;
    userRating: number;
  };
}

class PromptManager {
  async getPromptForUser(userId: string): Promise<PromptVersion> {
    // A/B test: 50% get version 1, 50% get version 2
    const random = Math.random();
    const version = random < 0.5 ? 1 : 2;
    return await this.getPromptVersion(version);
  }

  async trackMetric(userId: string, metric: string, value: number) {
    const version = await this.getUserPromptVersion(userId);
    await this.updateMetrics(version.id, metric, value);
  }
}
```

**Benefits**:
- Data-driven prompt improvement
- Compare different approaches
- Gradual rollout of prompt changes

---

## 📊 Priority Matrix

| Enhancement | Priority | Effort | Impact | Recommendation |
|------------|----------|--------|--------|----------------|
| LLM Response Testing with Mocks | High | Medium | High | **Do next** |
| Agent Integration | High | Large | Major | **Plan for Q1** |
| LangSmith Observability | Medium | Small | High | **Quick win** |
| Conversation Memory | Medium | Medium | Medium | **Nice to have** |
| Structured Output | Medium | Small | Medium | **Quick win** |
| Real-Time Streaming Tests | Medium | Small | Low | **Do when time permits** |
| Tool Result Caching | Low | Medium | Medium | **Later** |
| Tool Call Confidence | Low | Medium | Medium | **Later** |
| Prompt Versioning | Low | Medium | Low | **Later** |
| Tool Call Format Tests | Low | Small | Low | **Later** |

---

## 🎯 Recommended Next Steps

1. **Week 1-2**: Implement LLM response testing with mocked Ollama
   - Validate tool selection accuracy
   - Test multi-step reasoning
   - Ensure parameter correctness

2. **Week 3**: Add LangSmith integration
   - Set up tracing
   - Monitor production usage
   - Identify improvement areas

3. **Month 2**: Plan and execute Agent integration
   - Design agent prompt architecture
   - Migrate from manual tool loop to AgentExecutor
   - Add thought process visibility

4. **Month 3**: Add conversation memory
   - Implement BufferMemory
   - Test with long conversations
   - Optimize token usage

5. **Ongoing**: Iterate on prompts based on LangSmith data
   - Track metrics
   - A/B test improvements
   - Roll out winning variants

---

## 📝 Notes

- This document should be updated as work progresses
- Priorities may shift based on user feedback and production needs
- Consider creating separate tickets/issues for each enhancement
- Keep stakeholders informed of progress and blockers

Last Updated: 2025-12-27  
Author: AI Orchestrator Development Team
