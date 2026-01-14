# Multi-Response Handling & Tool Call Notifications

## Overview

The chat pipeline now supports **multiple responses** from the AI orchestrator and emits **tool call notifications** for better observability. Users can see what the AI is doing in real-time, including when tools are being executed.

## Message Flow

### Before (Single Response)

```
User: "Create a project called MyApp"
  ↓
AI Orchestrator: [processes, calls tools silently]
  ↓
AI: "I've created the project MyApp for you."
```

### After (Multiple Responses with Notifications)

```
User: "Create a project called MyApp"
  ↓
AI Orchestrator emits:
  1. "Let me create that project for you..." (intermediate message)
  2. "🔧 Calling tool: create_project" (tool notification)
  [Tool executes]
  3. "I've created the project MyApp for you." (final response)
  ↓
All messages broadcast to participants in real-time
```

## Architecture Changes

### AI Orchestrator (`app.service.ts`)

The AI orchestrator now emits messages at multiple stages:

1. **Intermediate Messages**: When the LLM provides user-facing content before tool calls
2. **Tool Call Notifications**: Before executing any tool (OpenAI, XML, or legacy JSON format)
3. **Final Response**: The actual answer after all tool executions

#### Code Example

```typescript
// 1. Extract and emit user-facing content
const userFacingContent = extractUserFacingContent(response.message.content, response.message.tool_calls);
if (userFacingContent) {
  const intermediateMessage: Partial<ChatMessage> = {
    conversationId: conversation.id,
    senderId: persona.id,
    senderName: persona.name,
    recipientId: [profile.id],
    recipientName: [profile.profileName],
    content: userFacingContent,
    timestamp: new Date(),
    type: 'system',
  };
  responses.push(intermediateMessage);
  await chatCollectorService.send({ cmd: ChatCommands.POST_MESSAGE }, intermediateMessage);
}

// 2. Emit tool call notification
const toolCallMessage: Partial<ChatMessage> = {
  conversationId: conversation.id,
  senderId: persona.id,
  senderName: persona.name,
  recipientId: [profile.id],
  recipientName: [profile.profileName],
  content: `🔧 Calling tool: ${toolCall.function.name}`,
  timestamp: new Date(),
  type: 'system',
};
responses.push(toolCallMessage);
await chatCollectorService.send({ cmd: ChatCommands.POST_MESSAGE }, toolCallMessage);

// 3. Execute tool and continue...
```

### Chat Gateway (`chat.gateway.ts`)

The chat gateway now:

1. **Captures** the array of responses from the AI orchestrator
2. **Processes** each response
3. **Emits** updated conversations to all participants after each message

#### Code Example

```typescript
// Send to AI orchestrator and get responses
const aiResponses: Partial<ChatMessage>[] = await firstValueFrom(this.aiOrchestrationClient.send({ cmd: AIOrchestrationCommands.CONVERSATION_UPDATE }, { conversation: aiPayload, aiPersonas: aiRecipients }));

this.l.log(`AI orchestrator returned ${aiResponses.length} messages`);

// Emit each AI response to all participants as they come in
for (const aiResponse of aiResponses) {
  // Get updated conversations for all participants
  const allParticipantIds = [...new Set([senderId, ...recipientIds])];
  for (const participantId of allParticipantIds) {
    const participantSocket = this.connectedClients.find((c) => c.id === participantId);

    if (participantSocket) {
      const conversations = await firstValueFrom(this.chatCollectorClient.send({ cmd: ChatCommands.GET_CONVERSATIONS }, { profileId: participantId }));
      participantSocket.client.emit('conversations', conversations || []);
    }
  }
}
```

## Message Types

### System Messages

Tool call notifications and intermediate messages use `type: 'system'` to differentiate them from regular chat messages.

```typescript
interface ChatMessage {
  type: 'chat' | 'system'; // 'system' for tool notifications
  content: string; // Message content
  // ... other fields
}
```

### Tool Call Notification Format

