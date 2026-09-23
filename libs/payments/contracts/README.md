# @optimistic-tanuki/payments-contracts

Provider-neutral payments DTOs and contract types for donations, payouts, and
provider webhooks. Single source for the payments TCP surface consumed via the
gateway (see E1/E3 in the bounded-context plan).

Classified payments, offers, business checkout/page/theme, and sponsorship
shapes are intentionally deferred: E14/E15 move their content reads to social,
and C3 decides the saga owner for classified writes. They gain DTOs then —
covering them now would bake the pre-move shapes into the contract.

## Install

```bash
npm install @optimistic-tanuki/payments-contracts
```

## Usage

```ts
import { CreateDonationCheckoutDto } from '@optimistic-tanuki/payments-contracts';

const checkout: CreateDonationCheckoutDto = {
  userId: 'user_123',
  profileId: 'profile_123',
  amount: 25,
  isRecurring: false,
  appScope: 'finance',
};
console.log(checkout);
```

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
