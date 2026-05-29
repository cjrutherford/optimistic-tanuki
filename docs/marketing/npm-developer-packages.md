# Developer Landing Page for npm Packages

Optimistic Tanuki publishes selected developer-facing packages through a dedicated mirror repository. Source development stays in this monorepo, while versioning and npm publication happen from the public mirror.

## Why These Packages Exist

The current package surface is aimed at teams that want stable contracts and reusable helpers without pulling in the full application stack.

- `@optimistic-tanuki/billing-sdk` packages billing client helpers for browser or server consumers
- `@optimistic-tanuki/billing-contracts` carries the shared DTOs behind the billing surface
- `@optimistic-tanuki/app-catalog-contracts` defines stable catalog payloads for apps and packages

## Billing SDK

`@optimistic-tanuki/billing-sdk` is the entry point for teams integrating with the billing service.

- typed helper builders for usage and billing workflows
- browser- or Node-compatible runtime posture
- transport-neutral design so client teams can bring their own HTTP layer
- designed to pair with `@optimistic-tanuki/billing-contracts`

Use it when you need to produce valid billing payloads and keep client-side integrations small and predictable.

## App-Catalog Contracts

`@optimistic-tanuki/app-catalog-contracts` is the contract layer for developer-facing catalog data.

- stable types for app and package catalog entries
- runtime-neutral payload shapes for browser and server consumers
- helper creation utilities for consistent entry generation
- useful when a developer portal, internal registry, or release view needs one shared catalog schema

Use it when you need a durable catalog contract, not app-specific business logic.

## Wave-1 Package Roadmap

The approved public-package inventory currently groups packages into active, wave-1, and deferred sets.

### Active now

- `@optimistic-tanuki/billing-contracts`
- `@optimistic-tanuki/billing-sdk`
- `@optimistic-tanuki/app-catalog-contracts`

### Wave-1 candidates

- `@optimistic-tanuki/constants`
- `@optimistic-tanuki/logger`
- `@optimistic-tanuki/encryption`
- `@optimistic-tanuki/leads-contracts`

### Deferred for cleanup

- `@optimistic-tanuki/permission-lib`

## Release Posture

- approved package sources are mirrored out of this repo
- the mirror repository owns versioning and npm publication
- the source repo validates publishable package boundaries and metadata before sync or release flows run

For package-level details, start with the library READMEs under `libs/` and the approved package registry in `tools/public-packages/public-packages.json`.
