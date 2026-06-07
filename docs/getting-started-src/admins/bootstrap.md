---
id: admin-bootstrap
title: Bootstrap The Stack
slug: bootstrap
summary: Build development artifacts, start the compose stack, and seed shared local data.
order: 20
---

# Bootstrap The Stack

Use this page for the first local bring-up. For the full operating guide, continue to `docs/operators/local-stack.md`.

Typical entry points:

```bash
pnpm install
pnpm run docker:dev:bootstrap
pnpm run docker:dev
pnpm run watch:build
```

`docker:dev:bootstrap` is the first-run path: full development build, Docker build, phased startup, and shared seed data. `docker:dev` is the follow-up path that rebuilds and restarts only the changed app set.

After startup, verify the environment with:

```bash
pnpm run docker:dev:ps
pnpm run docker:dev:logs
```
