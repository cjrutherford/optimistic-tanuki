# Enhanced Ollama Model Screener - Implementation Summary

## ✅ Completed Features

### 1. TELOS Persona Integration

**File:** `scripts/personas-screener.json`

Two personas imported from the actual ai-orchestrator:

- **Alex Generalis** - General-purpose assistant
- **Patricia P. Project** - Project management specialist

Each persona includes:

- Full TELOS framework (goals, skills, limitations, coreObjective)
- Realistic identity and communication style
- Proper first-message handling requirements

### 2. First Message Testing Suite

**New Test Suite:** "First Message & Welcome"

Tests TELOS-driven welcome messages with:

- **Welcome Message Generation** (Patricia): Tests proper TELOS introduction
- **Welcome Message Generation** (Alex): Tests general assistant welcome

**Validation Criteria:**

- ✓ Introduces self by name/role
- ✓ NO tool calls on first message
- ✓ Explains purpose (core objective)
- ✓ Asks engaging questions
- ✓ Warm, welcoming tone (100-800 chars)

**System Prompt Features:**

```typescript
buildFirstMessagePrompt(persona: TelosPersona)
```

- Full TELOS identity section
- First message rules (conversational only)
- Example structure
- What NOT to do guidelines

### 3. Self-Evaluation Review Prompt

**Function:** `buildWelcomeReviewPrompt(welcomeMessage: string)`

The model evaluates its own welcome message on:

- **Warmth & Friendliness** (0-10)
- **Clarity of Purpose** (0-10)
- **Persona Alignment** (0-10)
- **Engagement Quality** (0-10)
- **First Message Compliance** (0-10)
- **Overall Effectiveness** (0-10)

Returns detailed JSON with:

- Individual scores
- Total score (0-60)
- Strengths/weaknesses
- Improvement suggestions

### 4. Multi-Turn Conversation Testing

**New Test Suite:** "Multi-Turn Context Retention"

Three multi-turn scenarios (3-5 turns each):

#### Scenario 1: Project Reference Memory (3 turns)

```
Turn 1: "Create a project called Website Redesign"
Turn 2: "Add a task to it called Review design mockups"
Turn 3: "What is the status of that project?"
```

**Tests:** Model remembers "Website Redesign" across turns

#### Scenario 2: Task Creation Context (4 turns)

```
Turn 1: "I need to create a task"
Turn 2: "It should be called Fix login bug"
Turn 3: "Make it high priority"
Turn 4: "What did we just create?"
```

**Tests:** Context accumulation (task name + priority)

#### Scenario 3: Complex Multi-Reference (5 turns)

```
Turn 1: "Let me tell you about my projects"
Turn 2: "I have Alpha and Beta projects"
Turn 3: "Alpha is for the website"
Turn 4: "Beta is for the mobile app"
Turn 5: "Which one should I focus on first?"
```

**Tests:** Multiple entities, attribute tracking, reasoning

**Implementation:**

```typescript
runMultiTurnScenario(model, hardware, scenario, config, logger);
```

- Maintains conversation history
- Logs each turn
- Validates all responses together

### 5. Thought Process Measurement

**Interface:** `ThoughtProcessMetrics`

Tracks:

- **thinkingStartTime/EndTime** - When reasoning occurred
- **thinkingDurationMs** - Total thinking time
- **thinkingTokens** - Tokens in reasoning block
- **responseTokens** - Tokens in final response
- **hasThinkingBlock** - Whether model used <think> tags
- **thinkingBlockContent** - Extracted thinking (first 500 chars)

**Supported Patterns:**

- `<think>...</think>`
- `<output>...</output>` (DeepSeek)
- `[THINKING]...[/THINKING]`
- `**Thinking:**...`

**Extraction Function:**

```typescript
extractThinkingBlock(content: string): { thinking, response, hasThinking }
```

### 6. Debug Mode with Full Message Flow

**New Flag:** `--debug` or `-d`

Shows complete message flow:

```
[SYSTEM] (1024 tokens) 2024-01-15T10:30:00.000Z
  You are Patricia P. Project, an AI assistant...

[USER] (15 tokens) 2024-01-15T10:30:01.000Z
  Create a project called "Website Redesign"

[ASSISTANT] (156 tokens) 2024-01-15T10:30:05.234Z
  {"name": "create_project", "arguments": {...}}
```

**Logged in Results:**

- `messageFlow` array with step-by-step details
- Role, content preview, token count, timestamp
- Saved to output JSON for analysis

