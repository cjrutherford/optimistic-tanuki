# Chat Flow Analysis and Optimization Plan

## Current Chat Flow (As-Is)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT CHAT FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. ForgeOfWill Frontend (chat.component.ts)
   ├── User types message
   └── Emits 'message' event via SocketIO to Gateway
       ↓
2. Gateway (chat.gateway.ts:139-281)
   ├── @SubscribeMessage('message')
   ├── Posts message to chat-collector service
   ├── Checks for AI recipients (persona)
   ├── Fetches full conversation from chat-collector
   ├── Sends to AI Orchestrator via RPC:
   │   { cmd: CONVERSATION_UPDATE, conversation: aiPayload, aiPersonas }
   └── Sets up polling (500ms) for new messages while AI processes
       ↓
3. AI Orchestrator (app.service.ts:238-400)
   ├── updateConversation() receives conversation + aiPersonas
   ├── Fetches profile data
   ├── Initializes agent: langChainAgentService.initializeAgent()
   ├── Loads existing context from Redis: contextStorage.getContext()
   ├── PROBLEM: summarizeConversation() generates summary
   │   → Summary = "Recent conversation (last 5 messages): ..."
   ├── Converts messages to LangChain format
   └── Calls LangGraph:
       langGraphService.executeConversation(
         profile.id,
         langChainMessages,
         conversation.messages,  // Full chat history
         conversationSummary,     // Generated summary
         persona,
         profile,
         conversation.id
       )
       ↓
4. LangGraph Service (langgraph.service.ts)
   ├── Creates state graph with conversation state
   ├── processConversation node:
   │   ├── PROBLEM: Uses conversationSummary in prompt building
   │   ├── If useAgent=true:
   │   │   └── Calls langChainAgentService.executeAgentStep()
   │   └── Else:
   │       └── Calls langChainService.executeConversation()
   └── Returns final response
       ↓
5. LangChain Service (langchain.service.ts:345-450)
   ├── executeConversation() receives:
   │   - persona, profile
   │   - conversationHistory (ChatMessage[])
   │   - userMessage (current message)
   │   - conversationSummary  ⚠️ PROBLEM
   │   - conversationId
   ├── PROBLEM: Builds system prompt including:
   │   systemPromptBuilder.buildSystemPrompt({
   │     personaId: persona.id,
   │     profileId: profile.id,
   │     conversationSummary: conversationSummary,  ⚠️ SUMMARY IN PROMPT
   │     projectContext: projectContext || '',
   │   })
   │
   ├── System prompt structure:
   │   ┌────────────────────────────────────────┐
   │   │ # PERSONA IDENTITY (TELOS Framework)   │
   │   │ You are {personaName}...              │
   │   │ Core Objective: ...                    │
   │   │ Goals: ...                             │
   │   │ Skills: ...                            │
   │   │ Limitations: ...                       │
   │   │                                        │
   │   │ # CONVERSATION CONTEXT ⚠️ PROBLEM      │
   │   │ {conversationSummary}                 │  ← This changes!
   │   │                                        │
   │   │ # PROJECT CONTEXT (if any)            │
   │   │ ...                                    │
   │   └────────────────────────────────────────┘
   │
   ├── Converts chatHistory to LangChain messages
   ├── Builds final messages array:
   │   [systemMessages, ...chatHistory, new HumanMessage(userMessage)]
   │
   ├── Detects workflow (conversational vs. tool_calling)
   ├── Selects model (conversationalLLM vs. toolCallingLLM)
   └── Invokes LLM:
       llmWithTools.invoke(messages)
       ↓
6. LLM (Ollama - deepseek-r1-8b)
   ├── Receives messages with changing system prompt
   ├── PROBLEM: System prompt includes conversationSummary
   │   → This changes with every request!
   │   → LLM doesn't see full conversation history in system prompt
   │   → Only sees summary + recent messages
   │
   ├── Model responds with thinking tokens:
   │   <think>...</think> or [THINKING] ... [/THINKING]
   │
   └── Returns response (may include thinking tokens)
       ↓
7. Back through LangChain Service
   ├── Extracts thinking tokens
   ├── Emits thinking events (if onStreamEvent provided)
   ├── Filters thinking from final response
   ├── Executes any tool calls
   └── Returns { response, intermediateSteps, toolCalls }
       ↓
