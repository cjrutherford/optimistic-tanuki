# Development & Debugging Guide

This guide provides detailed instructions for developing, debugging, and hot-reloading applications in the Optimistic Tanuki monorepo.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Debugging Services with VS Code](#debugging-services-with-vs-code)
- [Hot Reload Development Workflow](#hot-reload-development-workflow)
- [Inspector Port Mappings](#inspector-port-mappings)
- [Troubleshooting](#troubleshooting)

## Development Environment Setup

### Prerequisites

- Docker and Docker Compose
- Node.js v18 or higher
- pnpm package manager
- Visual Studio Code (recommended for debugging)

### Initial Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build all applications:
   ```bash
   npm run build:dev
   ```

3. Start the development stack:
   ```bash
   # For the main stack
   docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d
   
   # OR for the Forge of Will stack
   docker compose -f fow.docker-compose.yaml -f fow.docker-compose.dev.yaml up -d
   ```

## Debugging Services with VS Code

All services in the development stack expose Node.js inspector ports for remote debugging. VS Code launch configurations are pre-configured in `.vscode/launch.json`.

### How to Debug

1. **Start the development stack** (see above)

2. **Open VS Code** in the workspace root

3. **Open the Debug panel** (View → Debug or Ctrl+Shift+D)

4. **Select a debug configuration** from the dropdown (e.g., "Attach to Gateway (Docker)")

5. **Press F5** or click the green play button to start debugging

6. **Set breakpoints** in your TypeScript source files - they will work thanks to source maps!

### Available Debug Configurations

Each service has a corresponding debug configuration:

- `Attach to Gateway (Docker)` - API Gateway
- `Attach to Authentication (Docker)` - Authentication Service
- `Attach to Profile (Docker)` - Profile Service
- `Attach to Social (Docker)` - Social Service
- `Attach to Project-Planning (Docker)` - Project Planning Service
- `Attach to Chat-Collector (Docker)` - Chat Collector Service
- `Attach to Assets (Docker)` - Assets Service
- `Attach to Blogging (Docker)` - Blogging Service
- `Attach to AI-Orchestration (Docker)` - AI Orchestration Service
- `Attach to Prompt-Proxy (Docker)` - Prompt Proxy Service
- `Attach to Telos-Docs-Service (Docker)` - Telos Docs Service
- `Attach to Permissions (Docker)` - Permissions Service
- `Attach to Client Interface (OT) (Docker)` - Main Client Interface (SSR)
- `Attach to ForgeOfWill Client Interface (Docker)` - Forge of Will (SSR)
- `Attach to Digital Homestead Client Interface (Docker)` - Digital Homestead (SSR)
- `Attach to CRDN Client Interface (Docker)` - ChristopherRutherford.net (SSR)

### Source Maps Configuration

All TypeScript applications are configured to generate source maps:

- **tsconfig.base.json**: Base configuration with `sourceMap: true`
- **Individual tsconfig.app.json**: Each app has `sourceMap: true` in its compiler options
- **VS Code launch.json**: All debug configurations include:
  - `sourceMaps: true`
  - `outFiles` patterns pointing to compiled JavaScript/MJS files
  - Proper `localRoot` and `remoteRoot` mappings

This enables seamless breakpoint debugging in TypeScript source files!

## Hot Reload Development Workflow

The development stack supports automatic service restarts when code changes are detected.

### How It Works

```
Source Change → Nx Watch → Rebuild → Dist Update → Nodemon Detects → Service Restarts
```

1. **Source files** in `apps/` and `libs/` are monitored by `nx watch`
2. **Nx rebuilds** the changed application automatically
3. **Compiled output** is written to `dist/apps/`
4. **Docker volumes** mount `dist/` directories into containers
5. **Nodemon** detects file changes in the container
6. **Service restarts** automatically with the new code

### Enable Hot Reload

To enable hot reload, run the watch script in a **separate terminal**:

```bash
npm run watch:build
```

This command uses `nx watch --all` to monitor all applications and rebuild them on changes.

### Alternative: Combined Workflow

For convenience, you can use the combined script that starts both the dev stack and watch mode:

```bash
npm run docker:dev:watch
```

This runs:
1. `npm run build:dev` - Initial build
2. `docker compose up` - Starts the dev stack
3. `npm run watch:build` - Enables hot reload

**Note**: This uses `concurrently` to run multiple commands, which may be harder to debug. Consider running the commands separately during active development.

### What Gets Reloaded

When you make changes to:

- **Backend services** (NestJS apps in `apps/*`): Service automatically restarts
- **Shared libraries** (`libs/*`): All apps using the library rebuild and restart
- **Configuration files**: May require manual restart of affected containers

### What Doesn't Trigger Reload

- **Dockerfile changes**: Requires rebuild with `docker compose build`
- **docker-compose.yaml changes**: Requires restart with `docker compose up -d`
- **Environment variables**: Requires container restart
- **Node modules**: Requires rebuild of Docker images

## Inspector Port Mappings

All services expose Node.js inspector ports for debugging. Ports are mapped consistently across both development stacks.

| Service | Container | Inspector Port | VS Code Config |
|---------|-----------|----------------|----------------|
| Gateway | ot_gateway | 9000 | Attach to Gateway (Docker) |
| Authentication | ot_authentication | 9229 | Attach to Authentication (Docker) |
| Project-Planning | ot_project_planning | 9231 | Attach to Project-Planning (Docker) |
| Social | ot_social | 9232 | Attach to Social (Docker) |
| Chat-Collector | ot_chat_collector | 9233 | Attach to Chat-Collector (Docker) |
| Profile | ot_profile | 9234 | Attach to Profile (Docker) |
| Blogging | ot_blogging | 9235 | Attach to Blogging (Docker) |
| AI-Orchestration | ot_ai_orchestration | 9236 | Attach to AI-Orchestration (Docker) |
| Prompt-Proxy | ot_prompt_proxy | 9237 | Attach to Prompt-Proxy (Docker) |
| Telos-Docs-Service | ot_telos_docs_service | 9238 | Attach to Telos-Docs-Service (Docker) |
| Permissions | ot_permissions | 9239 | Attach to Permissions (Docker) |
| Client Interface (OT) | ot_client_interface | 9240 | Attach to Client Interface (OT) (Docker) |
| ForgeOfWill | fow_client_interface | 9241 | Attach to ForgeOfWill Client Interface (Docker) |
| Digital Homestead | dh_client_interface | 9242 | Attach to Digital Homestead Client Interface (Docker) |
| CRDN | crdn_client_interface | 9243 | Attach to CRDN Client Interface (Docker) |
| Assets | ot_assets | 9244 | Attach to Assets (Docker) |

### Verifying Inspector Ports

To verify all inspector ports are open:

```bash
# Check which ports are listening
docker compose ps

# View logs for a specific service to see inspector message
docker compose logs gateway | grep "Debugger listening"
```

You should see output like:
```
Debugger listening on ws://0.0.0.0:9000/...
```

## Troubleshooting

### Breakpoints Not Working

**Problem**: Breakpoints are not hitting or show as unverified (hollow circles)

**Solutions**:
1. Verify source maps are enabled in `tsconfig.app.json`
2. Check that the debug configuration's `outFiles` pattern matches your build output
3. Ensure `localRoot` and `remoteRoot` mappings are correct in `launch.json`
4. Rebuild the application: `npm run build:dev`
5. Restart the container: `docker compose restart <service-name>`

### Hot Reload Not Working

**Problem**: Code changes don't trigger rebuilds or restarts

**Solutions**:
1. Verify `npm run watch:build` is running
2. Check that the changed file is included in the Nx project
3. Look for build errors in the watch output
4. Verify nodemon is monitoring the correct files in the container:
   ```bash
   docker compose logs <service-name> | grep nodemon
   ```
5. Check volume mounts in `docker-compose.dev.yaml` are correct

### Cannot Connect to Debugger

**Problem**: VS Code shows "Cannot connect to runtime process"

**Solutions**:
1. Verify the container is running: `docker compose ps`
2. Check the inspector port is exposed: `docker compose port <service-name> <port>`
3. Verify no port conflicts: `lsof -i :<port>` (Linux/Mac) or `netstat -ano | findstr :<port>` (Windows)
4. Check container logs for inspector messages: `docker compose logs <service-name>`
5. Try restarting the container: `docker compose restart <service-name>`

### Build Errors After Changes

**Problem**: Service fails to start after making changes

**Solutions**:
1. Check the watch build output for TypeScript errors
2. Verify all imports are correct and libraries are built
3. Clear the build cache: `rm -rf dist/ && npm run build:dev`
4. Rebuild the Docker image if Dockerfile changed: `docker compose build <service-name>`

### Service Keeps Restarting

**Problem**: Service restarts in a loop

**Solutions**:
1. Check container logs: `docker compose logs <service-name>`
2. Look for runtime errors or missing dependencies
3. Verify environment variables are set correctly
4. Check database connectivity if applicable
5. Try running the service locally to isolate the issue: `nx serve <app-name>`

## Tips & Best Practices

1. **Use the watch mode**: Keep `npm run watch:build` running in a dedicated terminal for the best development experience

2. **Debug one service at a time**: Multiple debuggers can slow down your IDE and system

3. **Check logs frequently**: Use `docker compose logs -f <service-name>` to monitor service output

4. **Rebuild when needed**: After major dependency changes or Git branch switches, do a clean build:
   ```bash
   rm -rf dist/ node_modules/.cache
   npm run build:dev
   docker compose down
   docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d
   ```

5. **Use VS Code workspaces**: Consider creating a multi-root workspace to organize your development environment

6. **Monitor resource usage**: Docker containers can consume significant resources. Monitor with:
   ```bash
   docker stats
   ```

## Further Reading

- [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
- [Nx Documentation](https://nx.dev/)
- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [VS Code Debugging](https://code.visualstudio.com/docs/editor/debugging)
