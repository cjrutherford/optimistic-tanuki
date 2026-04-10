# Project Planning

The project-planning service is the backend for project, task, timer, journal, analytics, and risk workflows. Its source is organized under `apps/project-planning/src/app` by domain feature.

## Local Development

Run it through the main repo stack:

```bash
npm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/project-planning`

## Repo Role

- backend for Forge of Will and related project-management surfaces
- task and project state, journaling, time tracking, and risk tracking
- part of the canonical deployment inventory

## Nx Commands

```bash
npx nx build project-planning
npx nx test project-planning
```
