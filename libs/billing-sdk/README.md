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

## Generated client (Track A pilot, O15)

`src/generated/billing.ts` is orval output from the gateway OpenAPI document
(`dist/openapi.json`, `billing` tag only) — do not edit by hand. Regenerate:

```bash
pnpm run get-openapi
pnpm exec nx run billing-sdk:generate
```

The package re-exports the generated `OptomisitcTanukiAPIService` (Angular
`HttpClient` client for `POST /api/billing/usage/record`,
`POST /api/billing/usage/batch`, `POST /api/billing/invoices/preview`) so it
is the single `/api/billing/*` caller. The `build*Payload` builders above are
kept as thin domain helpers; `billing-sdk-generated-parity.spec.ts` pins
builder output against the generated parameter types (including the
`Date`→ISO-string wire boundary). Angular is a peer dependency.

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
