# Social Service

This service manages social features like posts, comments, votes, and follows.

## Configuration

The application is configured via the `apps/social/src/assets/config.yaml` file. The following values can be set in this file or overridden by environment variables:

| Variable                | Description                   | Default Value   |
|-------------------------|-------------------------------|-----------------|
| `listenPort`            | Port for the service to listen on | `3003`          |
| `database.host`         | Database host                 | `db`            |
| `database.port`         | Database port                 | `5432`          |
| `database.username`     | Database username             | `postgres`      |
| `database.password`     | Database password             | `postgres`      |
| `database.database`     | Database name                 | `ot_social`     |

## Running the Service

The service is designed to be run in a Docker container. It exposes port `3003`.
