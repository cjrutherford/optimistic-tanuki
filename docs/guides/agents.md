<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

## Models and libraries

- models for Nestjs services cannot be used in Angular services due to context differences. instead place models intended to operate against an angular context in the `ui-models` libarary.

## CI Error Guidelines

If the user wants help with fixing an error in their CI pipeline, use the following flow:

- Retrieve the list of current CI Pipeline Executions (CIPEs) using the `nx_cloud_cipe_details` tool
- If there are any errors, use the `nx_cloud_fix_cipe_failure` tool to retrieve the logs for a specific task
- Use the task logs to see what's wrong and help the user fix their problem. Use the appropriate tools if necessary
- Make sure that the problem is fixed by running the task that you passed into the `nx_cloud_fix_cipe_failure` tool

<!-- nx configuration end-->

## General Workspace Architecture

1. the apps folder is where all deployable code should be stored. this is broken down into three cases:
   - Gateway - HTTP endpoint for all platform operations.
   - Nestjs Microservice - TCP microservices that provide platform functionality
   - Angular Clients - Angular clients with SSR enabled and configured.
2. The libs folder include all supporting logic and mechanisms and fall into several categories:
   - UI-libary - Library providing visual components and reused frontend logic.
   - Backend library - Library providing logical components supporting either microservices or the gateway.
   - Contstants - Series of platform constants used by backend services and the gateway. (service commands, service tokens, etc.)
   - Models - structure classes and models used by backend services only
   - UI-models - structure classes and models used by front end services only.

_It's Highly important to note that UI and backend models should never mix as it breaks the build._

## Workspace commands

1. Build everything:
   - Dev: `npm run build:dev`
   - Prod: `npm run build`
2. Build Docker:
   - Dev: `npm run build:docker:dev`
   - Prod: `npm run build:docker`
   - Prod-slow: `npm run build:docker:slow`
3. Start application suite:
   - Dev: `npm run docker:dev`
   - Prod: `npm run docker:up`
4. syncing the database should be done with the `db-setup` container only.
5. generating migrations should be done in the app's folder and by using this command: `TS_NODE_PROJECT=./tsconfig.app.json node -r ts-node/register -r tsconfig-paths/register ../../node_modules/typeorm/cli.js -d src/staticDatabase.ts migration:generate migrations/<migration-name>` (config.yaml database host must be set to local host first, and set back to db after.)

Please refer to [Code and Scaffolding Guidelines](./code-and-scaffold-guidelines.md) for general style and procedure notes.
