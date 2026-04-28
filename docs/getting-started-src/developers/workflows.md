---
id: developer-workflows
title: Daily Workflows
slug: workflows
summary: Use targeted Nx commands to build, test, and lint the parts of the workspace you change.
order: 30
---
# Daily Workflows

Common commands:

```bash
nx build client-interface
nx test common-ui
nx lint gateway
nx run-many --target=test --all
```

Prefer targeted commands while iterating, then widen out to broader verification before you finish.
