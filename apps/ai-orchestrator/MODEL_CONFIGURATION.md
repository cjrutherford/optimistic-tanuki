# AI Orchestrator Model Configuration Guide

This guide explains how to configure and use different AI models in the AI Orchestrator service for various purposes.

## Model Configuration

The AI Orchestrator supports three types of models configured in `/apps/ai-orchestrator/src/assets/config.yaml`:

### 1. Workflow Control Model
A lightweight model optimized for quickly detecting whether a user prompt requires tool calling or conversational response.

```yaml
models:
  workflow_control:
    name: 'qwen2.5:3b'
    description: 'Fast model for detecting if a prompt requires tool calling'
    temperature: 0.3
    pullOnStartup: true
```

**Purpose**: Quickly classify user prompts to optimize processing path
**Characteristics**: Fast inference, low resource usage
**Default**: qwen2.5:3b

### 2. Tool Calling Model
A model optimized for function calling and executing actions through the MCP protocol.

```yaml
models:
  tool_calling:
    name: 'bjoernb/deepseek-r1-8b'
    description: 'Model optimized for tool calling and function execution'
    temperature: 0.5
    pullOnStartup: true
```

**Purpose**: Execute tool calls, manage multi-step reasoning with tools
**Characteristics**: Good function calling capabilities, structured output
**Default**: bjoernb/deepseek-r1-8b

### 3. Conversational Model
A model optimized for natural conversational responses.

```yaml
models:
  conversational:
    name: 'bjoernb/deepseek-r1-8b'
    description: 'Model for generating conversational responses'
    temperature: 0.7
    pullOnStartup: true
```

**Purpose**: Generate natural language responses for conversations
**Characteristics**: Higher temperature for more creative responses
**Default**: bjoernb/deepseek-r1-8b

## Model Selection Strategy

The AI Orchestrator uses the following strategy to select models:

1. **Initial Classification**: The workflow control model analyzes the user prompt to determine:
   - **Conversational**: Simple Q&A or chitchat (no tools needed)
   - **Tool Calling**: Requires executing actions (create, update, list data)
   - **Hybrid**: Requires both tool execution AND conversational explanation

2. **Model Routing**: Based on classification:
   - Conversational prompts → Use conversational model
   - Tool calling prompts → Use tool calling model
   - Hybrid prompts → Use tool calling model + conversational model

3. **Response Processing**: 
   - Filter out thinking tokens (`<think>...</think>`, `[THINKING]...[/THINKING]`)
   - Maintain workflow continuity
   - Return clean, user-friendly responses

## Thinking Token Filtering

The service automatically filters thinking process tokens to prevent interrupting user workflow:

**Filtered patterns**:
- `<think>...</think>`
- `[THINKING]...[/THINKING]`
- `**Thinking:**` markers

This ensures users only see the final, polished responses.

## Model Initialization

Models are automatically initialized when the service starts if `pullOnStartup: true` is set:

1. **Startup Check**: Service checks if models exist in Ollama
2. **Auto-Pull**: Missing models are pulled automatically
3. **Validation**: Models are validated before use
4. **Fallback**: If models fail to load, service uses defaults

## App-Aware Configuration

The service is app-aware through the existing `ai-enabled-apps` configuration:

```yaml
ai-enabled-apps:
  forgeofwill: "The Forge of Will is a personal project management platform..."
```

This allows contextual responses specific to each application.

## Configuration Options

### Model Parameters

- **name**: Ollama model name (e.g., `qwen2.5:3b`)
- **description**: Human-readable description
- **temperature**: Controls randomness (0.0-1.0)
  - Lower (0.1-0.3): More deterministic, better for classification
  - Medium (0.5-0.7): Balanced
  - Higher (0.8-1.0): More creative, better for conversations
- **pullOnStartup**: Whether to pull model during initialization

### Ollama Configuration

```yaml
ollama:
  host: 192.168.50.238
  port: 11434
```

Points to the Ollama server endpoint for model management.

## Testing

The model configuration system includes comprehensive tests:

- `model-initializer.service.spec.ts`: Tests model initialization
- `workflow-control.service.spec.ts`: Tests workflow detection and token filtering

Run tests with:
```bash
pnpm exec nx test ai-orchestrator --testPathPattern="model-initializer"
pnpm exec nx test ai-orchestrator --testPathPattern="workflow-control"
```

## Troubleshooting

### Models Not Loading

1. Check Ollama is running: `curl http://your-ollama-host:11434/api/tags`
2. Verify model names in config match Ollama models
3. Check logs for initialization errors

### Incorrect Model Selection

1. Review workflow classification logs
2. Adjust workflow control model temperature if needed
3. Consider using heuristic fallback for edge cases

### Thinking Tokens Leaking

1. Check that WorkflowControlService is properly injected
2. Verify filterThinkingTokens is called on all response paths
3. Add custom patterns if using different thinking markers

## Performance Optimization

- **Workflow Control Model**: Keep it small and fast (3B parameters)
- **Tool Calling Model**: Balance between capability and speed (8B parameters)
- **Conversational Model**: Can be same as tool calling to reduce memory

## Future Enhancements

Potential improvements:
- Per-app model preferences
- Dynamic model switching based on complexity
- Model performance monitoring
- A/B testing different models
- Custom model fine-tuning

## API Reference

### ModelInitializerService

```typescript
// Get model configuration for a specific use case
getModelConfig(modelType: 'workflow_control' | 'tool_calling' | 'conversational'): ModelConfig | null

// Get all model configurations
getAllModelConfigs(): ModelConfigs | null

// Initialize all configured models
initializeModels(): Promise<void>
```

### WorkflowControlService

```typescript
// Detect workflow type for a prompt
detectWorkflow(
  userPrompt: string,
  availableTools: string[],
  conversationContext?: string
): Promise<WorkflowDecision>

// Filter thinking tokens from response
filterThinkingTokens(response: string): string
```

### WorkflowDecision Interface

```typescript
interface WorkflowDecision {
  type: WorkflowType; // 'conversational' | 'tool_calling' | 'hybrid'
  confidence: number; // 0.0-1.0
  reasoning?: string;
  requiresToolCalling: boolean;
  requiresConversation: boolean;
}
```

## Best Practices

1. **Use Fast Models for Classification**: Keep workflow control model lightweight
2. **Monitor Response Quality**: Track workflow classification accuracy
3. **Test with Real Prompts**: Validate model selection with actual user queries
4. **Adjust Temperatures**: Fine-tune based on use case requirements
5. **Cache Models**: Ensure pullOnStartup for production deployments
6. **Log Classifications**: Track workflow decisions for analysis

## Examples

### Example 1: Simple Greeting
**Input**: "Hello, how are you?"
**Classification**: Conversational
**Model Used**: Conversational model
**Output**: Natural greeting response

### Example 2: Create Action
**Input**: "Create a project called Website Redesign"
**Classification**: Tool Calling
**Model Used**: Tool calling model
**Output**: Tool call JSON → Success response

### Example 3: Hybrid Request
**Input**: "Show me my tasks and explain which are most urgent"
**Classification**: Hybrid
**Model Used**: Tool calling model → Conversational model
**Output**: Task list + Explanation

## Summary

The AI Orchestrator's model configuration system provides:
- ✅ Flexible model selection for different use cases
- ✅ Automatic workflow detection and routing
- ✅ Intelligent thinking token filtering
- ✅ App-aware responses
- ✅ Automatic model initialization
- ✅ Fallback mechanisms for reliability

This architecture ensures optimal performance, cost-efficiency, and user experience across all interaction types.
