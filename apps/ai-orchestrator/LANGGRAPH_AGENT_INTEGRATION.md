# LangGraph & LangChain Agent Integration

## Overview

This document describes the LangGraph state management and LangChain Agent integration added to the AI Orchestrator service.

## 🎯 What Was Implemented

### 1. Context Storage Service (`context-storage.service.ts`)

**Purpose**: Persistent storage of conversation context using Redis

**Key Features**:

- ✅ Redis-based key-value storage (profileId → context)
- ✅ Automatic context persistence with 7-day TTL
- ✅ CRUD operations for conversation context
- ✅ Statistics and monitoring capabilities

**Context Structure**:

```typescript
interface ConversationContext {
  profileId: string; // User identifier
  summary: string; // Conversation summary
  recentTopics: string[]; // Last 10 topics discussed
  activeProjects: string[]; // Projects being worked on
  lastUpdated: Date; // Last modification time
  messageCount: number; // Total messages in conversation
  metadata?: Record<string, unknown>; // Additional custom data
}
```

**Usage Example**:

```typescript
// Store context
await contextStorage.storeContext('user-123', {
  summary: 'User is creating a new project',
  recentTopics: ['projects', 'tasks'],
  activeProjects: ['proj-456'],
  messageCount: 5,
});

// Retrieve context
const context = await contextStorage.getContext('user-123');

// Update context
await contextStorage.updateContext('user-123', {
  recentTopics: ['projects', 'tasks', 'risks'],
});
```

---

### 2. LangGraph Service (`langgraph.service.ts`)

**Purpose**: State management for conversations using LangGraph

**Key Features**:

- ✅ StateGraph-based conversation flow
- ✅ Automatic context loading and saving
- ✅ Topic extraction from messages
- ✅ Summary generation
- ✅ State persistence to Redis

**State Structure**:

```typescript
ConversationState = {
  messages: BaseMessage[];        // Conversation messages
  profileId: string;              // User ID
  summary: string;                // Conversation summary
  activeProjects: string[];       // Active project IDs
  recentTopics: string[];         // Last 10 topics (auto-managed)
  toolCallsCount: number;         // Number of tool calls made
  lastToolCalled: string | null;  // Most recent tool used
  iteration: number;              // Current iteration count
  shouldContinue: boolean;        // Whether to continue processing
  metadata: Record<string, unknown>; // Custom data
}
```

**Graph Flow**:

```
START
  ↓
loadContext (from Redis)
  ↓
processMessage (LLM interaction)
  ↓
extractTopics (from message content)
  ↓
updateSummary (conversation summary)
  ↓
saveContext (to Redis)
  ↓
END
```

**Usage Example**:

```typescript
// Execute conversation graph
const result = await langgraphService.executeConversation(
  'user-123',
  [
    new HumanMessage('Create a new project'),
    new AIMessage('I'll help you create a project')
  ],
  'Previous conversation summary'
);

// Access updated state
console.log(result.summary);
console.log(result.recentTopics);
console.log(result.activeProjects);
```

---

### 3. LangChain Agent Service (`langchain-agent.service.ts`)

**Purpose**: Automated tool selection and multi-step reasoning using LangChain agents

**Key Features**:

- ✅ AgentExecutor for automatic tool calling
- ✅ Tool discovery via `list_tools`
- ✅ Multi-step reasoning (query → create workflows)
- ✅ Automatic parameter enrichment (userId, profileId)
- ✅ Intermediate step tracking
- ✅ Max iteration safety (prevents infinite loops)

**Agent Configuration**:

```typescript
AgentExecutor({
  agent: toolCallingAgent,
  tools: [...mcpTools, list_tools],
  verbose: true, // Enable logging
  maxIterations: 10, // Prevent infinite loops
  returnIntermediateSteps: true, // Track tool calls
});
```

**Tool Calling Flow**:

```
User: "Create a task for my project"
  ↓
Agent Decision: Need projectId first
  ↓
Agent calls: query_projects(userId: "user-123")
  ↓
Agent receives: [{ id: "proj-456", name: "MyProject" }]
  ↓
Agent calls: create_task({
  title: "New task",
  projectId: "proj-456",
  createdBy: "user-123"
})
  ↓
Agent responds: "Created task successfully!"
```

**Usage Example**:

```typescript
// Initialize agent
await agentService.initializeAgent('user-123', 'conv-456');

// Execute with automatic tool calling
const result = await agentService.executeAgent('Create a task to review the homepage', chatHistory, 'user-123');

// Access results
console.log(result.output); // "Created task successfully!"
console.log(result.toolCalls); // [{ tool: 'query_projects', ... }, { tool: 'create_task', ... }]
console.log(result.intermediateSteps); // Detailed execution trace
```

---

## 🔧 Integration Points

### Redis Configuration

Required environment variables:

```bash
REDIS_HOST=localhost        # Redis server host
REDIS_PORT=6379            # Redis server port
REDIS_PASSWORD=            # Optional password
```

