# End-to-End Streaming Implementation

## Overview

This implementation enables real-time streaming of AI responses from Ollama through the AI Orchestrator, Gateway, and into the ForgeOfWill UI. Users now see AI responses building character-by-character, preventing request timeouts and providing a better user experience.

## Architecture Flow

```
User Message → ForgeOfWill → Gateway → AI Orchestrator → LangChain → Ollama
              ↑                ↑           ↑
              │                │           │
              └────────────────┴───────────┘
                 Streaming Events (WebSocket)
```

## Implementation Details

### 1. Constants (`libs/constants/src/lib/libs/ai-orchestration.ts`)

Added new command for streaming:
```typescript
STREAM_CONVERSATION: 'STREAM_CONVERSATION'
```

### 2. AI Orchestrator (`apps/ai-orchestrator/`)

#### `app.service.ts`
- **New Method**: `streamConversation()` - AsyncGenerator that yields streaming events
- Streams events from `langChainService.streamConversation()`
- Event types: `THINKING`, `TOOL_START`, `TOOL_END`, `CHUNK`, `FINAL_RESPONSE`, `ERROR`
- Posts intermediate messages (thinking, tool calls) to chat collector
- Posts final complete message after streaming completes

#### `app.controller.ts`
- **New Handler**: `@MessagePattern({ cmd: AIOrchestrationCommands.STREAM_CONVERSATION })`
- Returns the async generator directly for NestJS RPC streaming

### 3. Gateway (`apps/gateway/src/app/chat-gateway/chat.gateway.ts`)

#### Modified `handleMessage()`
- Replaced polling-based AI orchestration with streaming
- Calls `processAIResponseWithStreaming()` instead of blocking RPC call

#### New Properties
- **`activeStreams`** - Map tracking active streaming conversations with status, participants, and timing

#### New Methods
- **`processAIResponseWithStreaming()`** - Main streaming handler
  - Tracks active streams in Map
  - Subscribes to streaming observable from AI Orchestrator
  - Emits real-time events to participants via Socket.IO
  - Handles all event types: thinking, tool calls, chunks, completion, errors
  - Cleans up stream state on completion or error

- **`handleReconnectRequest()`** - Handles client reconnection
  - Re-registers client socket
  - Sends active stream status
  - Refreshes conversations

- **`sendActiveStreamsStatus()`** - Sends current streaming state to reconnected client
Event handlers:
- `onAIStatusUpdate()` - AI status changes
- `onStreamingResponse()` - Streaming chunks
- `onToolCallUpdate()` - Tool execution updates
- `onActiveStreams()` - Active streams on reconnection (new)
- `onReconnect()` - Socket reconnection event (new)
- `requestReconnect()` - Request current state from server (new)
- **`emitToParticipants()`** - Utility to emit events to specific users
- **`refreshConversationsForParticipants()`** - Refreshes UI after completion

#### Socket.IO Events Emitted
- `ai_status_update` - Status changes (thinking, responding, complete, error)
- `tool_call_update` - Tool execution status
- `streaming_response` - Character-by-character response chunks
- `active_streams` - Current active streams on reconnection

#### Socket.IO Events Handled
- `reconnect_request` - Client requesting current state after reconnection

### 4. Chat UI Library (`libs/chat-ui/`)

#### `socket-chat.service.ts`
Already had handlers for:
- `onAIStatusUpdate()`
- `onStreamingResponse()`
- `onToolCallUpdate()`

#### `chat-window.component.ts`
- **New Input**: `@Input() streamingMessage: string | null`
- Displays real-time streaming message content

#### `chat-window.component.html`
Added streaming message display section:
- Shows sender name and typing indicator
- Displays accumulated streaming content
- Positioned before AI status indicator

#### `chat-window.component.scss`
New styles:
- `.streaming-message` - Container with blue accent and pulse animation
- `.typing-dots` - Animated typing indicator
- `@keyframes typing` - Dot animation for visual feedback
- `@keyframes pulse-gentle` - Subtle pulse for streaming container

### 5. ForgeOfWill App (`apps/forgeofwill/`)

#### `chat.component.ts`
- **New Method**: `handleActiveStreams()` - Processes active streams on reconnection
- **New Method**: `restoreUIState()` - Restores open windows from localStorage
- **New Method**: `saveUIState()` - Saves open windows to localStorage
- **Updated Methods**: `openChat()`, `closeChat()`, `handleWindowStateChange()` - Now persist state
- **New Signal**: `streamingMessages` - Tracks streaming content per conversation
- **Updated Method**: `handleStreamingResponse()` - Accumulates chunks, clears on completion
- **New Method**: `getStreamingMessage()` - Returns streaming content for UI

#### `chat.component.html`
- Added `[streamingMessage]="getStreamingMessage(conv.id)"` to `<lib-chat-window>`

## Event Flow

### 1. User Sends Message
```
ForgeOfWill → Socket.IO → Gateway → Chat Collector (save message)
```

### 2. AI Processing Begins
```
Gateway → AI Orchestrator (STREAM_CONVERSATION) → LangChain Service
```

