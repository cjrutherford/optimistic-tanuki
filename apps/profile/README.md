# Profile

The profile service manages user profiles, timelines, and related profile data. The main implementation lives under `apps/profile/src/profiles` and `apps/profile/src/timelines`.

## Local Development

Run it as part of the main stack:

```bash
npm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/profile`

## Repo Role

- user profile storage and retrieval
- timeline and profile-related data flows for multiple frontends
- part of the gateway and deployment inventory surface

## Nx Commands

```bash
npx nx build profile
npx nx test profile
```
