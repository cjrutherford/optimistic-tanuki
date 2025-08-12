# Gateway Service

This service acts as a gateway to the other microservices in the system.

## Port

- **API Gateway:** `3000`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT`   | Port for the gateway to listen on | `3000`  |

## Configuration

The gateway is configured via the `apps/gateway/src/assets/config.yaml` file. This file contains the connection details for the microservices it communicates with.

### Microservice Dependencies

The gateway connects to the following microservices:

| Service            | Host                  | Port |
|--------------------|-----------------------|------|
| `asset`            | `ot_asset`            | `3005` |
| `authentication`   | `ot_authentication`   | `3001` |
| `profile`          | `ot_profile`          | `3002` |
| `social`           | `ot_social`           | `3003` |
| `tasks`            | `ot_tasks`            | `3004` |
| `project_planning` | `ot_project_planning` | `3006` |
| `chat_collector`   | `ot_chat_collector`   | `3007` |

## API Documentation

Swagger API documentation is available at `/api-docs` when the service is running.