### 3. Streaming Events
```
LangChain → AI Orchestrator → Gateway → Socket.IO → ForgeOfWill

Event Types:
- thinking: "💭 Analyzing your question..."
- tool_start: "🔧 Calling tool: search_documentation"
- tool_end: "✅ Tool completed successfully"
- chunk: "The answer to your question..." (character by character)
- final_response: Complete message saved to database
- error: Error details if something fails
```

### 4. UI Updates
```
ForgeOfWill receives chunks → Updates streamingMessages signal → UI re-renders
```

### 5. Completion
```
final_response event → Clear streaming state → Refresh conversations → Show complete message
```

## Reconnection Handling

### Gateway-Side State Management
- **Active Streams Tracking** - Gateway maintains a Map of active streaming conversations
- **Participant Tracking** - Knows which users are in each streaming conversation
- **Status Updates** - Tracks current status (thinking, responding, streaming)
- **Last Update Time** - Records when stream was last active

### Client-Side Reconnection
- **localStorage Persistence** - Saves open chat windows across page refreshes
- **Automatic Reconnection** - Socket.IO automatically reconnects on disconnect
- **State Restoration** - Requests current streaming status on reconnect
- **UI Sync** - Restores open windows and streaming indicators

### Reconnection Flow
```
1. User refreshes page
2. Socket.IO reconnects automatically
3. Client sends 'reconnect_request' with profileId
4. Gateway checks active streams for that user
5. Gateway sends 'active_streams' event with current state
6. Client updates UI with streaming status
7. Client restores open windows from localStorage
8. User sees ongoing streams (if any)
```

### Events
- **reconnect_request** - Client → Gateway: Request current state
- **active_streams** - Gateway → Client: Current active streams for user
- **ai_status_update** - Gateway → Client: Re-emitted for active streams

## Benefits

1. **No Timeouts** - Streaming keeps connection alive
2. **Real-time Feedback** - Users see AI thinking and processing
3. **Progressive Display** - Response builds character-by-character
4. **Tool Visibility** - Users see when AI calls tools
5. **Better UX** - Visual indicators for all AI activities
6. **Error Handling** - Graceful degradation on failures
7. **Reconnection Support** - Seamless recovery from disconnections
8. **State Persistence** - UI state survives page refreshes

## Testing

### Manual Testing Flow
1. Start ForgeOfWill application
2. Open AI chat conversation
3. Send a message
4. Observe:
   - "AI is processing..." status
   - Streaming message appearing character-by-character
   - Tool call notifications (if applicable)
   - Final message appearing in conversation history

### What to Check
- ✅ Streaming message displays in real-time
- ✅ Page refresh restores open chat windows
- ✅ Active streams resume after reconnection
- ✅ Streaming status shows correctly after refresh
- ✅ Typing indicator animates
- ✅ Status changes (thinking → responding → complete)
- ✅ Tool calls show up
- ✅ Final message saved correctly
- ✅ No request timeouts
- ✅ Error handling works
- ✅ Multiple users receive streams correctly

## ~~**Resume on Disconnect** - Resume streaming after reconnection~~ ✅ **IMPLEMENTED**
7. **Stream History** - Show partial content received before disconnect
8. **Offline Queue** - Queue messages sent while offline

1. **Streaming Control** - Pause/resume streaming
2. **Partial Rendering** - Markdown rendering during streaming
3. **Message Editing** - Edit streaming message in real-time
4. **Multi-user Streaming** - Different streams per user in group chats
5. **Streaming Metrics** - Track chunk rate, latency, etc.
6. **Resume on Disconnect** - Resume streaming after reconnection

## Troubleshooting

### Streaming Not Working
- Check WebSocket connection in browser DevTools
- Verify AI Orchestrator streaming events are being yielded
- Check Gateway subscription to observable
- Ensure Socket.IO events are being emitted


### Reconnection Issues
- Check browser console for reconnect events
- Verify `reconnect_request` is sent with valid profileId
- Check Gateway logs for active streams tracking
- Verify localStorage has saved state
- Check `active_streams` event is received
### Chunks Not Appearing
- Verify `handleStreamingResponse()` is being called
- Check signal updates in ForgeOfWill
- Ensure template binding is correct

### Timeout Issues
- Verify streaming is active (should prevent timeouts)
- Check for errors in AI Orchestrator logs
- Monitor LangChain service streaming

## Related Files

- `libs/constants/src/lib/libs/ai-orchestration.ts`
- `apps/ai-orchestrator/src/app/app.service.ts`
- `apps/ai-orchestrator/src/app/app.controller.ts`
- `apps/ai-orchestrator/src/app/streaming-events.ts`
- `apps/ai-orchestrator/src/app/langchain.service.ts`
- `apps/gateway/src/app/chat-gateway/chat.gateway.ts`
- `apps/forgeofwill/src/app/chat.component.ts`
- `apps/forgeofwill/src/app/chat.component.html`
- `libs/chat-ui/src/lib/socket-chat.service.ts`
- `libs/chat-ui/src/lib/chat-ui/chat-window/chat-window.component.*`
