---
title: Developer Portal
summary: Developer-facing home for API docs, billing SDK onboarding, usage dashboard framing, and the metered usage roadmap.
category: apps
section: applications
tags:
  - developer
  - portal
  - angular
  - billing
---

# Developer Portal

`developer-portal` is the first external-developer-facing shell for the metered usage and API billing work.

## MVP Scope

The current MVP is intentionally narrow:

- live link to the current gateway API documentation
- usage dashboard framing for request activity, quota posture, and integration visibility
- billing SDK getting-started path tied to the existing usage roadmap
- proof-of-platform framing that connects Signal Foundry to the broader stack

## Why It Exists

The repository already has the ingredients for an external developer story: a shared gateway, a publishable billing SDK, and a roadmap for metered usage. This app puts those pieces in one place so prospective integrators and reviewers can evaluate the platform from a single entry point.

## Key Files

- `apps/developer-portal/src/app/app.component.ts`
- `apps/developer-portal/src/app/app.component.html`
- `apps/developer-portal/src/server.ts`
- `docs/plans/2026-04-21-metered-usage-api-billing.md`
