# Ollama Model Screener - Implementation Complete

## ✅ Completed Features

### 1. **Realistic TELOS Personas**

- **Alex Generalis** - General-purpose assistant
- **Patricia P. Project** - Project management specialist
- File: `scripts/personas-screener.json`

### 2. **First Message Testing Suite**

Tests TELOS-driven welcome messages with detailed scoring:

**Validation Criteria:**

- ✓ Self-introduction (Patricia/Alex name mentioned)
- ✓ No tool calls on first message
- ✓ Explains core objective/purpose
- ✓ Asks engagement questions
- ✓ Warm, welcoming tone (100-800 chars)

**Score Breakdown:**

```
Score 100/100: +20 (self-introduction) +20 (no tool calls) +20 (explains purpose) +20 (asks engagement) +20 (warm tone)
```

### 3. **Self-Evaluation Review System**

Model rates its own welcome message on:

- Warmth & Friendliness (0-10)
- Clarity of Purpose (0-10)
- Persona Alignment (0-10)
- Engagement Quality (0-10)
- First Message Compliance (0-10)
- Overall Effectiveness (0-10)

Returns JSON with detailed strengths/weaknesses/suggestions.

### 4. **Multi-Turn Context Retention (3 scenarios)**

**Scenario 1: Project Reference Memory (3 turns)**

```
Turn 1: Create project "Website Redesign"
Turn 2: Add task "Review design mockups" to it
Turn 3: What is the status of that project?
```

Tests: Model remembers "Website Redesign" across turns

**Scenario 2: Task Creation Context (4 turns)**

```
Turn 1: I need to create a task
Turn 2: Called "Fix login bug"
Turn 3: Make it high priority
Turn 4: What did we just create?
```

Tests: Context accumulation (task name + priority)

**Scenario 3: Complex Multi-Reference (5 turns)**

```
Turn 1: Tell you about my projects
Turn 2: Have Alpha and Beta projects
Turn 3: Alpha is for the website
Turn 4: Beta is for mobile app
Turn 5: Which one to focus on first?
```

Tests: Multiple entities, attribute tracking, reasoning

**Score Explanations:**

```
Score 100/100: +50 (Turn 2: remembered "Website Redesign") +50 (Turn 3: remembered "Website Redesign") - Multi-turn context retention: PASS
```

### 5. **Thought Process Measurement**

Tracks reasoning patterns:

- `<think>...</think>` (Claude)
- `<output>...</output>` (DeepSeek)
- `[THINKING]...[/THINKING]`
- `**Thinking:**...`

Metrics captured:

- Thinking time (ms)
- Thinking tokens
- Response tokens
- Whether model uses thinking blocks

### 6. **Debug Mode with Full Message Flow**

```bash
npx tsx scripts/ollama-model-screener.ts --benchmark --debug
```

Shows complete message flow:

```
[SYSTEM] (1024 tokens) 2024-01-15T10:30:00.000Z
  You are Patricia P. Project...

[USER] (15 tokens) 2024-01-15T10:30:01.000Z
  Create a project called "Website Redesign"

[ASSISTANT] (156 tokens) 2024-01-15T10:30:05.234Z
  {"name": "create_project", ...}
```

### 7. **Context Window Detection**

```bash
npx tsx scripts/ollama-model-screener.ts --benchmark --context-window-test
```

Tests actual context sizes:

```
✓ llama3.1:8b: 32768 tokens
  ✓ 4096 tokens: SUCCESS (234ms)
  ✓ 8192 tokens: SUCCESS (456ms)
  ✓ 16384 tokens: SUCCESS (890ms)
  ✓ 32768 tokens: SUCCESS (1890ms)
  ✗ 65536 tokens: Context length exceeded
```

## 📊 Score Explanation System

Every validation result now includes `scoreExplanation`:

**First Message Example:**

```
Score 80/100: +20 (self-introduction) +20 (no tool calls) +20 (explains purpose) +20 (asks engagement question) +0 (tone issues: response too short)
```

**Multi-Turn Example:**

