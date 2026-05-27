---
title: Marketing Generator
summary: Signal Foundry is a campaign workbench for turning product context into strategy directions, coordinated channel drafts, material assets, and measurable refinement history.
category: apps
section: applications
tags:
  - marketing
  - campaign
  - angular
  - workspace
---

# Marketing Generator

`marketing-generator` is the Signal Foundry application. It turns a structured brief into a reusable campaign workbench for products, services, and custom apps.

## Current Product Surface

The app currently supports:

- a six-step brief for offer, audience, strategy, outputs, brand, and review
- six strategy directions per generation run
- coordinated multi-channel output bundles across web, email, and social
- editable material assets for flyer, brochure, business card, and web ad formats
- named workspaces with duplication, version snapshots, and restore
- concept compare, shortlist, and winner selection workflow
- export/download for markdown bundles, JSON bundles, manifests, and HTML assets
- local-first telemetry for selections, exports, edits, regenerations, and workspace activity
- concept feedback capture and per-block regeneration on channel and material copy
- prompt preparation for image generation, without rendered-image fulfillment

## Product Model

Signal Foundry is a guided workbench, not a one-shot prompt toy. The app keeps three layers visible:

1. the brief that defines the campaign request
2. the concept gallery used to compare and choose a direction
3. the editing workspace where channel drafts and material copy are refined, exported, and measured

## Main Workflows

### Create a workbench

Users complete the brief on `/create`, select one primary channel plus optional bundled supporting channels, choose material outputs, then generate a concept set.

### Decide on a direction

Users review the generated concept gallery on `/results`, shortlist directions, compare two concepts side by side, and choose a winner. The winner state and decision summary persist in the active workspace.

### Refine and export

Users can edit channel blocks and material copy directly, regenerate individual blocks, record concept feedback, and export:

- markdown bundles
- JSON bundles
- manifest JSON
- individual draft markdown
- branded material HTML

## Persistence and Insights

The app is local-first today.

- workspaces, selected concepts, and version history are stored in browser storage
- usage events and feedback are stored locally through `MarketingInsightsService`
- the results page exposes usage signals for generation runs, selections, exports, and block regenerations

## Non-Goals In The Current Implementation

The app does **not** currently provide:

- rendered image generation
- shared multi-user collaboration
- backend analytics aggregation
- downstream publishing or campaign delivery integrations

## Key Files

- `apps/marketing-generator/src/app/pages/landing-page.component.ts`
- `apps/marketing-generator/src/app/pages/create-page.component.ts`
- `apps/marketing-generator/src/app/pages/results-page.component.ts`
- `apps/marketing-generator/src/app/services/marketing-generator.service.ts`
- `apps/marketing-generator/src/app/services/marketing-state.service.ts`
- `apps/marketing-generator/src/app/services/marketing-insights.service.ts`
