# Optimistic Tanuki Documentation

Welcome to the Optimistic Tanuki documentation! This guide will help you navigate through all available documentation for this monorepo.

## 📚 Documentation Structure

**New to the documentation?** See our [Documentation Organization Guide](./ORGANIZATION.md) to understand how docs are structured and how to find what you need.

### 🚀 Getting Started

- [MVP Overview](./getting-started/mvp-overview.md) - Minimum Viable Product plan and roadmap

### 💻 Development

- [Debugging Guide](./development/debugging.md) - Docker-based development with debugging and hot-reload
- [API Configuration](./development/api-configuration.md) - Setting up API base URLs and environment configuration

### 🏗️ Architecture

Core system architecture and design documentation:

- **[Architecture Overview](./architecture/README.md)** - High-level system architecture and design
- [Permissions System](./architecture/permissions.md) - RBAC implementation and usage
- [Permissions Cache](./architecture/permissions-cache.md) - Caching configuration for permissions
- [Theme System](./architecture/theme-system.md) - Theme system architecture and reference
- [Theme Implementation](./architecture/theme-implementation.md) - Theme implementation details
- [CI/CD Pipeline](./architecture/cicd-pipeline.md) - Continuous integration and deployment setup
- [WebSocket Implementation](./architecture/websocket-implementation.md) - Real-time WebSocket server implementation
- [WebSocket Client](./architecture/websocket-client.md) - WebSocket client usage and integration
- [Security Audit](./architecture/security-audit.md) - Security audit findings and recommendations

### 📖 Guides

Step-by-step guides for specific tasks:

- [Theme Designer Guide](./guides/theme-designer.md) - Using the theme designer component
- [Theme Migration Guide](./guides/theme-migration.md) - Migrating to the new theme system
- [MCP Tools Guide](./guides/mcp-tools.md) - Model Context Protocol tools usage
- [MCP Validation Guide](./guides/mcp-validation.md) - Validating MCP implementations
- [Agents Guide](./guides/agents.md) - Working with AI agents in the platform

### 🧪 Testing

Testing guides and best practices:

- [E2E Testing Guide](./testing/e2e-testing.md) - End-to-end testing with Playwright
- [Test Portability Guide](./testing/test-portability.md) - Running tests in different environments
- [Blog Features Testing](./testing/blog-features.md) - Testing blog-specific features
- [Blog Editor E2E Testing](./testing/blog-editor-e2e.md) - E2E tests for blog editor
- [Quick Reference](./testing/quick-reference.md) - Quick reference for common testing tasks
- [Test Coverage](./testing/coverage.md) - Code coverage information and goals
- [Screenshot Capture Guide](./testing/screenshot-capture.md) - Capturing screenshots in tests

### 📡 API Documentation

API documentation for services:

- [Applications API Reference](./api/README.md) - Consolidated API documentation for all applications

## 🗂️ Application-Specific Documentation

Each application has its own README with specific details:

### Services

- [AI Orchestrator](../apps/ai-orchestrator/README.md) - AI task orchestration service
  - [LangChain Integration](../apps/ai-orchestrator/LANGCHAIN_INTEGRATION.md)
  - [LangGraph Agent Integration](../apps/ai-orchestrator/LANGGRAPH_AGENT_INTEGRATION.md)
  - [Multi-Response Handling](../apps/ai-orchestrator/MULTI_RESPONSE_HANDLING.md)
  - [Utilities Usage Guide](../apps/ai-orchestrator/UTILITIES_USAGE_GUIDE.md)
  - [Real-time Fix](../apps/ai-orchestrator/REALTIME_FIX.md)
  - [App Service Integration](../apps/ai-orchestrator/APP_SERVICE_INTEGRATION.md)