8. Back through LangGraph → AppService
   ├── Posts AI response to chat-collector
   ├── Emits tool call messages (if any)
   └── Updates context in Redis
       ↓
9. Back to Gateway
   ├── Polling (every 500ms) updates conversations
   └── Emits 'conversations' event to all participants
       ↓
10. ForgeOfWill Frontend
    └── Displays AI response in chat window
```

## Problems Identified

### 1. **System Prompt Pollution with Conversation Summary** ⚠️ CRITICAL
- **Issue**: `conversationSummary` is included in the system prompt
- **Location**: 
  - `app.service.ts:271-276` - Generates summary
  - `langchain.service.ts:365-377` - Includes summary in system prompt
  - `system-prompt-builder.service.ts` - Adds summary to template
  
- **Impact**:
  - System prompt changes with every conversation
  - LLM doesn't maintain consistent persona identity
  - Summary is lossy (only last 5 messages)
  - Increases prompt tokens unnecessarily
  - Can cause confusion in LLM's understanding of its role

- **Expected**: System prompt should be STATIC and COMPLETE for the persona
- **Actual**: System prompt is DYNAMIC and includes conversation context

### 2. **Thinking Tokens in Final Response**
- **Issue**: LLM (deepseek-r1-8b) generates thinking tokens like `<think>...</think>`
- **Location**: Model's inherent behavior
- **Current Handling**: 
  - ✅ `workflowControl.extractThinkingTokens()` extracts and filters
  - ✅ Thinking tokens emitted as events
  - ✅ Final response is cleaned
- **Status**: Partially handled, but needs verification that all patterns are caught

### 3. **Conversation Context Handling**
- **Issue**: Conversation history passed separately from system prompt
- **Current Flow**:
  ```typescript
  messages = [
    ...systemMessages,    // Includes conversation summary ⚠️
    ...chatHistory,       // Recent messages (LangChain format)
    new HumanMessage(userMessage)
  ]
  ```
- **Better Approach**: 
  - System prompt = STATIC persona TELOS only
  - Conversation history = FULL history as messages
  - No summary in system prompt

### 4. **Multiple Conversation Representations**
- **Issue**: Conversation exists in multiple formats:
  1. `ChatMessage[]` - Original format from chat-collector
  2. `BaseMessage[]` - LangChain format (HumanMessage, AIMessage)
  3. `conversationSummary` - Text summary
  4. `chatHistory` - State in LangGraph
  
- **Impact**: Complexity, potential for data loss, inconsistency

## Proposed Optimized Flow (To-Be)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OPTIMIZED CHAT FLOW (PROPOSED)                          │
└─────────────────────────────────────────────────────────────────────────────┘

1. ForgeOfWill Frontend (chat.component.ts)
   ├── User types message
   └── Emits 'message' event via SocketIO to Gateway
       ↓
2. Gateway (chat.gateway.ts)
   ├── @SubscribeMessage('message')
   ├── Posts message to chat-collector service
   ├── Checks for AI recipients (persona)
   ├── Fetches full conversation from chat-collector
   ├── Sends to AI Orchestrator via RPC:
   │   { cmd: CONVERSATION_UPDATE, conversation, aiPersonas }
   └── Sets up polling for updates
       ↓
3. AI Orchestrator (app.service.ts) - SIMPLIFIED
   ├── updateConversation() receives conversation + aiPersonas
   ├── Fetches profile and persona data
   ├── ✅ NO summary generation
   ├── Converts full conversation to LangChain messages
   └── Calls LangChain directly:
       langChainService.executeConversation(
         persona,
         profile,
         conversationHistory,  // Full history
         userMessage,
         conversationId,
         onStreamEvent         // For thinking/tool events
       )
       ↓
4. LangChain Service (langchain.service.ts) - OPTIMIZED
   ├── executeConversation() receives:
   │   - persona, profile
   │   - conversationHistory (full ChatMessage[])
   │   - userMessage (current message)
   │   - conversationId
   │   - onStreamEvent callback
   │
   ├── ✅ Build STATIC system prompt (persona TELOS only):
   │   systemPromptBuilder.buildSystemPrompt({
   │     personaId: persona.id,
   │     profileId: profile.id,
   │     // NO conversationSummary
   │     projectContext: projectContext || '',
   │   }, {
   │     includeTools: true,
   │     includeProfileTelos: true,
   │     includeProjectTelos: true
   │   })
   │
   ├── System prompt structure (STATIC):
   │   ┌────────────────────────────────────────┐
   │   │ # PERSONA IDENTITY (TELOS Framework)   │
   │   │ You are {personaName}, embodying:      │
   │   │ Core Objective: ...                    │
   │   │ Goals: ...                             │
   │   │ Skills: ...                            │
   │   │ Limitations: ...                       │
   │   │                                        │
   │   │ # USER CONTEXT                         │
   │   │ User's TELOS: ...                      │
   │   │                                        │
   │   │ # PROJECT CONTEXT (if any)            │
   │   │ Project TELOS: ...                     │
   │   │                                        │
   │   │ # RESPONSE RULES                      │
   │   │ - Respond as the assistant             │
   │   │ - Filter thinking tokens from output   │
   │   │ - Use tools when appropriate           │
   │   └────────────────────────────────────────┘
   │
   ├── ✅ Convert FULL conversation history to LangChain messages
   │   (not just last 5, but all relevant messages)
   │
   ├── Build final messages array:
   │   [
   │     systemMessage,           // STATIC persona TELOS
   │     ...fullChatHistory,     // ALL conversation messages
   │     new HumanMessage(userMessage)
   │   ]
   │
   ├── Detect workflow (conversational vs. tool_calling)
   ├── Select model (conversationalLLM vs. toolCallingLLM)
   ├── Bind tools if needed
   └── Invoke LLM:
       llmWithTools.invoke(messages)
       ↓
5. LLM (Ollama - deepseek-r1-8b)
   ├── Receives STATIC system prompt
   ├── Sees FULL conversation history
   ├── No confusion from changing system prompts
   ├── Generates response (may include thinking tokens)
   └── Returns response
       ↓
6. Back through LangChain Service
   ├── ✅ Extract thinking tokens
   ├── ✅ Emit THINKING events via onStreamEvent
   ├── ✅ Execute tool calls
   ├── ✅ Emit TOOL_START/TOOL_END events
   ├── ✅ Handle errors → ERROR events
   ├── ✅ Filter thinking from final response
   └── ✅ Emit FINAL_RESPONSE event
       ↓
7. Back to AppService
   ├── Receive response
   ├── Post AI response to chat-collector
   ├── Stream events already sent via onStreamEvent callback
   └── Return to Gateway
       ↓
8. Back to Gateway
   ├── Polling updates conversations
   ├── Emit 'conversations' to all participants
   └── Real-time updates displayed
       ↓
9. ForgeOfWill Frontend
    ├── Receives thinking events (display as "AI is thinking...")
    ├── Receives tool call events (display as "Calling tool: ...")
    ├── Receives final response
    └── Displays in chat window
```

