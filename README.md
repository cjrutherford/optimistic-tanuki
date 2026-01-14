# Optimistic Tanuki

This monorepo contains the source code for the Optimistic Tanuki project, a collection of microservices and frontend applications that power a personal digital homestead, a project management tool, and a blogging platform.

## 🚀 Getting Started

**New to this project?** Start with our comprehensive [Getting Started Guide](./docs/getting-started/README.md) which includes:

- Detailed installation instructions
- Multiple ways to run the application
- First-time setup steps
- Troubleshooting tips
- Next steps for development

### Quick Start

1. Clone the repo and install dependencies:

   ```sh
   git clone https://github.com/cjrutherford/optimistic-tanuki.git
   cd optimistic-tanuki
   pnpm install
   ```

2. Start all services:

   ```sh
   ./start-local.sh
   ```

3. Access the applications:
   - Main App: http://localhost:4200
   - Forge of Will: http://localhost:4201
   - API Gateway: http://localhost:3333

**Prerequisites**: [Docker](https://docs.docker.com/get-docker/), [Node.js](https://nodejs.org/) (v18+), [pnpm](https://pnpm.io/installation)

## 🛠️ Development

For comprehensive development guides, see the [Development Documentation](./docs/development/).

### Quick Development Commands

```bash
# Start all services in development mode
./start-local.sh

# Run specific service with Nx
nx serve gateway

# Build all applications
nx run-many --target=build --all
```

### Development with Docker and Debugging

For Docker-based development with debugging and hot-reload support, see the [Debugging Guide](./docs/development/debugging.md). This guide covers:

- Setting up VS Code debugging for all services
- Configuring hot-reload with `nx watch`
- Inspector port mappings
- Troubleshooting common issues

Quick start with debugging:

```bash
# Build all applications
npm run build:dev

# Start development stack with debugging enabled
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d

# In a separate terminal: enable hot-reload
npm run watch:build
```

## 🚢 Deployment

The applications are deployed using Docker. There are two main application stacks that can be run using Docker Compose.

### Standard Stack

This stack runs the main application, including the `client-interface` frontend.

To start the standard stack, run the following command:

```bash
docker-compose up -d
```

### Forge of Will Stack

This stack runs the "Forge of Will" application, which includes the `forgeofwill` frontend and the `project-planning` service.

To start the Forge of Will stack, run the following command:

```bash
docker-compose -f fow.docker-compose.yaml up -d
```

## 🧪 Testing

This project includes comprehensive end-to-end (E2E) tests for all applications and microservices.

For detailed testing documentation, see the [Testing Guides](./docs/testing/).

### Quick Test Commands

```bash
# Run all E2E tests
nx run-many --target=e2e --all

# Run specific application tests
nx e2e client-interface-e2e
nx e2e authentication-e2e
nx e2e gateway-e2e

# Run unit tests
nx test common-ui
```

### Setup

Before running tests, install Playwright browsers:

```bash
npx playwright install
```

**Key Testing Resources:**

- [E2E Testing Guide](./docs/testing/e2e-testing.md) - Comprehensive E2E testing with Playwright
- [Test Portability Guide](./docs/testing/test-portability.md) - Running tests in different environments
- [Quick Reference](./docs/testing/quick-reference.md) - Common testing tasks
- [Test Coverage](./docs/testing/coverage.md) - Coverage information and goals

## ✨ Built With

- [Angular](https://angular.io/) - Frontend framework
- [NestJS](https://nestjs.com/) - Backend framework
- [Nx](https://nx.dev/) - Monorepo management tool
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Docker](https://www.docker.com/) - Containerization
- [Playwright](https://playwright.dev/) - E2E testing for web applications

## 📂 Project Structure

The workspace is organized into the following directories:

- **`apps/`**: Individual applications (services and frontends)
- **`libs/`**: Shared libraries used across applications
- **`docs/`**: Comprehensive project documentation
- **`tools/`**: Build scripts and development tools
- **`docker/`**: Docker configuration files

For detailed information about specific applications and libraries, see the [Documentation Index](./docs/README.md).

## 📚 Documentation

All documentation has been organized into a comprehensive, navigable structure. Start with the [Documentation Index](./docs/README.md) to find what you need:

- **[Getting Started](./docs/getting-started/)** - Installation and first-time setup
- **[Development](./docs/development/)** - Development guides and configuration
- **[Architecture](./docs/architecture/)** - System design and architecture docs
- **[Guides](./docs/guides/)** - Step-by-step guides for specific features
- **[Testing](./docs/testing/)** - Testing guides and best practices
- **[API Documentation](./docs/api/)** - API reference for all services

### Quick Links

- [Getting Started Guide](./docs/getting-started/README.md) - Start here if you're new
- [MVP Overview](./docs/getting-started/mvp-overview.md) - Project roadmap and plan
- [Debugging Guide](./docs/development/debugging.md) - Set up debugging in VS Code
- [Permissions System](./docs/architecture/permissions.md) - RBAC implementation
- [Theme System](./docs/architecture/theme-system.md) - Theming architecture
- [E2E Testing](./docs/testing/e2e-testing.md) - End-to-end testing guide

## 📦 Project Applications

Here's a list of the individual applications within this workspace:

- **`ai-orchestrator`**: A service for orchestrating AI-related tasks.
- **`assets`**: A service for managing digital assets.
- **`authentication`**: A service for user authentication and authorization.
- **`blogging`**: A service for managing blog posts and comments.
- **`chat-collector`**: A service for collecting and storing chat messages.
- **`christopherrutherford-net`**: The frontend for the christopherrutherford.net website.
- **`client-interface`**: The main frontend application for the digital homestead.
- **`digital-homestead`**: A service for managing the digital homestead.
- **`forgeofwill`**: The frontend for the Forge of Will project management tool.
- **`gateway`**: An API gateway that routes requests to the appropriate microservice.
- **`profile`**: A service for managing user profiles.
- **`project-planning`**: A service for managing projects, tasks, and other project-related data.
- **`prompt-proxy`**: A service for proxying requests to prompt-based AI models.
- **`social`**: A service for managing social media integrations.
- **`telos-docs-service`**: A service for managing documentation.

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
