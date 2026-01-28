# AI Orchestrator

This service is responsible for orchestrating AI-related tasks and services. It acts as a central hub for managing and coordinating various AI models and services, providing a unified interface for interacting with them.

## 🚀 Getting Started

This service is started as part of the main application stack. See the main [README.md](../../README.md) for instructions on how to start the application.

## 🤖 Model Configuration

The AI Orchestrator uses multiple specialized models for different tasks:
- **Workflow Control Model**: Quickly detects if a prompt requires tool calling
- **Tool Calling Model**: Optimized for executing actions through MCP tools
- **Conversational Model**: Generates natural language responses

For detailed information on model configuration, selection strategy, and best practices, see [MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md).

## 📝 API Reference

The AI Orchestrator service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/ai-orchestrator`.

## 🛠️ Features

- **Intelligent Workflow Detection**: Automatically routes prompts to appropriate models
- **Multi-Model Support**: Uses specialized models for different tasks
- **Thinking Token Filtering**: Automatically filters internal reasoning from responses
- **App-Aware Responses**: Contextual responses based on application configuration
- **Automatic Model Management**: Pulls and initializes models on startup
- **MCP Tool Integration**: Seamless integration with Model Context Protocol tools

## 📚 Documentation

- [Model Configuration Guide](./MODEL_CONFIGURATION.md) - Comprehensive guide on model setup and configuration
- [LangChain Integration](./LANGCHAIN_INTEGRATION.md) - LangChain integration details
- [LangGraph Agent Integration](./LANGGRAPH_AGENT_INTEGRATION.md) - LangGraph agent documentation
- [MCP Integration](./APP_SERVICE_INTEGRATION.md) - MCP tool integration guide
