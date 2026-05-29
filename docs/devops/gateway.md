# Gateway Configuration

## Overview

The gateway is a NestJS-based API gateway that routes requests to microservices via TCP. It handles authentication, WebSocket connections, and service discovery.

The important current detail is that the gateway is now deployment-composable:

- one shared codebase
- one shared image
- a generated gateway composition contract per deployment

That contract controls which service-backed surfaces are active for a given deployed state.

## Configuration Files

- **Code**: `apps/gateway/src/config.ts`
- **Config**: `apps/gateway/src/assets/config.yaml`
- **Composition Runtime**: generated `gateway/composition.yaml`
- **K8s**: generated `k8s/base/gateway.yaml`

## Gateway Composition Contract

Generated deployments now include a gateway composition file:

```text
<deployment>/gateway/composition.yaml
```

That file describes the enabled service graph for the deployment.

The gateway uses it to decide:

- which controllers are registered
- which realtime gateways are enabled
- whether a service token resolves to a real TCP client or a disabled proxy
- whether optional modules such as MCP tooling should be imported

This is how the repo supports multiple clients and multiple deployment states without forking the gateway application itself.

## Runtime Behavior

The gateway runtime now has three service states:

- enabled service with a real upstream TCP client
- disabled service with no exposed controller or realtime gateway
- disabled service token resolved to an inert client proxy for DI stability

That means the deployment contract can shrink the active surface area without forcing per-client source builds.

## Environment Variables

The gateway reads service host/port from environment variables:

### Required Format

```
{SERVICE_KEY}_HOST
{SERVICE_KEY}_PORT
```

Where `SERVICE_KEY` is the uppercase service name with underscores.

### Supported Services

| Service Key        | Host Env Var            | Port Env Var            | Default Port |
| ------------------ | ----------------------- | ----------------------- | ------------ |
| authentication     | AUTHENTICATION_HOST     | AUTHENTICATION_PORT     | 3001         |
| profile            | PROFILE_HOST            | PROFILE_PORT            | 3002         |
| social             | SOCIAL_HOST             | SOCIAL_PORT             | 3003         |
| asset              | ASSET_HOST              | ASSET_PORT              | 3005         |
| project_planning   | PROJECT_PLANNING_HOST   | PROJECT_PLANNING_PORT   | 3006         |
| chat_collector     | CHAT_COLLECTOR_HOST     | CHAT_COLLECTOR_PORT     | 3007         |
| telos_docs_service | TELOS_DOCS_SERVICE_HOST | TELOS_DOCS_SERVICE_PORT | 3008         |
| ai_orchestration   | AI_ORCHESTRATION_HOST   | AI_ORCHESTRATION_PORT   | 3010         |
| blogging           | BLOGGING_HOST           | BLOGGING_PORT           | 3011         |
| permissions        | PERMISSIONS_HOST        | PERMISSIONS_PORT        | 3012         |
| store              | STORE_HOST              | STORE_PORT              | 3013         |
| app_configurator   | APP_CONFIGURATOR_HOST   | APP_CONFIGURATOR_PORT   | 3014         |
| forum              | FORUM_HOST              | FORUM_PORT              | 3015         |
| wellness           | WELLNESS_HOST           | WELLNESS_PORT           | 3016         |

### Other Environment Variables

| Variable                 | Description                            | Default          |
| ------------------------ | -------------------------------------- | ---------------- |
| LISTEN_PORT              | HTTP port                              | 3000             |
| JWT_SECRET               | JWT signing secret                     | from config.yaml |
| NODE_ENV                 | Environment                            | production       |
| GATEWAY_COMPOSITION_PATH | path to generated composition contract | unset            |

### Database/Redis

| Variable      | Default  |
| ------------- | -------- |
| POSTGRES_HOST | postgres |
| POSTGRES_PORT | 5432     |
| REDIS_HOST    | redis    |
| REDIS_PORT    | 6379     |

## K8s Example

```yaml
env:
  - name: LISTEN_PORT
    value: '3000'
  - name: AUTHENTICATION_HOST
    value: 'authentication'
  - name: AUTHENTICATION_PORT
    value: '3001'
  - name: SOCIAL_HOST
    value: 'social'
  - name: SOCIAL_PORT
    value: '3003'
  # ... other services
```

## Configuration Precedence

1. Environment variables (highest priority)
2. config.yaml file
3. Default values (lowest priority)

For deployment composition, the runtime contract is:

1. generated `gateway/composition.yaml`
2. generated service host and port wiring
3. static config defaults

## Service Discovery

The gateway uses Kubernetes service names for internal communication:

- Service name = hostname (e.g., `authentication` → `authentication:3001`)
- All microservices must be in the same namespace

Only enabled services are expected to be reachable for a given deployment. Disabled service tokens do not create real upstream connections.

## Health Check

```bash
curl http://gateway:3000/api/mcp/sse
```

Returns 200 OK when healthy.

## WebSocket Endpoints

| Endpoint     | Port | Purpose              |
| ------------ | ---- | -------------------- |
| /socket.io   | 3300 | Chat WebSocket       |
| /chat        | 3300 | Chat WebSocket (alt) |
| /api/mcp/sse | 3000 | MCP SSE              |

## Troubleshooting

```bash
# Test service connectivity from gateway pod
kubectl exec -it <gateway-pod> -n optimistic-tanuki -- \
  nc -zv authentication 3001

# View gateway logs
kubectl logs -f deployment/gateway -n optimistic-tanuki

# Check config being used
kubectl exec -it <gateway-pod> -n optimistic-tanuki -- \
  cat /app/src/assets/config.yaml

# Check gateway composition being used
kubectl exec -it <gateway-pod> -n optimistic-tanuki -- \
  cat /etc/optimistic-tanuki/gateway/composition.yaml
```
