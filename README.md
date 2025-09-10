# Optimistic Tanuki

This workspace contains the source code for the Optimistic Tanuki project, a collection of microservices and frontend applications.

## Project Structure

The workspace is organized into the following directories:

- `apps`: Contains the source code for the individual applications (services and frontends).
- `libs`: Contains shared libraries used by the applications.
- `tools`: Contains scripts and other tools for the workspace.

## Running the Applications

There are two main application stacks that can be run using Docker Compose.

### Standard Stack

This stack runs the main application, including the `client-interface` frontend.

To start the standard stack, run the following command:

```bash
docker-compose up -d
```

This will start the following services:

- `postgres`: PostgreSQL database
- `db-setup`: Database setup and migration service
- `authentication`: Authentication service (port 3001)
- `client-interface`: Main frontend application (port 8080)
- `gateway`: API gateway (port 3000)
- `profile`: Profile service (port 3002)
- `social`: Social service (port 3003)
- `chat-collector`: Chat collector service (port 3007)
- `assets`: Assets service (port 3005)

### Forge of Will Stack

This stack runs the "Forge of Will" application, which includes the `forgeofwill` frontend and the `project-planning` service.

To start the Forge of Will stack, run the following command:

```bash
docker-compose -f fow.docker-compose.yaml up -d
```

This will start the following services:

- `postgres`: PostgreSQL database
- `db-setup`: Database setup and migration service
- `authentication`: Authentication service (port 3001)
- `forgeofwill`: Forge of Will frontend application (port 8080)
- `gateway`: API gateway (port 3000)
- `profile`: Profile service (port 3002)
- `project-planning`: Project planning service (port 3006)
- `social`: Social service (port 3003)
- `chat-collector`: Chat collector service (port 3007)
- `assets`: Assets service (port 3005)