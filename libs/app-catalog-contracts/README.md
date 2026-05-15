# @optimistic-tanuki/app-catalog-contracts

Public contract types for developer-facing app and package catalog entries.

## Install

```bash
npm install @optimistic-tanuki/app-catalog-contracts
```

## Usage

```ts
import { createCatalogEntry, type DeveloperCatalogEntry } from '@optimistic-tanuki/app-catalog-contracts';

const entry: DeveloperCatalogEntry = createCatalogEntry({
  name: 'billing-sdk',
  ownerDomain: 'billing',
  releaseChannel: 'stable',
  deploymentMode: 'publishable-lib',
  billingEligibility: ['none'],
});

console.log(entry.name);
```

## Runtime

This package is runtime-neutral and intended for browser or Node.js consumers that need stable catalog payload shapes.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.

## Repo Role

- shared contract types for app and package catalog data
- intended for code that needs stable catalog payload shapes, not runtime business logic

## Nx Commands

```bash
pnpm exec nx build app-catalog-contracts
pnpm exec nx test app-catalog-contracts
```
