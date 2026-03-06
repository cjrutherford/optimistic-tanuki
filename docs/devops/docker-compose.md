# Docker Compose Development

## Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Services

### Core Infrastructure

| Service  | Port | Description         |
| -------- | ---- | ------------------- |
| postgres | 5432 | PostgreSQL database |
| redis    | 6379 | Redis cache         |

### Microservices

| Service            | Port | Container Name        |
| ------------------ | ---- | --------------------- |
| authentication     | 3001 | ot_authentication     |
| profile            | 3002 | ot_profile            |
| social             | 3003 | ot_social             |
| forum              | 3015 | ot_forum              |
| chat-collector     | 3007 | ot_chat_collector     |
| assets             | 3005 | ot_assets             |
| prompt-proxy       | 3009 | ot_prompt_proxy       |
| ai-orchestration   | 3010 | ot_ai_orchestration   |
| telos-docs-service | 3008 | ot_telos_docs_service |
| blogging           | 3011 | ot_blogging           |
| permissions        | 3012 | ot_permissions        |
| project-planning   | 3006 | ot_project_planning   |
| store              | 3013 | ot_store              |
| app-configurator   | 3014 | ot_app_configurator   |
| wellness           | 3016 | ot_wellness           |

### Gateway

| Service             | Port | Container Name |
| ------------------- | ---- | -------------- |
| gateway (HTTP)      | 3000 | ot_gateway     |
| gateway (Chat WS)   | 3300 | ot_gateway     |
| gateway (Social WS) | 3301 | ot_gateway     |

### Client Applications

| Client                    | Port | Container Name         |
| ------------------------- | ---- | ---------------------- |
| client-interface          | 8080 | ot_client_interface    |
| forgeofwill               | 8081 | fow_client_interface   |
| digital-homestead         | 8082 | dh_client_interface    |
| christopherrutherford-net | 8083 | crdn_client_interface  |
| owner-console             | 8084 | owner_console          |
| store-client              | 8085 | ot_store_client        |
| d6                        | 8086 | ot_d6                  |
| configurable-client       | 8090 | ot_configurable_client |

## Client to Gateway

In Docker Compose, clients automatically proxy `/api/*` to the gateway:

```typescript
// server.ts in each client
app.use(
  '/api',
  createProxyMiddleware({
    target: 'http://ot_gateway:3000/api',
    changeOrigin: true,
  })
);
```

The target is hardcoded to `http://ot_gateway:3000` in Docker Compose.

## Environment Variables

### Gateway

The gateway reads from `config.yaml` in Docker Compose. Override with:

```bash
# Via docker-compose.yaml
environment:
  - AUTHENTICATION_HOST=ot_authentication
  - AUTHENTICATION_PORT=3001
```

### Clients

```bash
# Client environment
environment:
  - NODE_ENV=production
  - PORT=4000
  - GATEWAY_URL=http://ot_gateway:3000
  - GATEWAY_WS_URL=http://ot_gateway:3300
```

## Volumes

| Volume         | Path                     | Purpose          |
| -------------- | ------------------------ | ---------------- |
| postgres_data  | /var/lib/postgresql/data | Database storage |
| assets_storage | /usr/src/app/storage     | Asset files      |

## Health Checks

Services include health checks. Use `docker-compose ps` to view status.

## Development Workflow

```bash
# Rebuild specific service
docker-compose build gateway
docker-compose up -d gateway

# View service logs
docker-compose logs -f gateway

# Restart service
docker-compose restart gateway

# Scale service
docker-compose up -d --scale gateway=2
```

## Networking

All services share the `optimistic-tanuki_default` network. Services communicate using container names as hostnames.

## K8s vs Docker Compose Differences

| Aspect            | Docker Compose         | K8s                  |
| ----------------- | ---------------------- | -------------------- |
| Client access     | localhost:8080         | LoadBalancer IP:8080 |
| Gateway URL       | http://ot_gateway:3000 | http://gateway:3000  |
| Service discovery | container names        | K8s service names    |
| External access   | localhost              | LoadBalancer         |
