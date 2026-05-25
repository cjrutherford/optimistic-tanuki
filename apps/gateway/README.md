# Gateway

The gateway is the platform entrypoint for HTTP, SSE, and WebSocket traffic. It routes requests to backend services and exposes the authenticated surface used by browser clients and terminal tooling such as `tools/stack-client`.

## Documentation

- architecture: [`../../docs/services/gateway/architecture.md`](../../docs/services/gateway/architecture.md)
- operations: [`../../docs/services/gateway/operations.md`](../../docs/services/gateway/operations.md)
- dependency diagram: [`../../docs/services/gateway/dependency-diagram.md`](../../docs/services/gateway/dependency-diagram.md)
- request flow: [`../../docs/services/gateway/request-flow.md`](../../docs/services/gateway/request-flow.md)
- composition diagram: [`../../docs/services/gateway/composition-diagram.md`](../../docs/services/gateway/composition-diagram.md)
- realtime flow: [`../../docs/services/gateway/realtime-flow.md`](../../docs/services/gateway/realtime-flow.md)

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

## Repo Role

The gateway is central to both local and deployed flows:

- local browser apps call it as the main backend entrypoint
- `tools/stack-client` authenticates against it and issues terminal-driven requests through it
- staging and production smoke tests in `.github/workflows/deploy.yml` currently hit its exposed surface

## Environment Variables

- `LISTEN_PORT`: HTTP API port loaded from `src/config.ts`
- `JWT_SECRET`: JWT secret forwarded to gateway auth flows
- `APP_REGISTRY_PATH`: optional app-registry override file
- `GATEWAY_COMPOSITION_PATH`: optional YAML file used to enable or disable downstream service surfaces
- `<SERVICE>_HOST` and `<SERVICE>_PORT`: per-service TCP overrides for downstream dependencies such as `AUTHENTICATION`, `PROFILE`, `SOCIAL`, `STORE`, and `VIDEOS`
- `GOOGLE_*`, `GITHUB_*`, `MICROSOFT_*`, `FACEBOOK_*`: OAuth values surfaced to gateway-managed OAuth endpoints
- `CLIENT_INTERFACE_DOMAIN` and `CI_*`: per-domain OAuth overrides for client-interface consumers

## Deployment Notes

The gateway is part of the canonical deployment inventory exported by `tools/admin-env-wizard/cmd/deployment-inventory`. Its image tag is promoted through the staging and production Kustomize overlays rather than by directly rewriting the base manifest.

## Runtime Notes

- HTTP routes are exposed under the global `api` prefix
- Swagger is generated in-process at `/api-docs`
- global validation and throttling are enabled in `src/main.ts` and `src/app/app.module.ts`
- controller availability is composition-aware and can disappear if required downstream services are disabled
- chat and social realtime providers are only registered when their required services are enabled

## Nx Commands

```bash
pnpm exec nx build gateway
pnpm exec nx test gateway
pnpm exec nx serve gateway
```
