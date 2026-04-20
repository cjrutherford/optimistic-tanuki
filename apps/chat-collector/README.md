# Chat Collector

The chat collector service stores and retrieves chat-related data for the platform. Its code lives under `apps/chat-collector/src/app` with persistent entities defined alongside the service logic.

## Local Development

Run it via the main development stack:

```bash
pnpm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/chat-collector`

## Repo Role

- chat persistence and lookup support
- backend dependency for chat and messaging surfaces
- part of the canonical deployment inventory

## Nx Commands

```bash
pnpm exec nx build chat-collector
pnpm exec nx test chat-collector
```
