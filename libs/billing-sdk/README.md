# @optimistic-tanuki/billing-sdk

Small provider-neutral helpers for clients that call Optimistic Tanuki billing services.

This package is intended for browser or server runtimes. Transport adapters should stay outside this package.

## Install

```bash
npm install @optimistic-tanuki/billing-sdk @optimistic-tanuki/billing-contracts
```

## Usage

```ts
import { buildBatchRecordUsagePayload } from '@optimistic-tanuki/billing-sdk';

const payload = buildBatchRecordUsagePayload([
  {
    accountId: 'acct_123',
    meterId: 'api-requests',
    quantity: 1,
    timestamp: new Date().toISOString(),
  },
]);

console.log(payload.events.length);
```

## Runtime

This package is intended for browser or Node.js consumers. It keeps transport details outside the package and depends on `@optimistic-tanuki/billing-contracts` for shared payload types.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.

## Repo Role

- shared client-side billing helpers
- intended for browser or server consumers, without embedding transport specifics

## Nx Commands

```bash
pnpm exec nx build billing-sdk
pnpm exec nx test billing-sdk
```
