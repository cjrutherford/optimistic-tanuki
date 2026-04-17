# Fin Commander E2E

This project contains the Fin Commander Playwright review suite.

## Target Stack

- App: `http://localhost:8089`
- Gateway: `http://localhost:3000`

## Seed Verification Gate

Run the shared bootstrap flow before the suite:

```bash
npm run docker:dev:bootstrap
```

Only start the suite after all of the following are true:

- DB logs contain `All databases created`
- DB logs contain `Database setup and migrations complete.`
- Permissions seed logs contain `Seeding completed successfully.`
- Finance seed logs contain `Finance seeding completed successfully!`
- `http://localhost:3000/api-docs` responds successfully
- `POST http://localhost:3000/api/authentication/login` with `{}` returns `400`
- `http://localhost:8089` responds successfully

## Canonical First-Run Scope

- register
- login
- create profile
- create account
- choose workspaces
- land in setup checklist
- create first financial account
- create first plan
- enter commander overview without seeded `home-command` data

## Entry Point

The Nx entry point for this suite is:

```bash
BASE_URL=http://localhost:8089 GATEWAY_URL=http://localhost:3000 pnpm exec nx e2e fin-commander-e2e
```
