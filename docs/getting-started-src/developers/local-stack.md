---
id: developer-local-stack
title: Start The Local Stack
slug: local-stack
summary: Build and start the integrated local environment used by most development work.
order: 20
---
# Start The Local Stack

Recommended flow:

```bash
pnpm run docker:dev:bootstrap
pnpm run watch:build
```

Primary entry points include the main app on `http://localhost:8080`, the gateway on `http://localhost:3000`, and other application-specific ports defined in the local stack.
