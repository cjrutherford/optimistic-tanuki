# @optimistic-tanuki/billing-contracts

Provider-neutral billing DTOs and contract types for metering, invoices, entitlements, and prepaid usage blocks.

## Install

```bash
npm install @optimistic-tanuki/billing-contracts
```

## Usage

```ts
import type { BillingPlan, UsageEvent } from '@optimistic-tanuki/billing-contracts';

const event: UsageEvent = {
  accountId: 'acct_123',
  meterId: 'api-requests',
  quantity: 1,
  timestamp: new Date().toISOString(),
};

const plan: BillingPlan | null = null;
console.log(event, plan);
```

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
