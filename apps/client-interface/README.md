# Client Interface

`client-interface` is the main frontend application for the platform. Its source lives under `apps/client-interface/src/app` with components, directives, guards, state, and utility code split by concern.

## Local Development

The normal path is the repo development stack:

```bash
npm run docker:dev
```

Primary local URL:

- `http://localhost:8080`

For direct Nx work:

```bash
npx nx serve client-interface
npx nx build client-interface
```

## Repo Role

- primary browser frontend for the broader platform
- talks to the gateway as its backend entrypoint
- included in the deployment inventory and k8s overlay image promotion flow
