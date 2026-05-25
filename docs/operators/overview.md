---
title: Operator Handbook
summary: Canonical entry point for platform operators managing local and deployed environments.
category: operators
audience: operator
section: operators
docRole: landing
landing: true
featured: true
order: 1
tags:
  - operations
  - runbooks
---

# Operator Handbook

Use this handbook when you need to run, inspect, recover, or deploy the Optimistic Tanuki platform.

## Audience

This section is for operators working in either of these environments:

- the shared local stack built with Docker Compose
- generated deployment workspaces under `dist/admin-env/<deployment>/`

## Start Here

- [Local Stack Operations](./local-stack.md) for bootstrap, health checks, logs, and local recovery
- [Deployment Environments](./deployment-environments.md) for generated workspaces, validation, and apply flow
- [Runbooks](./runbooks.md) for common operator procedures
- [Troubleshooting](./troubleshooting.md) for failure-mode recovery
- [Operator Reference](./reference.md) for high-frequency commands and file locations
- [Manual Docker Stacks](../devops/manual-docker-stacks.md) for the pnpm-driven Compose entrypoints behind the local workflows

## Operating Model

Operator documentation in this repository follows one rule: link to the source of truth instead of restating partial workflows.

- local-stack workflow source of truth: [Docker Compose Development](../devops/docker-compose.md)
- deployment workspace source of truth: [Deployment Workspace Workflow](../devops/deployment-workspace-workflow.md)
- deployment generation mechanics: [Deployment Generation](../devops/deployment-generation.md)
- GitOps and cluster application flow: [ArgoCD](../devops/argocd.md)

Use the handbook pages as the fastest path through those docs, with commands, expected outcomes, and recovery guidance organized for operator work.
