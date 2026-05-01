---
id: admin-bootstrap
title: Bootstrap The Stack
slug: bootstrap
summary: Build development artifacts, start the compose stack, and seed shared local data.
order: 20
---

# Bootstrap The Stack

For the current local-stack workflow, use the canonical guide: `docs/devops/docker-compose.md`.

Typical entry points:

```bash
pnpm install
pnpm run docker:dev
pnpm run docker:dev:bootstrap
pnpm run watch:build
```

`docker:dev` is the phased full-stack startup path. `docker:dev:bootstrap` adds the shared seed step after startup.
