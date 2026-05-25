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
pnpm run docker:dev
pnpm run docker:dev:bootstrap
pnpm run watch:build
```

`docker:dev` is the phased full-stack startup path. `docker:dev:bootstrap` adds the shared seed step after startup.

After startup, verify the environment with:

```bash
pnpm run docker:dev:ps
pnpm run docker:dev:logs
```
