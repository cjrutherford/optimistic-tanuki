# Optimistic Tanuki Documentation

Welcome to the Optimistic Tanuki documentation index. This page is the fastest way to find the docs that match the repo as it exists today: a product portfolio, a composable platform, and a contributor workspace in one Nx monorepo.

## Start Here

Use the shortest path that matches what you are doing:

- new contributor: [Getting Started](./getting-started/README.md)
- product or platform evaluator: [Product Overview](../PRODUCT.md)
- marketing and pitch materials: [Marketing README](./marketing/README.md)
- understanding repo layout: [Workspace Map](./architecture/workspace-map.md)
- finding an app, library, or tool: [Workspace Catalog](./reference/workspace-catalog.md)
- local development workflow: [Docker Compose](./devops/docker-compose.md)
- deployment generation and per-client outputs: [Deployment Generation](./devops/deployment-generation.md)
- staging or production deployment flow: [DevOps README](./devops/README.md)
- operator runbooks and server administration: [Operator Handbook](./operators/overview.md)

## Current State

The current branch has a few operational surfaces that matter more than the older summary docs:

- local development is driven by `pnpm run docker:dev` and the dev Compose overrides
- the Kubernetes deployment contract is generated from the Go catalog in `tools/admin-env-wizard`
- GitHub Actions validate inventory consistency before image promotion
- staging and production image tags are carried in Kustomize overlay `images:` blocks
- ArgoCD applies a parameterized application manifest from `k8s/argo-app/application.yaml`
- there is now a second Go tool, `tools/stack-client`, for authenticated gateway access from a terminal UI

## Root Guides

- [Product Overview](../PRODUCT.md) - product portfolio, platform proof, visual story, and adoption paths
- [Contributing](../CONTRIBUTING.md)
- [Governance](../GOVERNANCE.md)

## Documentation Structure

### Getting Started

- [Getting Started](./getting-started/README.md) - First-run setup and contributor workflow
- [MVP Overview](./getting-started/mvp-overview.md) - Minimum viable product plan and roadmap

> **Note:** The `docs/getting-started-src/` directory contains audience-segmented landing pages
> (developers, admins, end-users) with YAML front-matter consumed by the docs-site UI playground
> (`apps/ui-playground`). For human-readable onboarding, use `docs/getting-started/` above.

### DevOps and Infrastructure

- [DevOps README](./devops/README.md) - DevOps documentation index
- [Operator Handbook](./operators/overview.md) - Formal operator docs for local and deployed environments
- [Infrastructure Setup](./operators/infrastructure-setup.md) - Full CI/CD pipeline setup with MicroK8s, Terraform, ArgoCD, and Tailscale
- [Architecture Overview](./devops/architecture.md) - Infrastructure architecture
- [Kubernetes Deployment](./devops/k8s.md) - Kustomize overlays, base resources, and deployment scripts
- [Service Ports Reference](./devops/ports.md) - Port mappings for all services
- [Gateway Configuration](./devops/gateway.md) - Gateway service configuration
- [Deployment Generation](./devops/deployment-generation.md) - General reference and process guide for generated deployment states
- [Docker Compose](./devops/docker-compose.md) - Local development and the dev stack workflow
- [ArgoCD](./devops/argocd.md) - GitOps deployment with the parameterized Argo application

### Development

- [Debugging Guide](./development/debugging.md) - Docker-based development with debugging and hot-reload
- [API Configuration](./development/api-configuration.md) - Setting up API base URLs and environment configuration
- [Admin Environment Wizard](../tools/admin-env-wizard/README.md) - Go CLI and TUI for environment generation
- [Stack Client](../tools/stack-client/README.md) - Go TUI client for authenticated gateway access

### Architecture

