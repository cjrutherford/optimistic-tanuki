# Social

The social service handles social interactions and social data for the platform. Its source lives under `apps/social/src/app` with supporting entities and service implementations under `src/entities` and `src/app/services`.

## Local Development

Run it via the main stack:

```bash
pnpm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/social`
- social WebSocket exposed through the gateway on `ws://localhost:3301/social`

## Repo Role

- social graph and interaction backend
- supports posts, comments, reactions, and real-time social updates
- part of the deployment inventory and gateway runtime surface

## Nx Commands

```bash
pnpm exec nx build social
pnpm exec nx test social
```
