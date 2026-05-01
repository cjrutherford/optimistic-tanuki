---
id: developer-local-stack
title: Start The Local Stack
slug: local-stack
summary: Build and start the integrated local environment used by most development work.
order: 20
---

# Start The Local Stack

For the current local-stack workflow, use the canonical guide: `docs/devops/docker-compose.md`.

Typical entry points:

```bash
pnpm run docker:dev
pnpm run docker:dev:bootstrap
pnpm run watch:build
```

Use `pnpm run docker:infra:up` plus `pnpm exec nx serve <project>` when you only need shared infrastructure and one actively edited app.