- [Assets](../apps/assets/README.md) - Digital asset management
- [Authentication](../apps/authentication/README.md) - User authentication and authorization
- [Blogging](../apps/blogging/README.md) - Blog post management
- [Chat Collector](../apps/chat-collector/README.md) - Chat message collection
- [Gateway](../apps/gateway/README.md) - API gateway and routing
- [Permissions](../apps/permissions/README.md) - Permissions management service
  - [Deployment Guide](../apps/permissions/DEPLOYMENT.md)
  - [Usage Guide](../apps/permissions/USAGE.md)
- [Profile](../apps/profile/README.md) - User profile management
  - [Blog Permissions](../apps/profile/BLOG_PERMISSIONS.md)
- [Project Planning](../apps/project-planning/README.md) - Project and task management
- [Prompt Proxy](../apps/prompt-proxy/README.md) - AI prompt proxying
- [Social](../apps/social/README.md) - Social features and interactions
- [Telos Docs Service](../apps/telos-docs-service/README.md) - Documentation service

### Frontend Applications

- [Client Interface](../apps/client-interface/README.md) - Main web application
- [Forge of Will](../apps/forgeofwill/README.md) - Project management frontend
- [Christopher Rutherford Net](../apps/christopherrutherford-net/README.md) - Personal website

## 📦 Library Documentation

Shared libraries used across applications:

### UI Libraries

- [AG Grid UI](../libs/ag-grid-ui/README.md) - AG Grid integration
- [Auth UI](../libs/auth-ui/README.md) - Authentication UI components
- [Blogging UI](../libs/blogging-ui/README.md) - Blog UI components
  - [Component Injection](../libs/blogging-ui/COMPONENT_INJECTION.md)
- [Chat UI](../libs/chat-ui/README.md) - Chat UI components
- [Common UI](../libs/common-ui/README.md) - Common UI components
- [Form UI](../libs/form-ui/README.md) - Form components
- [Message UI](../libs/message-ui/README.md) - Message UI components
- [Navigation UI](../libs/navigation-ui/README.md) - Navigation components
- [Persona UI](../libs/persona-ui/README.md) - Persona/avatar components
- [Profile UI](../libs/profile-ui/README.md) - Profile UI components
- [Project UI](../libs/project-ui/README.md) - Project management UI
- [Social UI](../libs/social-ui/README.md) - Social feature UI
- [Store UI](../libs/store-ui/README.md) - Store/shopping UI
- [Theme UI](../libs/theme-ui/README.md) - Theme management UI
  - [Theme System](../libs/theme-ui/THEME_SYSTEM.md)
  - [Host Binding Migration](../libs/theme-ui/HOST_BINDING_MIGRATION.md)

### Core Libraries

- [Constants](../libs/constants/README.md) - Shared constants and tokens
- [Database](../libs/database/README.md) - Database connection and TypeORM setup
- [Encryption](../libs/encryption/README.md) - Cryptographic operations
- [Logger](../libs/logger/README.md) - Logging service
- [Models](../libs/models/README.md) - Shared data models
- [UI Models](../libs/ui-models/README.md) - UI-specific data models
- [Storage](../libs/storage/README.md) - Storage utilities
- [Permission Lib](../libs/permission-lib/README.md) - Permission utilities
- [Theme Lib](../libs/theme-lib/README.md) - Theme utilities
- [Compose Lib](../libs/compose-lib/README.md) - Composition utilities
- [Prompt Generation](../libs/prompt-generation/README.md) - AI prompt generation

## 🔧 Quick Links

- [Main README](../README.md) - Project overview and quick start
- [Contributing Guidelines](../README.md#-contributing) - How to contribute
- [License](../README.md#-license) - MIT License
- [Examples](../examples/README.md) - Code examples and reference implementations

## 📝 Documentation Standards

When adding new documentation:

1. Place it in the appropriate category folder
2. Update this index with a link to your new document
3. Use clear, descriptive titles
4. Include practical examples where applicable
5. Keep documentation up-to-date with code changes

## 🤝 Need Help?

If you can't find what you're looking for:

1. Check the application-specific README files
2. Review the architecture documentation
3. Consult the testing guides for test-related questions
4. Open an issue on GitHub for clarification