- [Architecture Overview](./architecture/README.md) - High-level system architecture and design
- [Workspace Map](./architecture/workspace-map.md) - Repo layout, ownership boundaries, and navigation guide
- [Permissions System](./architecture/permissions.md) - RBAC implementation and usage
- [Permissions Cache](./architecture/permissions-cache.md) - Caching configuration for permissions
- [Theme System](./architecture/theme-system.md) - Theme system architecture and reference
- [Theme Implementation](./architecture/theme-implementation.md) - Theme implementation details
- [CI/CD Pipeline](./architecture/cicd-pipeline.md) - Current GitHub Actions deployment flow
- [WebSocket Implementation](./architecture/websocket-implementation.md) - Real-time WebSocket server implementation
- [WebSocket Client](./architecture/websocket-client.md) - WebSocket client usage and integration
- [Security Audit](./architecture/security-audit.md) - Security audit findings and recommendations
- [Accessibility Compliance](./accessibility-compliance.md) - WCAG 2.1 AA compliance report for color palettes

### Guides

Step-by-step guides for specific tasks:

- [OAuth and Email Verification Setup](./guides/authentication-setup.md) - Production and local setup for server-owned OAuth, SMTP delivery, and verification flows
- [OAuth Provider Reference](./guides/oauth-providers.md) - Provider-console settings for Google, GitHub, Microsoft, and Facebook
- [Email Provider Setup](./guides/email-providers.md) - General SMTP, API, and console email-provider architecture
- [Local Hub Guide](./guides/local-hub.md) - Complete guide to the Local Hub (Towne Square) app: pages, services, seeding, business pages, elections, image pipeline, and deployment
- [Local Hub Commerce](./guides/local-hub-commerce.md) - Donations, business pages, and sponsorships in the Local Hub
- [Theme Designer Guide](./guides/theme-designer.md) - Using the theme designer component
- [Theme Migration Guide](./guides/theme-migration.md) - Migrating to the new theme system
- [Component Integration Guide](./guides/component-integration.md) - Integrating time tracking, tagging, and analytics components
- [Time Tracking and Analytics](./guides/time-tracking-analytics.md) - Time tracking, analytics, and task tagging feature reference
- [MCP Tools Guide](./guides/mcp-tools.md) - Model Context Protocol tools usage
- [MCP Validation Guide](./guides/mcp-validation.md) - Validating MCP implementations
- [Agents Guide](./guides/agents.md) - Working with AI agents in the platform

### Marketing

- [Marketing README](./marketing/README.md) - Index for product, platform, and developer-facing marketing docs
- [Repo Story](./marketing/repo-story.md) - Narrative pitch for the portfolio, service layer, deployment story, and package path
- [Towne Square](./marketing/towne-square.md) - One-pager for the local-first community platform
- [Forge of Will](./marketing/forge-of-will.md) - One-pager for the focused project execution product
- [Fin Commander](./marketing/fin-commander.md) - One-pager for the guided financial workflow product
- [Signal Foundry](./marketing/signal-foundry.md) - One-pager for the campaign workbench product
- [Platform Product Matrix](./marketing/platform-product-matrix.md) - Product comparison across audience, packaging, and deployment posture
- [npm Developer Packages](./marketing/npm-developer-packages.md) - Developer landing page for the public package surface
- [Admin Environment Wizard Demo Script](./marketing/admin-env-demo-script.md) - Ops/platform walkthrough from generated deployment to Swagger UI
- [Service Offerings](./marketing/service-offerings.md) - Service-led marketing input reference
- [Library Offerings](./marketing/library-offerings.md) - Library and package marketing input reference
- [Pricing Models](./marketing/pricing-models.md) - Pricing posture reference for marketing surfaces

### Testing

- [E2E Testing Guide](./testing/e2e-testing.md) - End-to-end testing with Playwright
- [Test Portability Guide](./testing/test-portability.md) - Running tests in different environments
- [Blog Features Testing](./testing/blog-features.md) - Testing blog-specific features
- [Blog Editor E2E Testing](./testing/blog-editor-e2e.md) - E2E tests for blog editor
- [Quick Reference](./testing/quick-reference.md) - Quick reference for common testing tasks
- [Test Coverage](./testing/coverage.md) - Code coverage information and goals
- [Screenshot Capture Guide](./testing/screenshot-capture.md) - Capturing screenshots in tests

