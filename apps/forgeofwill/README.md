# Forge of Will

`forgeofwill` is the frontend for the project-management experience backed by `project-planning`. Its source lives under `apps/forgeofwill/src/app` with feature areas for projects, tasks, risk, journal, timer, and related pages.

## Local Development

Run it through the main development stack:

```bash
pnpm run docker:dev
```

Primary local URL:

- `http://localhost:8081`

For direct Nx work:

```bash
pnpm exec nx serve forgeofwill
pnpm exec nx build forgeofwill
```

## Repo Role

- frontend for project and task workflows
- depends on the gateway and project-planning backend
- included in the deployment inventory and image promotion flow
