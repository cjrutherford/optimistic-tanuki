# Assets

The assets service manages uploaded and generated files for the platform. Its source lives under `apps/assets/src` with service code in `src/app` and entity definitions in `src/entities`.

## Local Development

Run it as part of the main stack:

```bash
npm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/assets`

## Repo Role

- backend asset storage and retrieval
- file metadata and asset-related entity handling
- part of the canonical deployment inventory used by the k8s and CI flows

## Nx Commands

```bash
npx nx build assets
npx nx test assets
```
