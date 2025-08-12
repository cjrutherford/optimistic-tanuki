# Telos Docs Service

This service manages Telos documents.

## Configuration

The application is configured via the `apps/telos-docs-service/src/assets/config.yaml` file. The following values can be set in this file or overridden by environment variables:

| Variable                | Description                   | Default Value             |
|-------------------------|-------------------------------|---------------------------|
| `listenPort`            | Port for the service to listen on | `3008`                    |
| `database.host`         | Database host                 | `db`                      |
| `database.port`         | Database port                 | `5432`                    |
| `database.username`     | Database username             | `postgres`                |
| `database.password`     | Database password             | `postgres`                |
| `database.dbName`       | Database name                 | `ot_telos_docs_service`   |

## Running the Service

To run the service, use the following command:

```bash
nx serve telos-docs-service
```
