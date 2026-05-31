# AI Orchestrator

The AI orchestrator manages AI-oriented backend workflows for the platform. Its source lives under `apps/ai-orchestrator/src` and it coordinates model selection, tool-calling flows, and MCP-backed orchestration behavior.

## Local Development

Run it through the main repo stack:

```bash
pnpm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/ai-orchestrator`

## Repo Role

- AI orchestration entrypoint for gateway-facing workflows
- central point for model selection, tool-calling, and MCP-assisted responses
- part of the canonical deployment inventory used by CI and k8s validation

## Nx Commands

```bash
pnpm exec nx build ai-orchestrator
pnpm exec nx test ai-orchestrator
```

## Model Configuration

The AI Orchestrator uses multiple specialized models for different tasks:

- **Workflow Control Model**: Quickly detects if a prompt requires tool calling
- **Tool Calling Model**: Optimized for executing actions through MCP tools
- **Conversational Model**: Generates natural language responses

For detailed information on model configuration, selection strategy, and best practices, see [MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md).

## API Reference

The AI Orchestrator service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/ai-orchestrator`.

## Features

- **Intelligent Workflow Detection**: Automatically routes prompts to appropriate models
- **Multi-Model Support**: Uses specialized models for different tasks
- **Thinking Token Filtering**: Automatically filters internal reasoning from responses
- **App-Aware Responses**: Contextual responses based on application configuration
- **Automatic Model Management**: Pulls and initializes models on startup
- **MCP Tool Integration**: Seamless integration with Model Context Protocol tools

## Related Docs

- [Model Configuration Guide](./MODEL_CONFIGURATION.md) - Comprehensive guide on model setup and configuration
- [LangChain Integration](./LANGCHAIN_INTEGRATION.md) - LangChain integration details
- [LangGraph Agent Integration](./LANGGRAPH_AGENT_INTEGRATION.md) - LangGraph agent documentation
- [MCP Integration](./APP_SERVICE_INTEGRATION.md) - MCP tool integration guide