### Module Registration

All services are registered in `app.module.ts`:

```typescript
providers: [
  ContextStorageService, // Redis-based context storage
  LangGraphService, // State graph management
  LangChainAgentService, // Agent-based tool execution
  // ... other services
];
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    AI Orchestrator                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │          LangChainAgentService                      │ │
│  │  - AgentExecutor                                    │ │
│  │  - Tool calling agent                               │ │
│  │  - Multi-step reasoning                             │ │
│  └─────────────────┬──────────────────────────────────┘ │
│                    │                                     │
│  ┌────────────────▼──────────────────────────────────┐ │
│  │          LangGraphService                          │ │
│  │  - StateGraph                                       │ │
│  │  - Context loading/saving                           │ │
│  │  - Topic extraction                                 │ │
│  │  - Summary generation                               │ │
│  └─────────────────┬──────────────────────────────────┘ │
│                    │                                     │
│  ┌────────────────▼──────────────────────────────────┐ │
│  │        ContextStorageService                       │ │
│  │  - Redis client                                     │ │
│  │  - CRUD operations                                  │ │
│  │  - Statistics                                       │ │
│  └─────────────────┬──────────────────────────────────┘ │
│                    │                                     │
└────────────────────┼─────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │    Redis     │
              │   (Context   │
              │   Storage)   │
              └──────────────┘
```

---

## 🧪 Testing

### Context Storage Tests (`context-storage.service.spec.ts`)

- ✅ Store and retrieve context
- ✅ Update existing context
- ✅ Delete context
- ✅ Get statistics
- ✅ Handle Redis connection failures

### Future Tests Needed

- [ ] LangGraph state transitions
- [ ] Agent multi-step reasoning
- [ ] Tool call sequencing
- [ ] Context enrichment accuracy

---

## 🚀 Benefits Realized

### 1. Persistent Context

**Before**: Context lost between sessions  
**After**: 7-day context retention in Redis

### 2. Structured State Management

**Before**: Ad-hoc state handling  
**After**: LangGraph-managed state with clear transitions

### 3. Intelligent Tool Calling

**Before**: Manual tool selection  
**After**: Agent automatically determines tool sequence

### 4. Multi-Step Workflows

**Before**: Single tool calls only  
**After**: Automatic chaining (query → create → update)

### 5. Scalability

**Before**: In-memory context (single instance)  
**After**: Redis-backed (multi-instance ready)

---

## 📝 Usage Guide

### Basic Workflow

1. **Initialize Agent** (once per conversation):

```typescript
await agentService.initializeAgent(userId, conversationId);
```

2. **Execute Conversation**:

```typescript
const stateResult = await langgraphService.executeConversation(profileId, messages, existingSummary);
```

3. **Run Agent** (for complex tasks):

```typescript
const agentResult = await agentService.executeAgent(userMessage, chatHistory, userId);
```

4. **Retrieve Context** (anytime):

```typescript
const context = await contextStorage.getContext(profileId);
```

---

## ⚠️ Important Notes

### Agent vs Direct LLM

**Use Agent When**:

- Task requires multiple tools
- Need automatic tool sequencing
- Want intelligent decision-making

**Use Direct LLM When**:

- Simple Q&A
- No tool calls needed
- Maximum control over execution

### Context Storage

- **TTL**: 7 days (configurable)
- **Max Size**: Unlimited (Redis-based)
- **Persistence**: Automatic on every conversation
- **Cleanup**: Automatic expiration via Redis TTL

### Performance Considerations

- **Agent Overhead**: ~100-300ms per iteration
- **Redis Latency**: ~1-5ms per operation
- **Max Iterations**: 10 (prevents runaway execution)

---

## 🔮 Future Enhancements

See `REMAINING_WORK.md` for detailed roadmap. Key items:

1. **Conversation Memory** (LangChain BufferMemory)
2. **Advanced State Graphs** (parallel execution, conditional branching)
3. **Context Summarization** (LLM-powered summaries)
4. **Multi-Agent Orchestration** (specialized agents for different domains)
5. **Observability** (LangSmith integration for agent traces)

---

## 📚 References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangChain Agents](https://js.langchain.com/docs/modules/agents/)
- [Redis Node Client](https://github.com/redis/node-redis)
- [StateGraph API](https://langchain-ai.github.io/langgraph/reference/graphs/)

---

## 🤝 Contributing

When extending these services:

1. **Maintain State Immutability**: Use reducers properly
2. **Test Redis Fallbacks**: Handle connection failures gracefully
3. **Log Agent Decisions**: Enable verbose mode for debugging
4. **Respect Max Iterations**: Prevent infinite loops
5. **Document State Changes**: Update this guide when adding state fields

---

## 📧 Support

For questions or issues:

1. Check `REMAINING_WORK.md` for known limitations
2. Review test files for usage examples
3. Enable verbose logging for debugging
4. Check Redis connectivity if context storage fails
