# Authentication Service

This service handles user authentication and authorization.

## Configuration

The application is configured via the `apps/authentication/src/assets/config.yaml` file. The following values can be set in this file or overridden by environment variables:

| Variable                | Description                   | Default Value                |
|-------------------------|-------------------------------|------------------------------|
| `listenPort`            | Port for the service to listen on | `3001`                       |
| `database.host`         | Database host                 | `db`                         |
| `database.port`         | Database port                 | `5432`                       |
| `database.name`         | Database name                 | `ot_authentication`          |
| `database.username`     | Database username             | `postgres`                   |
| `database.password`     | Database password             | `postgres`                   |
| `auth.jwtSecret`        | JWT secret for signing tokens | `c3VwZXJzZWNyZXRzdHJpbmc=`   |

## Running the Service

The service is designed to be run in a Docker container. It exposes port `3001`.
