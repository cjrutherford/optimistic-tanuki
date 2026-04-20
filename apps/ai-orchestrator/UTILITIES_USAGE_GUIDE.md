# AI Orchestrator Utilities Usage Guide

## Overview

This guide explains how to use the new prompt engineering utilities and XML tool parser in the ai-orchestrator service.

## Prompt Engineering Utilities

### Basic Usage

```typescript
import { buildConversationPreamble, extractUserFacingContent, shouldEmitToUser } from './utils';

// Build a complete conversation preamble
const preamble = buildConversationPreamble(
  systemPrompt, // Base system prompt from persona
  profile, // User profile DTO
  conversationSummary, // Summary of previous messages
  maxIterations, // Max tool-call iterations (e.g., 6)
  projectResource // Optional project resource data
);

// Use in your prompt
const prompt: GeneratePrompt = {
  model: 'qwen3',
  messages: [
    { role: 'system', content: preamble },
    { role: 'user', content: userMessage },
  ],
};
```

### Extracting User-Facing Content

```typescript
// Get content that should be shown to user (strips tool calls)
const userContent = extractUserFacingContent(response.message.content, response.message.tool_calls);

if (userContent) {
  console.log('LLM wants to tell user:', userContent);
}

// Or check if should emit
if (shouldEmitToUser(response.message.content, response.message.tool_calls)) {
  // Emit to client
  await sendMessageToClient(userContent);
}
```

### Individual Prompt Components

For more control, use individual components:

```typescript
import { generateToolCallingPrimer, generateSystemInvariants, generateUserContext, generateResponseRules } from './utils';

// Just the tool calling primer
const primer = generateToolCallingPrimer(userId);

// Just the system invariants
const invariants = generateSystemInvariants(userId);

// Build custom preamble
const customPreamble = `
${systemPrompt}

${generateUserContext(profile)}

${generateToolCallingPrimer(profile.id)}

Your additional custom instructions here...
`;
```

## XML Tool Parser

### Detecting XML Tool Calls

```typescript
import { containsXmlToolCall, parseXmlToolCall, xmlToolCallToOpenAI } from './utils';

const llmResponse = `
Let me create that project for you.

<tool_call>
  <name>create_project</name>
  <arguments>
    <name>My New Project</name>
    <userId>user-123</userId>
    <status>PLANNING</status>
  </arguments>
</tool_call>
`;

if (containsXmlToolCall(llmResponse)) {
  const xmlCall = parseXmlToolCall(llmResponse);

  if (xmlCall) {
    // Convert to OpenAI format for execution
    const openAICall = xmlToolCallToOpenAI(xmlCall);

    // Execute using standard executor
    const result = await mcpExecutor.executeToolCall(openAICall, executionContext);
  }
}
```

### Stripping XML Tool Calls

```typescript
import { stripXmlToolCalls } from './utils';

const llmResponse = `
Let me create that project.

<tool_call>
  <name>create_project</name>
  <arguments>
    <name>Project</name>
  </arguments>
</tool_call>

I'll let you know when it's done.
`;

const cleanMessage = stripXmlToolCalls(llmResponse);
// Result: "Let me create that project.\n\nI'll let you know when it's done."
```

### Extracting Multiple XML Tool Calls

```typescript
import { extractAllXmlToolCalls } from './utils';

const response = `
<tool_call>
  <name>list_projects</name>
  <arguments><userId>user-123</userId></arguments>
</tool_call>

<tool_call>
  <name>create_task</name>
  <arguments>
    <title>New Task</title>
    <projectId>proj-456</projectId>
  </arguments>
</tool_call>
`;

const allCalls = extractAllXmlToolCalls(response);
// Returns: [{ name: 'list_projects', arguments: {...} }, { name: 'create_task', arguments: {...} }]

// Process first call only (per guidelines)
if (allCalls.length > 0) {
  const firstCall = xmlToolCallToOpenAI(allCalls[0]);
  // Execute...
}
```

## XML Format Specification

The parser supports this XML structure:

```xml
<tool_call>
  <name>tool_name</name>
  <arguments>
    <param1>value1</param1>
    <param2>value2</param2>
    <!-- Supports various types -->
    <stringParam>text value</stringParam>
    <numberParam>42</numberParam>
    <boolParam>true</boolParam>
    <jsonParam>{"key": "value"}</jsonParam>
    <arrayParam>["item1", "item2"]</arrayParam>
  </arguments>
</tool_call>
```

### Type Conversion

The parser automatically converts types:

- **Strings**: Plain text values
- **Numbers**: Numeric values (integers and decimals)
- **Booleans**: `true` or `false` strings
- **JSON Objects**: Values starting with `{` and ending with `}`
- **JSON Arrays**: Values starting with `[` and ending with `]`

