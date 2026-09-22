# @optimistic-tanuki/finance-contracts

Provider-neutral finance DTOs and contract types for accounts, ledger
transactions, budgets, recurring items, inventory, receivables, tenants, and
bank connections. Single source for the finance TCP surface consumed via the
gateway (see E3/E4/E6 in the bounded-context plan).

Mutation and read shapes are promoted from `@optimistic-tanuki/models`
(single source moved here — `models` re-exports for back-compat). The ledger
posting extensions for E3 (`source`, `sourceId`, `providerMeta`) and the
`billingInvoiceId` link for E6 arrive with the persistence moves, not before.

## Install

```bash
npm install @optimistic-tanuki/finance-contracts
```

## Usage

```ts
import { CreateTransactionDto } from '@optimistic-tanuki/finance-contracts';
```

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