### 7. Context Window Detection

**New Flag:** `--context-window-test`

Tests actual context window sizes:

```bash
pnpm exec tsx scripts/ollama-model-screener.ts --benchmark --context-window-test
```

**Test Process:**

1. Generates prompts at increasing sizes (4K, 8K, 16K, 32K, 64K, 128K tokens)
2. Asks model to identify topic from context
3. Tracks max successful size per model

**Output:**

```
✓ llama3.1:8b: 32768 tokens
  ✓ 4096 tokens: SUCCESS (234ms)
  ✓ 8192 tokens: SUCCESS (456ms)
  ✓ 16384 tokens: SUCCESS (890ms)
  ✓ 32768 tokens: SUCCESS (1890ms)
  ✗ 65536 tokens: Context length exceeded
```

## 🚀 Usage Examples

### Basic First Message Testing

```bash
pnpm exec tsx scripts/ollama-model-screener.ts --benchmark --max-vram 8
```

### Debug Mode with Full Flow

```bash
pnpm exec tsx scripts/ollama-model-screener.ts --benchmark --debug
```

### Test Context Windows

```bash
pnpm exec tsx scripts/ollama-model-screener.ts --benchmark --context-window-test
```

### Specific Models with Verbose Logging

```bash
pnpm exec tsx scripts/ollama-model-screener.ts \
  --benchmark \
  --families llama \
  --max-models 3 \
  --verbose \
  --debug
```

### Complete Test Suite

```bash
pnpm exec tsx scripts/ollama-model-screener.ts \
  --benchmark \
  --max-vram 16 \
  --context-window-test \
  --debug \
  --output results/full-test.json
```

## 📊 Output Format

### Detailed Results Include:

```json
{
  "model": "llama3.1:8b",
  "scenario": "Project Reference Memory (3 turns)",
  "useCase": "multi_turn",
  "success": true,
  "latencyMs": 3456,
  "tokenMetrics": {
    "inputTokens": 450,
    "outputTokens": 890,
    "totalTokensPerSecond": 45.2
  },
  "thoughtMetrics": {
    "thinkingDurationMs": 1200,
    "thinkingTokens": 234,
    "hasThinkingBlock": true
  },
  "validationDetails": {
    "turnCount": 3,
    "turn2MaintainsContext": true,
    "turn3MaintainsContext": true
  },
  "messageFlow": [
    { "role": "system", "tokenCount": 1024, ... },
    { "role": "user", "tokenCount": 45, ... },
    { "role": "assistant", "tokenCount": 156, ... }
  ]
}
```

## 🎯 Next Steps: AI Orchestrator Fixes

Based on screener findings, the orchestrator needs:

### 1. System Prompt Updates

**File:** `system-prompt-builder.service.ts`

**Add Conversation Context Section:**

```typescript
# CONVERSATION CONTEXT
You have access to the full conversation history above. When the user refers to
"it", "that", "the project", etc., check the previous messages to understand
what they're referring to.
```

**Fix Line 150-152:**
Current: "go back and check previous messages"
Problem: If messages aren't in context, this instruction is misleading
Solution: Add explicit "Previous messages:" section with summary

### 2. Redis Checkpointer Fix

**File:** `redis-checkpointer.ts`

**Lines 125, 206, 265:**

```typescript
// Current (broken):
const state = JSON.parse(data as string);

// Fix:
const state = typeof data === 'string' ? JSON.parse(data) : data;
```

### 3. Conversation State Debugging

Add debug logging to track:

- Message count at each step
- Total tokens in messages array
- What's being sent to LLM
- Redis save/load operations

### 4. Context Window Management

Implement smart truncation:

```typescript
// Keep:
- System prompt (always)
- Last 10 exchanges (user + assistant)
- Current turn messages
- First message (for context)

// Remove:
- Old middle conversation
- Expired tool results
```

## 📈 Success Metrics

The screener now validates:

- ✅ First message compliance (no premature tool calls)
- ✅ Context retention across 3-5 turns
- ✅ Thought process quality (time + tokens)
- ✅ Context window capacity
- ✅ TELOS persona alignment
- ✅ Multi-turn conversation flow

## 🔧 Files Modified

1. `scripts/ollama-model-screener.ts` - Main screener with all new features
2. `scripts/personas-screener.json` - TELOS personas (NEW)
3. `scripts/SCREENER_GUIDE.md` - Usage documentation

Ready to test models and identify context/memory issues in the ai-orchestrator!
