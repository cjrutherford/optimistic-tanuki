# Prompt Proxy

The prompt-proxy service provides the platform’s backend surface for prompt-oriented AI requests. Its source lives under `apps/prompt-proxy/src/app`.

## Local Development

Run it through the normal development stack:

```bash
pnpm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/prompt-proxy`

## Repo Role

- backend prompt request mediation
- supports AI-oriented workflows in the platform
- included in the deployment inventory and image promotion flow

## Nx Commands

```bash
pnpm exec nx build prompt-proxy
pnpm exec nx test prompt-proxy
```
