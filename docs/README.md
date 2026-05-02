# Optimistic Tanuki Documentation

Welcome to the Optimistic Tanuki documentation index. This page is the fastest way to find the docs that match the repo as it exists today.

## Current State

The current branch has a few operational surfaces that matter more than the older summary docs:

- local development is driven by `pnpm run docker:dev` and the dev Compose overrides
- the Kubernetes deployment contract is generated from the Go catalog in `tools/admin-env-wizard`
- GitHub Actions validate inventory consistency before image promotion
- staging and production image tags are carried in Kustomize overlay `images:` blocks
- ArgoCD applies a parameterized application manifest from `k8s/argo-app/application.yaml`
- there is now a second Go tool, `tools/stack-client`, for authenticated gateway access from a terminal UI

## Documentation Structure

### Getting Started

- [MVP Overview](./getting-started/mvp-overview.md) - Minimum viable product plan and roadmap

### DevOps and Infrastructure

- [DevOps README](./devops/README.md) - DevOps documentation index
- [Architecture Overview](./devops/architecture.md) - Infrastructure architecture
- [Kubernetes Deployment](./devops/k8s.md) - Kustomize overlays, base resources, and deployment scripts
- [Service Ports Reference](./devops/ports.md) - Port mappings for all services
- [Gateway Configuration](./devops/gateway.md) - Gateway service configuration
- [Docker Compose](./devops/docker-compose.md) - Local development and the dev stack workflow
- [ArgoCD](./devops/argocd.md) - GitOps deployment with the parameterized Argo application

### Development

- [Debugging Guide](./development/debugging.md) - Docker-based development with debugging and hot-reload
- [API Configuration](./development/api-configuration.md) - Setting up API base URLs and environment configuration
- [Admin Environment Wizard](../tools/admin-env-wizard/README.md) - Go CLI and TUI for environment generation
- [Stack Client](../tools/stack-client/README.md) - Go TUI client for authenticated gateway access

### Architecture

- [Architecture Overview](./architecture/README.md) - High-level system architecture and design
- [Permissions System](./architecture/permissions.md) - RBAC implementation and usage
- [Permissions Cache](./architecture/permissions-cache.md) - Caching configuration for permissions
- [Theme System](./architecture/theme-system.md) - Theme system architecture and reference
- [Theme Implementation](./architecture/theme-implementation.md) - Theme implementation details
- [CI/CD Pipeline](./architecture/cicd-pipeline.md) - Current GitHub Actions deployment flow
- [WebSocket Implementation](./architecture/websocket-implementation.md) - Real-time WebSocket server implementation
- [WebSocket Client](./architecture/websocket-client.md) - WebSocket client usage and integration
- [Security Audit](./architecture/security-audit.md) - Security audit findings and recommendations

### Guides

Step-by-step guides for specific tasks:

- [Email Provider Setup](./guides/email-providers.md) - Configuring SMTP, API, and console email providers
- [OAuth Provider Setup](./guides/oauth-providers.md) - Setting up Google, GitHub, Microsoft, and Facebook login
- [Local Hub Guide](./guides/local-hub.md) - Complete guide to the Local Hub (Towne Square) app: pages, services, seeding, business pages, elections, image pipeline, and deployment
- [Theme Designer Guide](./guides/theme-designer.md) - Using the theme designer component
- [Theme Migration Guide](./guides/theme-migration.md) - Migrating to the new theme system
- [MCP Tools Guide](./guides/mcp-tools.md) - Model Context Protocol tools usage
- [MCP Validation Guide](./guides/mcp-validation.md) - Validating MCP implementations
- [Agents Guide](./guides/agents.md) - Working with AI agents in the platform

### Testing

- [E2E Testing Guide](./testing/e2e-testing.md) - End-to-end testing with Playwright
- [Test Portability Guide](./testing/test-portability.md) - Running tests in different environments
- [Blog Features Testing](./testing/blog-features.md) - Testing blog-specific features
- [Blog Editor E2E Testing](./testing/blog-editor-e2e.md) - E2E tests for blog editor
- [Quick Reference](./testing/quick-reference.md) - Quick reference for common testing tasks
- [Test Coverage](./testing/coverage.md) - Code coverage information and goals
- [Screenshot Capture Guide](./testing/screenshot-capture.md) - Capturing screenshots in tests

### API Documentation

- [Applications API Reference](./api/README.md) - Consolidated API documentation for applications and services

## Application-Specific Documentation

### Services

- [AI Orchestrator](../apps/ai-orchestrator/README.md)
- [Assets](../apps/assets/README.md)
- [Authentication](../apps/authentication/README.md)
- [Blogging](../apps/blogging/README.md)
- [Chat Collector](../apps/chat-collector/README.md)
- [Gateway](../apps/gateway/README.md)
- [Permissions](../apps/permissions/README.md)
- [Profile](../apps/profile/README.md)
- [Project Planning](../apps/project-planning/README.md)
- [Prompt Proxy](../apps/prompt-proxy/README.md)
- [Social](../apps/social/README.md)
- [Telos Docs Service](../apps/telos-docs-service/README.md)

### Frontend Applications

- [Client Interface](../apps/client-interface/README.md)
- [Forge of Will](../apps/forgeofwill/README.md)
- [Christopher Rutherford Net](../apps/christopherrutherford-net/README.md)

## Library Documentation

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
- [Email](./guides/email-providers.md) - Email service with plugin architecture
- [Encryption](../libs/encryption/README.md) - Cryptographic operations
- [Logger](../libs/logger/README.md) - Logging service
- [Models](../libs/models/README.md) - Shared data models
- [UI Models](../libs/ui-models/README.md) - UI-specific data models
- [Storage](../libs/storage/README.md) - Storage utilities
- [Permission Lib](../libs/permission-lib/README.md) - Permission utilities
- [Theme Lib](../libs/theme-lib/README.md) - Theme utilities
- [Compose Lib](../libs/compose-lib/README.md) - Composition utilities
- [Prompt Generation](../libs/prompt-generation/README.md) - AI prompt generation
## Quick Links

- [Main README](../README.md) - Project overview and quick start
- [Build and Push Workflow](../.github/workflows/build-push.yml) - Deployment contract validation and image promotion
- [Deploy Workflow](../.github/workflows/deploy.yml) - Staging and production ArgoCD deployment flow
- [Deployment Inventory Validator](../scripts/validate-deployment-inventory.mjs) - Inventory consistency checks
- [Examples](../examples/README.md) - Code examples and reference implementations