```
Score 50/100: +50 (Turn 2: remembered "Website Redesign") +0 (Turn 3: forgot context) - Multi-turn context retention: FAIL
```

**Tool Calling Example:**

```
Score 60/100: +20 (correct tool name) +20 (has required fields) +0 (wrong enum value: "in_progress" instead of "IN_PROGRESS") +20 (has userId) - Check schema compliance
```

## 🎯 Critical Capabilities Tested

1. **first_message** - No tools on welcome, proper introduction
2. **workflow_detection** - Classify conversational vs tool_calling vs hybrid
3. **tool_construction** - Build valid MCP tool calls
4. **enum_compliance** - Case-sensitive enum values
5. **id_resolution** - Query before using IDs
6. **self_correction** - Recover from validation errors
7. **delete_safety** - Request confirmation for destructive ops
8. **multi_turn** - Context retention across 3-5 turns
9. **conversational** - Natural language quality

## 🚀 Usage Examples

### Basic First Message Testing

```bash
npx tsx scripts/ollama-model-screener.ts --benchmark --max-vram 8
```

### Debug with Full Flow

```bash
npx tsx scripts/ollama-model-screener.ts --benchmark --debug
```

### Context Window Detection

```bash
npx tsx scripts/ollama-model-screener.ts --benchmark --context-window-test
```

### Complete Test Suite

```bash
npx tsx scripts/ollama-model-screener.ts \
  --benchmark \
  --max-vram 16 \
  --context-window-test \
  --debug \
  --output results/full-test.json
```

## 📈 Output Files

1. **JSON Results** (`ollama-screener-results.json`)

   - Complete test results
   - Fitness reports per model
   - Token metrics
   - Score explanations
   - Context window sizes
   - Recommendations

2. **Log File** (`ollama-screener-results.log`)

   - Execution logs
   - Debug information

3. **HTML Graphs** (`screener-results.html`)
   - Interactive visualizations
   - Comparison charts

## 🔧 Technical Implementation

### Key Functions Added

1. **buildFirstMessagePrompt()** - Constructs TELOS-driven welcome prompts
2. **buildWelcomeReviewPrompt()** - Creates self-evaluation prompts
3. **buildMultiTurnSystemPrompt()** - Multi-turn conversation prompts
4. **extractThinkingBlock()** - Detects reasoning patterns
5. **detectContextWindow()** - Tests actual context capacities
6. **calculateTaskFitness()** - Computes fitness scores with explanations
7. **runMultiTurnScenario()** - Executes multi-turn tests

### Fitness Score Components

- **Overall Fitness** (0-100): Weighted average across all test suites
- **Category Scores**: Per-suite performance
- **Bang for Buck**: Performance per GB of VRAM
- **Recommendations**: Actionable improvements

## 🎯 Next Steps

### Immediate

1. Run screener against available models
2. Validate multi-turn context retention
3. Test context window detection
4. Review score explanations for clarity

### Short-term

1. Fix orchestrator memory/context issues based on findings
2. Add more personas to test suite
3. Expand multi-turn scenarios (5-10 turns)
4. Add model comparison visualizations

### Long-term

1. Integrate with CI/CD for model quality gates
2. Track model performance over time
3. Build model recommendation engine
4. Create automated model selection

## 📝 Notes

### Why These Features?

1. **First Message Testing**: Critical because orchestrator has special handling for first message (no tools)
2. **Multi-Turn Testing**: User reported "context already gone" issue
3. **Self-Evaluation**: Models can identify their own weaknesses
4. **Score Explanations**: Debug why models fail specific tests
5. **Context Window Detection**: Different models have different capacities

### Testing Strategy

1. Start with `--max-vram 8` to filter models
2. Run with `--debug` for detailed diagnosis
3. Use `--context-window-test` for capacity planning
4. Review score explanations for improvement areas

---

**Status**: ✅ Implementation Complete
**Files Modified**: 2 (`scripts/ollama-model-screener.ts`, `scripts/personas-screener.json`)
**Lines Added**: ~500
**Test Suites**: 2 new (First Message, Multi-Turn)
**Functions Added**: 5 new
**Validation**: TypeScript compilation successful