## Key Changes Required

### Change 1: Remove Conversation Summary from System Prompt ✅ CRITICAL

**Files to modify:**
1. `apps/ai-orchestrator/src/app/system-prompt-builder.service.ts`
2. `apps/ai-orchestrator/src/app/langchain.service.ts`
3. `apps/ai-orchestrator/src/app/app.service.ts`

**Current (WRONG)**:
```typescript
// system-prompt-builder.service.ts
const template = ChatPromptTemplate.fromMessages([
  [
    'system',
    `# PERSONA IDENTITY (TELOS Framework)
    ...
    # CONVERSATION CONTEXT
    {conversationSummary}  ⚠️ REMOVE THIS
    ...`
  ]
]);
```

**Proposed (CORRECT)**:
```typescript
// system-prompt-builder.service.ts
const template = ChatPromptTemplate.fromMessages([
  [
    'system',
    `# PERSONA IDENTITY (TELOS Framework)
    You are {personaName}, embodying the following TELOS:
    
    ## Core Objective
    {personaCoreObjective}
    
    ## Goals
    {personaGoals}
    
    ## Skills
    {personaSkills}
    
    ## Limitations
    {personaLimitations}
    
    ## How You Engage
    Respond authentically as {personaName}. Use "I" for your actions.
    The user is the person you're helping (use "you/your").
    
    {userTelosSection}
    {projectTelosSection}
    
    ## RESPONSE RULES
    - Always respond as the assistant, never as the user
    - Filter any thinking tokens (<think>, [THINKING], etc.) from your final response
    - Use available tools when appropriate
    - Be conversational and helpful`
  ]
]);

// NO conversationSummary variable!
```

