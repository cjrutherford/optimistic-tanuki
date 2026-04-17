# Telos Docs Service

The telos-docs-service manages documentation-oriented data for the platform. Its source lives in `apps/telos-docs-service/src/app` with persona, profile, and project-specific Telos areas split into separate folders.

## Local Development

Run it as part of the main stack:

```bash
npm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/telos-docs-service`

## Repo Role

- backend documentation and telos-related content support
- used by broader platform features rather than as a standalone app surface
- included in the canonical deployment inventory

## Nx Commands

```bash
npx nx build telos-docs-service
npx nx test telos-docs-service
```
