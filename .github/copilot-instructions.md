# Copilot Instructions for Optimistic Tanuki

Welcome to the Optimistic Tanuki codebase! This document provides essential guidelines for AI coding agents to be productive in this repository.

## Overview

Optimistic Tanuki is a collection of microservices and frontend applications organized into two main directories:

- `apps`: Contains individual applications (services and frontends).
- `libs`: Contains shared libraries used across applications.

The project uses Nx for workspace management and Docker Compose for running application stacks.

## Key Workflows

### Running Applications

#### Standard Stack
To start the main application stack:
```bash
docker-compose up -d
```
This includes services like `client-interface`, `gateway`, `profile`, and more.

#### Forge of Will Stack
To start the "Forge of Will" stack:
```bash
docker-compose -f fow.docker-compose.yaml up -d
```
This includes services like `forgeofwill` and `project-planning`.

### Running Unit Tests
Each library and application has unit tests managed by Nx. For example:
```bash
nx test common-ui
```
Replace `common-ui` with the desired library or application name.

## Project-Specific Conventions

1. **Microservices Architecture**: Each service has its own directory under `apps`.
2. **Shared Libraries**: Common functionality is abstracted into libraries under `libs`.
3. **Nx Workspace**: Use Nx commands for building, testing, and managing dependencies.

## Integration Points

- **API Gateway**: The `gateway` service acts as the central API gateway.
- **Database**: PostgreSQL is used as the primary database, with setup scripts in `db-setup`.
- **Authentication**: The `authentication` service handles user authentication.

## Examples

- To test the `social-ui` library:
  ```bash
  nx test social-ui
  ```
- To start the `assets` service:
  ```bash
  nx serve assets
  ```

## Development operations

Each stack will have it's own dev docker compose file to run the services in a development mode. This will typically include volume mounts to allow for live reloading of code changes. this is currently a work in progress and doesn't actually reload code changes yet. it requires a rebuild and restart.

To start the development stack for the main application:
```bash
docker-compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d
```

To start the development stack for the Forge of Will application:
```bash
docker-compose -f fow.docker-compose.yaml -f fow.docker-compose.dev.yaml up -d
```

## Additional Notes

- Refer to individual `README.md` files in `libs` and `apps` for more details on specific components.
- Use the `nx` CLI for efficient workspace management.

Feel free to update this document as the project evolves!