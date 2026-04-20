# Gateway

The gateway is the platform entrypoint for HTTP, SSE, and WebSocket traffic. It routes requests to backend services and exposes the authenticated surface used by browser clients and terminal tooling such as `tools/stack-client`.

## Local Development

The gateway runs as part of the main dev stack:

```bash
pnpm run docker:dev
```

Primary local endpoints:

- HTTP API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api-docs`
- MCP SSE: `http://localhost:3000/api/mcp/sse`
- Chat WebSocket: `ws://localhost:3300/chat`
- Social WebSocket: `ws://localhost:3301/social`

## Role in the Repo

The gateway is central to both local and deployed flows:

- local browser apps call it as the main backend entrypoint
- `tools/stack-client` authenticates against it and issues terminal-driven requests through it
- staging and production smoke tests in `.github/workflows/deploy.yml` currently hit its exposed surface

## Environment Variables

- `PORT`: HTTP API port, default `3000`
- `SOCKET_PORT`: chat WebSocket port, default `3300`
- `SOCIAL_SOCKET_PORT`: social WebSocket port, default `3301`
- `CORS_ORIGIN`: CORS configuration for development and local testing

## Deployment Notes

The gateway is part of the canonical deployment inventory exported by `tools/admin-env-wizard/cmd/deployment-inventory`. Its image tag is promoted through the staging and production Kustomize overlays rather than by directly rewriting the base manifest.
