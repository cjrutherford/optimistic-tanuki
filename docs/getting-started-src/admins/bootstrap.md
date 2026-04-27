---
id: admin-bootstrap
title: Bootstrap The Stack
slug: bootstrap
summary: Build development artifacts, start the compose stack, and seed shared local data.
order: 20
---
# Bootstrap The Stack

From the repository root, use the development bootstrap flow:

```bash
pnpm install
pnpm run docker:dev:bootstrap
```

That flow builds the workspace, starts the Docker Compose development stack, and runs the shared seed step.

After bootstrap, keep build output fresh in another terminal:

```bash
pnpm run watch:build
```
