# Service Ports Reference

## Microservices

| Service Name        | K8s Service Name   | Docker Port | K8s Port | Protocol  |
| ------------------- | ------------------ | ----------- | -------- | --------- |
| gateway             | gateway            | 3000        | 3000     | HTTP      |
| gateway (chat ws)   | gateway            | 3300        | 3300     | WebSocket |
| gateway (social ws) | gateway            | 3301        | 3301     | WebSocket |
| authentication      | authentication     | 3001        | 3001     | TCP       |
| profile             | profile            | 3002        | 3002     | TCP       |
| social              | social             | 3003        | 3003     | TCP       |
| assets              | assets             | 3005        | 3005     | TCP       |
| project-planning    | project-planning   | 3006        | 3006     | TCP       |
| chat-collector      | chat-collector     | 3007        | 3007     | TCP       |
| telos-docs-service  | telos-docs-service | 3008        | 3008     | TCP       |
| prompt-proxy        | prompt-proxy       | 3009        | 3009     | TCP       |
| ai-orchestration    | ai-orchestration   | 3010        | 3010     | TCP       |
| blogging            | blogging           | 3011        | 3011     | TCP       |
| permissions         | permissions        | 3012        | 3012     | TCP       |
| store               | store              | 3013        | 3013     | TCP       |
| app-configurator    | app-configurator   | 3014        | 3014     | TCP       |
| forum               | forum              | 3015        | 3015     | TCP       |
| wellness            | wellness           | 3016        | 3016     | TCP       |

## Client Applications

| Client                    | K8s Service Name          | Docker Port | K8s Port | Type         |
| ------------------------- | ------------------------- | ----------- | -------- | ------------ |
| client-interface          | client-interface          | 8080        | 8080     | LoadBalancer |
| forgeofwill               | forgeofwill               | 8081        | 8081     | LoadBalancer |
| digital-homestead         | digital-homestead         | 8082        | 8082     | LoadBalancer |
| christopherrutherford-net | christopherrutherford-net | 8083        | 8083     | LoadBalancer |
| owner-console             | owner-console             | 8084        | 8084     | LoadBalancer |
| store-client              | store-client              | 8085        | 8085     | LoadBalancer |
| d6                        | d6                        | 8086        | 8086     | LoadBalancer |
| configurable-client       | configurable-client       | 8090        | 8090     | LoadBalancer |

## Infrastructure

| Service    | Port | Purpose           |
| ---------- | ---- | ----------------- |
| PostgreSQL | 5432 | Primary database  |
| Redis      | 6379 | Caching, sessions |
| SeaweedFS  | 8080 | Object storage    |

## Client to Gateway Proxy

Angular clients proxy the following paths to the gateway:

| Path         | Target         | Purpose              |
| ------------ | -------------- | -------------------- |
| `/api/*`     | `gateway:3000` | REST API             |
| `/socket.io` | `gateway:3300` | Chat WebSocket       |
| `/chat`      | `gateway:3300` | Chat WebSocket (alt) |

Clients use environment variables for gateway URL:

```bash
GATEWAY_URL=http://gateway:3000      # HTTP API
GATEWAY_WS_URL=http://gateway:3300   # WebSocket
```

## Port Matching (Docker Compose vs K8s)

The K8s LoadBalancer ports match the Docker Compose ports exactly:

| Service                   | Docker Compose | K8s LoadBalancer |
| ------------------------- | -------------- | ---------------- |
| client-interface          | 8080:4000      | 8080             |
| forgeofwill               | 8081:4000      | 8081             |
| digital-homestead         | 8082:4000      | 8082             |
| christopherrutherford-net | 8083:4000      | 8083             |
| owner-console             | 8084:4000      | 8084             |
| store-client              | 8085:4000      | 8085             |
| d6                        | 8086:4000      | 8086             |
| configurable-client       | 8090:4000      | 8090             |

This allows accessing clients by port rather than path when using K8s LoadBalancer.