Example:

```xml
<tool_call>
  <name>update_task</name>
  <arguments>
    <taskId>123</taskId>              <!-- Converted to number -->
    <completed>true</completed>        <!-- Converted to boolean -->
    <metadata>{"priority": 5}</metadata> <!-- Parsed as JSON object -->
  </arguments>
</tool_call>
```

Parses to:

```typescript
{
  name: 'update_task',
  arguments: {
    taskId: 123,
    completed: true,
    metadata: { priority: 5 }
  }
}
```

## Best Practices

### 1. Always Use buildConversationPreamble

Instead of building prompts manually, use the utility:

```typescript
// ❌ Don't do this
const prompt = `You are an assistant. Use userId=${userId}...`;

// ✅ Do this
const prompt = buildConversationPreamble(systemPrompt, profile, summary, maxIter, resource);
```

### 2. Check for User-Facing Content

Always extract and log user-facing content for observability:

```typescript
const userContent = extractUserFacingContent(response.message.content, response.message.tool_calls);

if (userContent) {
  logger.log(`LLM message: "${userContent}"`);
}
```

### 3. Support Multiple Tool Call Formats

Handle all three formats in your service:

```typescript
// 1. OpenAI format (native)
if (response.message.tool_calls && response.message.tool_calls.length > 0) {
  // Handle OpenAI format
}

// 2. XML format
else if (containsXmlToolCall(content)) {
  const xmlCall = parseXmlToolCall(content);
  const openAICall = xmlToolCallToOpenAI(xmlCall);
  // Execute
}

// 3. Legacy JSON format
else if (parsedResponse && parsedResponse.tool) {
  // Handle legacy format
}
```

### 4. Process One Tool at a Time

Always follow the one-tool-per-response guideline:

```typescript
if (toolCalls.length > 1) {
  logger.warn('LLM returned multiple tools, processing first only');
}

const toolCall = toolCalls[0]; // Only process first
```

## Examples

### Complete Integration Example

```typescript
async updateConversation(data: { conversation, aiPersonas }) {
  const profile = await getProfile(lastMessage.senderId);

  // Build preamble with utilities
  const preamble = buildConversationPreamble(
    generatePersonaSystemMessage(persona),
    profile,
    await summarizeConversation(messages),
    6, // max iterations
    await getProjectResource()
  );

  // Send to LLM
  const response = await promptProxy.send({
    messages: [
      { role: 'system', content: preamble },
      { role: 'user', content: lastMessage.content }
    ]
  });

  // Check for user-facing content
  const userContent = extractUserFacingContent(
    response.message.content,
    response.message.tool_calls
  );

  if (userContent) {
    logger.log(`LLM thinking: "${userContent}"`);
  }

  // Handle tool calls (OpenAI or XML)
  if (response.message.tool_calls?.length > 0) {
    // OpenAI format
    await executeToolCall(response.message.tool_calls[0]);
  } else if (containsXmlToolCall(response.message.content)) {
    // XML format
    const xmlCall = parseXmlToolCall(response.message.content);
    const openAICall = xmlToolCallToOpenAI(xmlCall);
    await executeToolCall(openAICall);
  }
}
```

## Testing

Both utilities have comprehensive test coverage:

```bash
# Run all utility tests
pnpm exec jest --testPathPattern="utils"

# Run prompt engineering tests only
pnpm exec jest prompt-engineering.spec.ts

# Run XML parser tests only
pnpm exec jest xml-tool-parser.spec.ts
```

## Troubleshooting

### LLM Not Using Correct Parameters

If the LLM is still using incorrect parameters:

1. Check that `buildConversationPreamble` is being used
2. Verify the profile ID is correct
3. Review the generated preamble in logs
4. Consider adjusting the primer text in `prompt-engineering.ts`

### XML Parsing Failures

If XML parsing fails:

1. Check the XML format matches the specification
2. Use `containsXmlToolCall` before `parseXmlToolCall`
3. Check logs for parsing errors
4. Verify no nested tool calls (not supported)

### Missing User-Facing Content

If observability is lacking:

1. Ensure `extractUserFacingContent` is called after each LLM response
2. Check that content is being logged
3. Verify `shouldEmitToUser` logic matches your needs

## Migration from Old Code

If migrating from the old inline prompt construction:

```typescript
// Old way
const preamble = `${systemPrompt}
# USER CONTEXT
userProfileId: ${profile.id}
...200 more lines...
`;

// New way
const preamble = buildConversationPreamble(systemPrompt, profile, summary, maxIter, resource);
```

This makes the code:

- More maintainable
- Easier to test
- Consistent across the codebase
- Better documented
