# Authentication

The authentication service handles login, identity, tokens, and related user security flows. Its source lives in `apps/authentication/src`, with domain areas for users, tokens, key data, and cache behavior.

## Local Development

Run it as part of the main stack:

```bash
npm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/authentication`

## Repo Role

- user login and token issuance
- authentication checks for the broader gateway-facing platform
- part of the canonical deployment inventory used by CI and k8s validation

## Nx Commands

```bash
npx nx build authentication
npx nx test authentication
```
