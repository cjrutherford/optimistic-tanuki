# Getting Started with Optimistic Tanuki

Welcome! This guide will help you get Optimistic Tanuki running on your local machine.

## Overview

Optimistic Tanuki is a monorepo containing microservices and frontend applications for:

- **Digital Homestead**: Personal content management and social features
- **Forge of Will**: Project management and planning tool
- **Personal Website**: Portfolio and blog platform

## Prerequisites

Before you begin, ensure you have the following installed:

- **[Docker](https://docs.docker.com/get-docker/)** - For running services in containers
- **[Node.js](https://nodejs.org/)** v18 or higher - JavaScript runtime
- **[pnpm](https://pnpm.io/installation)** - Fast, disk-efficient package manager

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/cjrutherford/optimistic-tanuki.git
cd optimistic-tanuki
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all dependencies for the monorepo using Nx's optimized installation process.

## Running the Application

### Option 1: Quick Start (Recommended for First-Time Users)

Use the provided start script to run all services:

```bash
./start-local.sh
```

This script will:

1. Start the PostgreSQL database
2. Run database migrations
3. Start all backend services
4. Launch the frontend applications

**Services Started:**

- PostgreSQL Database (port 5432)
- Gateway (port 3333)
- Authentication Service (port 3001)
- Profile Service (port 3002)
- Social Service (port 3003)
- Assets Service (port 3005)
- Project Planning Service (port 3006)
- Chat Collector (port 3007)
- Client Interface (port 4200) - Main web app
- Forge of Will (port 4201) - Project management app

**Access the Applications:**

- Main App: http://localhost:4200
- Forge of Will: http://localhost:4201
- API Gateway: http://localhost:3333

### Option 2: Docker Compose

Run services in Docker containers:

**Standard Stack** (Main application):

```bash
docker-compose up -d
```

**Forge of Will Stack**:

```bash
docker-compose -f fow.docker-compose.yaml up -d
```

**Development Mode with Debugging**:

```bash
# Build applications
npm run build:dev

# Start with debugging enabled
docker-compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d

# Enable hot-reload (in separate terminal)
npm run watch:build
```

For detailed debugging instructions, see the [Debugging Guide](../development/debugging.md).

### Option 3: Individual Services with Nx

Run specific services independently:

```bash
# Run gateway
nx serve gateway

# Run client interface
nx serve client-interface

# Run authentication service
nx serve authentication
```

## First-Time Setup

### 1. Database Setup

The database should be automatically set up when using `start-local.sh` or Docker Compose.

To manually set up the database:

```bash
# Create databases
./create-dbs.sh

# Run migrations
./setup-and-migrate.sh
```

### 2. Seed Initial Data

To seed permissions and other initial data:

```bash
./seed-permissions.sh
```

### 3. Create a User Account

Once the services are running:

1. Navigate to http://localhost:4200
2. Click "Register" or "Sign Up"
3. Create your first user account

## Development Workflow

### Making Changes

1. **Edit Code**: Make changes to files in `apps/` or `libs/`
2. **Build**: Nx will automatically rebuild affected projects
3. **Test**: Run tests for your changes (see Testing section below)

### Building Applications

```bash
# Build all applications
nx run-many --target=build --all

# Build specific application
nx build client-interface
```

### Running Tests

```bash
# Run all tests
nx run-many --target=test --all

# Run tests for specific library
nx test common-ui

# Run E2E tests
nx e2e client-interface-e2e
```

For comprehensive testing information, see the [E2E Testing Guide](../testing/e2e-testing.md).

### Code Quality

```bash
# Lint all projects
nx run-many --target=lint --all

# Lint specific project
nx lint gateway
```

## Project Structure

```
optimistic-tanuki/
├── apps/                    # Applications (services and frontends)
│   ├── authentication/      # Auth service
│   ├── client-interface/    # Main frontend
│   ├── forgeofwill/        # Project management frontend
│   ├── gateway/            # API gateway
│   ├── profile/            # Profile service
│   ├── social/             # Social service
│   └── ...                 # Other services
├── libs/                   # Shared libraries
│   ├── common-ui/          # Common UI components
│   ├── database/           # Database utilities
│   ├── models/             # Shared data models
│   └── ...                 # Other libraries
├── docs/                   # Documentation
├── docker/                 # Docker configuration
└── tools/                  # Build tools and scripts
```

## Common Tasks

### Viewing Logs

When running with Docker:

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f gateway
```

### Stopping Services

```bash
# Stop Docker services
docker-compose down

# Stop with cleanup
docker-compose down -v  # Removes volumes (databases will be reset!)
```

### Cleaning Build Artifacts

```bash
# Clear Nx cache
nx reset

# Remove node_modules and reinstall
rm -rf node_modules
pnpm install
```

## Troubleshooting

### Port Already in Use

If you get port conflict errors:

```bash
# Check what's using a port (e.g., 3333)
lsof -i :3333

# Kill the process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Restart database
docker-compose restart postgres

# Check database logs
docker-compose logs postgres
```

### Build Failures

```bash
# Clear cache and rebuild
nx reset
nx run-many --target=build --all
```

## Next Steps

Now that you have the application running:

1. **Explore the UI**: Navigate through the main application and Forge of Will
2. **Read the Architecture Docs**: Understand how the system works - [Architecture Overview](../architecture/)
3. **Review the MVP Plan**: See the project roadmap - [MVP Overview](./mvp-overview.md)
4. **Set Up Debugging**: Configure VS Code debugging - [Debugging Guide](../development/debugging.md)
5. **Learn About Testing**: Write and run tests - [Testing Guide](../testing/e2e-testing.md)

## Getting Help

- **Documentation**: Check the [Documentation Index](../README.md)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/cjrutherford/optimistic-tanuki/issues)
- **Contributing**: See the [Contributing Guide](../../README.md#-contributing)

Happy coding! 🚀