### Change 2: Pass Full Conversation History to LLM

**Current (LOSSY)**:
```typescript
// app.service.ts - summarizeConversation
const recentCount = Math.min(messages.length, 5);  // Only 5 messages!
const recentMessages = messages.slice(-recentCount);
```

**Proposed (COMPLETE)**:
```typescript
// langchain.service.ts - executeConversation
private convertChatHistory(messages: ChatMessage[]): BaseMessage[] {
  // Convert ALL messages, not just recent ones
  return messages.map((msg) => {
    const isUser = msg.role === 'user' || 
      (msg.type === 'chat' && msg.senderId !== msg.recipientId?.[0]);
    if (isUser) return new HumanMessage(msg.content);
    if (msg.role === 'assistant') return new AIMessage(msg.content);
    return new SystemMessage(msg.content);
  });
}

// Use all messages:
const chatHistory = this.convertChatHistory(conversationHistory);

const messages: BaseMessage[] = [
  systemMessage,        // STATIC
  ...chatHistory,       // ALL HISTORY
  new HumanMessage(userMessage),
];
```

### Change 3: Remove conversationSummary Parameter

**Files to modify:**
1. `apps/ai-orchestrator/src/app/langchain.service.ts`
2. `apps/ai-orchestrator/src/app/langgraph.service.ts`
3. `apps/ai-orchestrator/src/app/app.service.ts`

**Remove** `conversationSummary` parameter from:
- `LangChainService.executeConversation()`
- `LangGraphService.executeConversation()`
- All callers of these methods

### Change 4: Simplify app.service.ts

**Remove**:
- `summarizeConversation()` method (lines 220-236)
- All calls to `summarizeConversation()`
- `conversationSummary` variables

**Simplify**:
```typescript
// app.service.ts - updateConversation (SIMPLIFIED)
async updateConversation(data: {
  conversation: ChatConversation;
  aiPersonas: PersonaTelosDto[];
}): Promise<Partial<ChatMessage>[]> {
  const { conversation, aiPersonas } = data;
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  
  const profile: ProfileDto = await firstValueFrom(
    this.profileService.send(
      { cmd: ProfileCommands.Get },
      { id: lastMessage.senderId }
    )
  );

  const responses: Partial<ChatMessage>[] = [];

  for (const persona of aiPersonas) {
    this.logger.log(`Processing conversation for persona: ${persona.name}`);

    // Convert full conversation history
    const langChainMessages = this.convertToLangChainMessages(
      conversation.messages.slice(0, -1)
    );
    langChainMessages.push(new HumanMessage(lastMessage.content));

    // Call LangChain directly (no LangGraph for simpler flow)
    const result = await this.langChainService.executeConversation(
      persona,
      profile,
      conversation.messages.slice(0, -1), // Full history except last message
      lastMessage.content,
      conversation.id,
      async (event: StreamingEvent) => {
        // Handle streaming events (thinking, tool calls, errors)
        if (event.type === StreamingEventType.THINKING) {
          const thinkingMessage: Partial<ChatMessage> = {
            conversationId: conversation.id,
            senderId: persona.id,
            senderName: persona.name,
            recipientId: [profile.id],
            content: `💭 Thinking: ${event.content.text}`,
            timestamp: new Date(),
            type: 'system',
          };
          await firstValueFrom(
            this.chatCollectorService.send(
              { cmd: ChatCommands.POST_MESSAGE },
              thinkingMessage
            )
          );
          responses.push(thinkingMessage);
        }
        // Handle tool events...
      }
    );

    // Post final response
    const aiResponse: Partial<ChatMessage> = {
      conversationId: conversation.id,
      senderId: persona.id,
      senderName: persona.name,
      recipientId: [profile.id],
      content: result.response,
      timestamp: new Date(),
      type: 'chat',
    };
    
    await firstValueFrom(
      this.chatCollectorService.send(
        { cmd: ChatCommands.POST_MESSAGE },
        aiResponse
      )
    );
    responses.push(aiResponse);
  }

  return responses;
}
```