### Features

User-facing feature documentation for the client-interface application:

- [Accessibility](./features/accessibility.md) - Accessibility features and guidelines
- [Authentication](./features/authentication.md) - Login, registration, and MFA features
- [Communities](./features/communities.md) - Community creation and management
- [Feed](./features/feed.md) - Social feed and content discovery
- [Messaging](./features/messaging.md) - Direct messaging features
- [Notifications](./features/notifications.md) - Notification system
- [Privacy](./features/privacy.md) - Privacy controls and user safety
- [Profile](./features/profile.md) - User profile management
- [Search](./features/search.md) - Search and discovery

### API Documentation

- [Applications API Reference](./api/README.md) - Consolidated API documentation for applications and services

### Payments

- [Payments Seeding](./payments/seeding.md) - Seeding payment providers and initial data

### Reference

- [Workspace Catalog](./reference/workspace-catalog.md) - Full inventory of apps, libraries, tools, and deployment surfaces
- [README Template](./reference/readme-template.md) - Standard structure for app, library, and e2e project READMEs

### Plans

Feature and design plans, including in-progress work:

- [Lead Discovery Hardening](./plans/2026-03-30-lead-discovery-hardening.md)
- [Leads Edit Workflow Fix](./plans/2026-03-30-leads-edit-workflow-fix.md)
- [Leads Onboarding Discovery Enhancement](./plans/2026-03-30-leads-onboarding-discovery-enhancement.md)
- [Video Transcoder Worker](./plans/2026-04-18-video-transcoder-worker.md)
- [Metered Usage API Billing](./plans/2026-04-21-metered-usage-api-billing.md)
- [Marketing Briefs](./plans/2026-04-25-marketing-briefs.md)
- [Fin Commander Usability](./plans/fin-commander-usability.md)
- [Part Sourcing and BTO Fulfillment](./plans/part-sourcing-bto-fulfillment.md)
- [Local Hub Plans](./plans/local-hub/README.md)

For the full list see the [`docs/plans/`](./plans/) directory.

## Application-Specific Documentation

### Services

- [AI Orchestrator](../apps/ai-orchestrator/README.md)
- [Assets](../apps/assets/README.md)
  - [Assets Architecture](./services/assets/architecture.md)
  - [Assets Operations](./services/assets/operations.md)
- [Authentication](../apps/authentication/README.md)
  - [Authentication Architecture](./services/authentication/architecture.md)
  - [Authentication Operations](./services/authentication/operations.md)
- [Billing](../apps/billing/README.md)
  - [Billing Architecture](./services/billing/architecture.md)
  - [Billing Operations](./services/billing/operations.md)
- [Blogging](../apps/blogging/README.md)
- [Chat Collector](../apps/chat-collector/README.md)
- [Gateway](../apps/gateway/README.md)
  - [Gateway Architecture](./services/gateway/architecture.md)
  - [Gateway Operations](./services/gateway/operations.md)
  - [App Registry and Navigation](./services/gateway/app-registry-navigation.md)
- [Permissions](../apps/permissions/README.md)
- [Profile](../apps/profile/README.md)
- [Project Planning](../apps/project-planning/README.md)
- [Prompt Proxy](../apps/prompt-proxy/README.md)
- [Social](../apps/social/README.md)
  - [Social Component Backend](./services/social/component-backend.md)
  - [Component Injection Refactoring](./services/social/component-injection-refactoring.md)
- [App Configurator](../apps/app-configurator/README.md)
  - [App Configurator Architecture](./services/app-configurator/architecture.md)
  - [App Configurator Operations](./services/app-configurator/operations.md)
- [System Configurator API](../apps/system-configurator-api/README.md)
  - [System Configurator API Architecture](./services/system-configurator-api/architecture.md)
  - [System Configurator API Operations](./services/system-configurator-api/operations.md)
- [Telos Docs Service](../apps/telos-docs-service/README.md)
  - [Telos Docs Service Architecture](./services/telos-docs-service/architecture.md)
  - [Telos Docs Service Operations](./services/telos-docs-service/operations.md)

