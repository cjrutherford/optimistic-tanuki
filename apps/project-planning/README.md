# Project Planning Service

This service manages projects, tasks, risks, and other project planning entities.

## Configuration

The application is configured via the `apps/project-planning/src/assets/config.yaml` file. The following values can be set in this file or overridden by environment variables:

| Variable                | Description                   | Default Value         |
|-------------------------|-------------------------------|-----------------------|
| `listenPort`            | Port for the service to listen on | `3006`                |
| `database.host`         | Database host                 | `db`                  |
| `database.port`         | Database port                 | `5432`                |
| `database.name`         | Database name                 | `ot_project_planning` |
| `database.username`     | Database username             | `postgres`            |
| `database.password`     | Database password             | `postgres`            |

## Running the Service

The service is designed to be run in a Docker container. It exposes port `3006`.
