# Forge of Will

`forgeofwill` is the frontend for the project-management experience backed by `project-planning`. Its source lives under `apps/forgeofwill/src/app` with feature areas for projects, tasks, risk, journal, timer, and related pages.

## Local Development

Run it through the main development stack:

```bash
pnpm run docker:dev
```

Primary local URL:

- `http://forgeofwill.localhost:8081`

Use the dedicated `.localhost` hostname for browser and OAuth work. Plain
`localhost:8081` is not a supported Forge OAuth origin because cookies are not
port-scoped.

For local Google OAuth, register both exact gateway callback URIs with the
provider: `http://localhost:8080/api/oauth/callback/google` for Client
Interface and `http://forgeofwill.localhost:8081/api/oauth/callback/google`
for Forge. They keep the initiation nonce host-only on the app that started the
flow.

For direct Nx work:

```bash
pnpm exec nx serve forgeofwill
pnpm exec nx build forgeofwill
```

## Repo Role

- frontend for project and task workflows
- depends on the gateway and project-planning backend
- included in the deployment inventory and image promotion flow

## Nx Commands

```bash
pnpm exec nx serve forgeofwill
pnpm exec nx build forgeofwill
pnpm exec nx test forgeofwill
```
