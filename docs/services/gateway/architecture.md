# Gateway Architecture

`gateway` is the HTTP-facing orchestration layer for the platform. It creates a Nest application, mounts all HTTP routes under the `api` prefix, enables global DTO validation, exposes Swagger at `/api-docs`, and conditionally wires downstream service proxies, controller groups, MCP tooling, and realtime providers.

## Main Responsibilities

- terminate browser and tool traffic at a single HTTP surface
- proxy requests to downstream TCP microservices through Nest `ClientProxy` providers
- centralize JWT-aware and permission-aware route handling
- expose platform registry and navigation metadata
- host chat and social realtime gateways when their backing services are enabled

## Composition Model

Gateway composition is controlled by `src/app/gateway-composition.ts` and `GATEWAY_COMPOSITION_PATH`.

- if no composition file is present, all known services are enabled
- if a composition file exists, controllers and realtime providers are filtered by `requiredServices`
- disabled services receive a `DisabledClientProxy`, which fails fast with a clear error instead of silently hanging

This means the gateway surface is intentionally elastic. The route inventory changes with the enabled service list.

## Key Runtime Layers

- `src/main.ts`: Nest bootstrap, validation pipe, CORS, body size limits, Swagger
- `src/app/app.module.ts`: controller registry, guard setup, service proxy wiring, realtime provider registration
- `src/app/gateway-service-providers.ts`: maps `ServiceTokens` to TCP client proxies
- `src/app/gateway-composition.ts`: composition file loading and route/provider filtering
- `src/controllers/**`: HTTP controller surfaces grouped by domain
- `src/app/chat-gateway` and `src/app/social-gateway`: realtime channels

## Controller Groups

The module assembles controller families for:

- authentication and oauth
- profile and persona
- social, community, follow, notifications, search, privacy, activity, presence, poll, post sharing
- blogging and blog components
- assets, videos, store, finance, payments, donations, classifieds, hardware, trainer
- permissions, project planning, app config, forum, leads, wellness, registry

That breadth is why dependency and composition diagrams are critical for maintenance.
