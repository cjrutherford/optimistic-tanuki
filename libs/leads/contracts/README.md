# @optimistic-tanuki/leads-contracts

Shared lead, topic, and discovery DTOs for Optimistic Tanuki lead ingestion and qualification workflows.

## Install

```bash
npm install @optimistic-tanuki/leads-contracts
```

## Usage

```ts
import { LeadStatus, type CreateLeadDto } from '@optimistic-tanuki/leads-contracts';

const lead: CreateLeadDto = {
  name: 'Acme Corp',
  source: 'linkedin',
  status: LeadStatus.NEW,
};

console.log(lead);
```

## Runtime

This package is runtime-neutral and intended for browser or Node.js consumers that need stable lead-related DTOs and enums.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