## Implementation Plan

### Phase 1: Remove Conversation Summary from System Prompt (HIGH PRIORITY)
**Goal**: Ensure system prompt is STATIC and contains only TELOS data

**Tasks**:
1. Update `SystemPromptBuilder.buildSystemPrompt()`
   - Remove `conversationSummary` from template
   - Remove `conversationSummary` from variables
   - Add clear response rules to system prompt

2. Update `LangChainService.executeConversation()`
   - Remove `conversationSummary` parameter
   - Update system prompt building to not include summary
   - Ensure full conversation history is used

3. Update all callers:
   - `LangGraphService.executeConversation()`
   - `AppService.updateConversation()`
   - `AppService.processNewProfile()`

**Verification**:
- System prompt should be identical for same persona/profile/project
- Only conversation history (messages) should change between requests
- LLM should see full context through message history, not summary

### Phase 2: Enhance Thinking Token Handling (MEDIUM PRIORITY)
**Goal**: Ensure all thinking patterns are caught and emitted as events

**Tasks**:
1. Update `WorkflowControlService.extractThinkingTokens()`
   - Verify all patterns are caught: `<think>`, `[THINKING]`, `**Thinking:**`, etc.
   - Add more patterns if needed (model-specific)

2. Ensure streaming events are properly emitted
   - Verify `onStreamEvent` callback is always provided
   - Test that thinking events reach frontend

**Verification**:
- No thinking tokens in final user-facing responses
- Thinking tokens displayed in UI as "AI is thinking..."
- All patterns successfully extracted

### Phase 3: Simplify Conversation Flow (LOW PRIORITY)
**Goal**: Reduce complexity, eliminate redundant conversions

**Tasks**:
1. Consider removing LangGraph for simple conversations
   - Keep for complex multi-turn tool use
   - Direct LangChain call for simple Q&A

2. Standardize conversation history handling
   - Single source of truth for conversation messages
   - Consistent conversion to LangChain format

**Verification**:
- Simpler code paths
- Easier to debug and maintain
- Same functionality with less complexity

## Expected Outcomes

### After Implementation:

1. **Consistent LLM Behavior**
   - System prompt is STATIC for each persona
   - LLM maintains consistent identity
   - No confusion from changing prompts

2. **Better Context Handling**
   - LLM sees FULL conversation history
   - No lossy summaries
   - Better long-term context retention

3. **Clean User Experience**
   - No thinking tokens in final responses
   - Real-time visibility into AI reasoning
   - Proper tool call notifications

4. **Maintainability**
   - Simpler code paths
   - Easier to debug
   - Clear separation of concerns

## Testing Plan

### Unit Tests:
1. Test `SystemPromptBuilder.buildSystemPrompt()`
   - Verify no `conversationSummary` in output
   - Verify TELOS data is properly formatted
   - Verify static nature of prompt

2. Test `WorkflowControlService.extractThinkingTokens()`
   - Test all thinking patterns
   - Verify extraction AND filtering

### Integration Tests:
1. Test full conversation flow
   - Send user message
   - Verify system prompt is static
   - Verify full history is passed
   - Verify thinking tokens are handled
   - Verify final response is clean

### Manual Tests:
1. ForgeOfWill UI test
   - Chat with AI persona
   - Verify no thinking tokens in chat
   - Verify thinking indicators display
   - Verify tool calls are visible
   - Verify consistent persona behavior

## Rollout Strategy

1. **Development**: Implement changes in feature branch
2. **Testing**: Comprehensive testing as outlined above
3. **Staging**: Deploy to staging environment
4. **Validation**: Manual testing with real users
5. **Production**: Gradual rollout with monitoring
6. **Monitoring**: Watch for LLM response quality, errors, user feedback

## Metrics to Track

- **Thinking Token Leakage**: % of responses with thinking tokens (should be 0%)
- **System Prompt Size**: Tokens in system prompt (should be consistent)
- **Response Quality**: User satisfaction, coherence scores
- **Tool Call Success Rate**: % of successful tool executions
- **Error Rate**: LLM errors, parsing errors, etc.

---

**Document Version**: 1.0  
**Date**: 2026-01-20  
**Author**: Copilot AI Assistant  
**Status**: Proposed - Awaiting Approval
