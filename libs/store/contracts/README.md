# @optimistic-tanuki/store-contracts

Provider-neutral store DTOs and contract types for catalog, products, orders,
subscriptions, donations, appointments, availabilities, and resources. Single
source for the store TCP surface consumed via the gateway (see E2/E5/E7 in the
bounded-context plan).

Mutation DTOs are re-exported from `@optimistic-tanuki/models` (promote, don't
duplicate — `models` is itself `type:contracts`, so the boundary holds). This
lib adds the query/reference shapes the TCP surface needs and the parity spec
that maps every command key to its DTO, scalar/empty payload, or explicit
deferral (E5 invoice and E7 entitlement shapes arrive with the persistence
moves, not before).

## Install

```bash
npm install @optimistic-tanuki/store-contracts
```

## Usage

```ts
import { CreateProductDto } from '@optimistic-tanuki/store-contracts';
```

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
