# App Configurator Architecture

`app-configurator` is a Nest TCP microservice for CRUD-style management of application configuration documents, including lookup by domain or name and JSON-heavy site configuration payloads.

## Main Responsibilities

- create app configuration records
- retrieve by id, name, domain, or full list
- update and delete configuration records
- seed demo configuration data in development and bootstrap scenarios

## Runtime Model

- Nest TCP microservice
- Node/Webpack build
- Postgres-backed persistence
- seed scripts and startup seeding for demo configuration state

## Design Notes

- configuration documents are schema-rich and JSON-heavy
- production handling should prefer migrations over schema auto-sync
- host applications depend on stable config shape for rendering and navigation behavior
