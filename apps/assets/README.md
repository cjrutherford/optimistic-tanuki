# Assets Service

This service manages static assets for the application.

## Configuration

The application can be configured using environment variables.

| Variable     | Description              | Default |
|--------------|--------------------------|---------|
| `NODE_ENV`   | Node.js environment      | `production` |
| `PORT`       | Port to expose the service on | `3005`  |
| `listenPort` | Port for the service to listen on | `3005`  |

## Running the Service

The service is designed to be run in a Docker container. It exposes port `3005`.
