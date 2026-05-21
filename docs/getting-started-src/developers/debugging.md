---
id: developer-debugging
title: Debugging
slug: debugging
parent: developer-workflows
summary: Narrow failures using service logs, focused tests, and the running local stack.
order: 40
---
# Debugging

When something breaks:

1. Reproduce the issue with the smallest targeted command you can.
2. Inspect container logs with `pnpm run docker:dev:logs`.
3. Run a focused test or build target for the affected project.
4. Verify the relevant local endpoint before widening the scope again.
