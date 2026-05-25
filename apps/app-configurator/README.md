# App Configurator

The app-configurator service is a Nest TCP microservice for creating, reading, updating, deleting, and resolving application configuration documents.

## Documentation

- architecture: [`../../docs/services/app-configurator/architecture.md`](../../docs/services/app-configurator/architecture.md)
- operations: [`../../docs/services/app-configurator/operations.md`](../../docs/services/app-configurator/operations.md)
- dependency diagram: [`../../docs/services/app-configurator/dependency-diagram.md`](../../docs/services/app-configurator/dependency-diagram.md)
- message catalog: [`../../docs/services/app-configurator/message-catalog.md`](../../docs/services/app-configurator/message-catalog.md)
- startup flow: [`../../docs/services/app-configurator/startup-flow.md`](../../docs/services/app-configurator/startup-flow.md)
- config document flow: [`../../docs/services/app-configurator/config-document-flow.md`](../../docs/services/app-configurator/config-document-flow.md)

## Runtime Notes

- runs as a Nest TCP microservice
- stores app configuration documents with JSON-heavy structures
- seeds demo data during bootstrap and also exposes seed scripts
- uses migrations and also has non-production schema-sync behavior that should be handled carefully

## Nx Commands

```bash
pnpm exec nx build app-configurator
pnpm exec nx test app-configurator
pnpm exec nx serve app-configurator
```