```
🔧 Calling tool: <tool_name>
```

Examples:

- `🔧 Calling tool: create_project`
- `🔧 Calling tool: list_tasks`
- `🔧 Calling tool: update_risk`

## Benefits

### 1. Real-Time Visibility

Users see each stage of AI processing:

- What the AI is thinking
- Which tools are being called
- Final results

### 2. Better UX

- Users know the AI is working (not frozen)
- Clear indication of tool execution
- Understanding of AI's step-by-step process

### 3. Debugging

- Easier to identify where issues occur
- Clear audit trail of tool calls
- Better error visibility

### 4. Multiple Participants

All conversation participants receive updates simultaneously:

- User sees their message acknowledged
- User sees tool execution
- User sees final response
- Other participants (if any) see the full flow

## Example Conversation Flow

```
[User]: Create a project called "Website Redesign"

[System]: Let me create that project for you.

[System]: 🔧 Calling tool: create_project

[AI]: I've successfully created the project "Website Redesign" for you!
     The project is now in PLANNING status. Would you like to add any
     initial tasks or team members?
```

## Testing

The multi-response handling can be tested by:

1. **Sending a message** that requires tool execution
2. **Observing** the client receives multiple conversation updates
3. **Verifying** messages appear in correct order:
   - Intermediate message (if any)
   - Tool call notification
   - Final response

### Manual Test

```typescript
// In a test client
socket.on('conversations', (conversations) => {
  console.log('Received conversation update:', conversations);
  // Should be called multiple times for one user message
});

socket.emit('message', {
  conversationId: 'conv-123',
  senderId: 'user-456',
  content: 'Create a new project',
  // ... other fields
});

// Expected console output:
// 1. Received conversation update: [...] (with intermediate message)
// 2. Received conversation update: [...] (with tool call notification)
// 3. Received conversation update: [...] (with final response)
```

## Performance Considerations

### Database Operations

Each emitted message:

1. Posts to chat collector (writes to database)
2. Triggers conversation retrieval (reads from database)
3. Emits to all connected participants

For conversations with many participants or rapid tool calls, this can result in multiple database operations.

### Optimization Opportunities

1. **Batch emissions**: Could emit all messages at once after AI completes
2. **Debouncing**: Could delay emissions slightly to batch rapid updates
3. **Selective updates**: Could emit only to active participants

Currently optimized for **real-time visibility** over minimal database operations.

## Configuration

No configuration required - multi-response handling is automatic.

To **disable** intermediate messages (keep only tool notifications and final response), modify the AI orchestrator to not push intermediate messages to the `responses` array.

## Backward Compatibility

✅ Fully backward compatible:

- Existing clients receive multiple `conversations` events (as before)
- Message format unchanged
- No API changes required
- Works with existing chat collector and profile services

## Future Enhancements

Potential improvements:

1. **Progress indicators**: Show percentage for multi-step operations
2. **Cancellation**: Allow users to cancel long-running tool chains
3. **Tool result preview**: Show brief summary of tool results
4. **Collapsible sections**: UI could collapse tool call details
5. **Streaming**: Stream LLM output token-by-token for very long responses

## Troubleshooting

### Issue: Not seeing intermediate messages

- Check AI orchestrator logs for "LLM user-facing message"
- Verify messages are being posted to chat collector
- Confirm socket connection is active

### Issue: Messages arriving out of order

- This shouldn't happen as messages are processed sequentially
- Check for race conditions in client-side message handling
- Verify timestamp ordering on client

### Issue: Too many conversation updates

- This is expected - one update per emitted message
- Client should handle rapid updates gracefully
- Consider debouncing UI updates if necessary

## Summary

The multi-response handling and tool call notifications provide:

- ✅ Real-time visibility into AI processing
- ✅ Clear indication of tool execution
- ✅ Better user experience
- ✅ Easier debugging
- ✅ Full backward compatibility
- ✅ Support for all tool call formats (OpenAI, XML, legacy JSON)
