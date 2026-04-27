---
id: admin-operations
title: Operations Playbook
slug: operations
summary: Inspect service health, logs, and routine local-environment commands.
order: 30
---
# Operations Playbook

Useful commands for the shared stack:

```bash
pnpm run docker:dev:ps
pnpm run docker:dev:logs
pnpm run docker:dev:down
pnpm run docker:dev:seed
```

Use these checks when you need to confirm containers are up, inspect logs, stop the stack cleanly, or rerun the shared seed data.
