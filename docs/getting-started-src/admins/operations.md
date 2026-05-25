---
id: admin-operations
title: Operations Playbook
slug: operations
summary: Route from onboarding into the formal operator handbook for local and deployed environments.
order: 30
---

# Operations Playbook

Use the operator handbook in `docs/operators/` as the canonical server-administration surface.

Start with:

- `docs/operators/local-stack.md` for local Docker Compose administration
- `docs/operators/deployment-environments.md` for generated deployment workspaces
- `docs/operators/runbooks.md` for repeatable procedures
- `docs/operators/troubleshooting.md` for recovery workflows

Quick commands for the shared stack:

```bash
pnpm run docker:dev:ps
pnpm run docker:dev:logs
pnpm run docker:dev:down
pnpm run docker:dev:seed
```

Use these checks when you need to confirm containers are up, inspect logs, stop the stack cleanly, or rerun the shared seed data.