### Frontend Applications

- [Client Interface](../apps/client-interface/README.md)
  - [Client Interface Overview](./client-interface.md)
- [Forge of Will](../apps/forgeofwill/README.md)
- [Marketing Generator](../apps/marketing-generator/README.md)
- [Developer Portal](../apps/developer-portal/README.md)
- [Christopher Rutherford Net](../apps/christopherrutherford-net/README.md)

## Library Documentation

Shared libraries used across applications:

### UI Libraries

- [AG Grid UI](../libs/ag-grid-ui/README.md) - AG Grid integration
- [Auth UI](../libs/auth-ui/README.md) - Authentication UI components
- [Business Portal UI](../libs/business-portal-ui/README.md) - Owner and client portal pages for business applications
- [Business Public UI](../libs/business-public-ui/README.md) - Public landing and booking flows for business applications
- [Blogging UI](../libs/blogging-ui/README.md) - Blog UI components
  - [Component Injection](../libs/blogging-ui/COMPONENT_INJECTION.md)
- [Chat UI](../libs/chat-ui/README.md) - Chat UI components
- [Common UI](../libs/common-ui/README.md) - Common UI components
- [Fin Commander Data Access](../libs/fin-commander-data-access/README.md) - Scoped plan state and overview helpers for Fin Commander
- [Fin Commander Imports](../libs/fin-commander-imports/README.md) - Import workbench and provider registry for Fin Commander
- [Form UI](../libs/form-ui/README.md) - Form components
- [Message UI](../libs/message-ui/README.md) - Message UI components
- [Navigation UI](../libs/navigation-ui/README.md) - Navigation components
- [Persona UI](../libs/persona-ui/README.md) - Persona/avatar components
- [Profile UI](../libs/profile-ui/README.md) - Profile UI components
- [Project UI](../libs/project-ui/README.md) - Project management UI
- [HAI UI](../libs/hai-ui/README.md) - HAI identity and cross-app discovery components
- [Social UI](../libs/social-ui/README.md) - Social feature UI
- [Store UI](../libs/store-ui/README.md) - Store/shopping UI
- [Theme UI](../libs/theme-ui/README.md) - Theme management UI
  - [Theme System](../libs/theme-ui/THEME_SYSTEM.md)
  - [Host Binding Migration](../libs/theme-ui/HOST_BINDING_MIGRATION.md)

### Core Libraries

- [App Registry Backend](../libs/app-registry-backend/README.md) - App registry and navigation contracts with default seed data
- [Auth Domain](../libs/auth/domain/README.md) - Password, MFA, and token-issuance domain logic
- [Business Data Access](../libs/business-data-access/README.md) - Business-site API, auth, and config state helpers
- [Billing Data Access](../libs/billing/data-access/README.md) - Billing persistence entities for accounts, usage events, and grants
- [Billing Domain](../libs/billing/domain/README.md) - Billing scope validation and invoice preview logic
- [Constants](../libs/constants/README.md) - Shared constants and tokens
- [Database](../libs/database/README.md) - Database connection and TypeORM setup
- [Email](./guides/email-providers.md) - Email service with plugin architecture
- [Encryption](../libs/encryption/README.md) - Cryptographic operations
- [Leads Data Access](../libs/leads/data-access/README.md) - Base CRUD and stats client for lead records
- [Leads Feature Flags](../libs/leads/feature-flags/README.md) - Lead flagging and review client
- [Leads Feature Onboarding](../libs/leads/feature-onboarding/README.md) - Multi-step onboarding and topic-suggestion client
- [Leads Feature Topics](../libs/leads/feature-topics/README.md) - Topic management and discovery lifecycle client
- [Logger](../libs/logger/README.md) - Logging service
- [Models](../libs/models/README.md) - Shared data models
- [Payments Domain](../libs/payments/domain/README.md) - Payment provider abstractions and Lemon Squeezy adapter logic
- [Permissions Domain](../libs/permissions/domain/README.md) - App-scope policy registry and authorization model definitions
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
