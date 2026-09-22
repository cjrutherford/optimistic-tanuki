# @optimistic-tanuki/profile-contracts

Provider-neutral profile DTOs and contract types for profiles and timelines.
Single source for the profile TCP surface consumed via the gateway, social
reads, and the AI orchestrator (see L8 in the bounded-context plan).

Shapes are promoted from `@optimistic-tanuki/models` (single source moved
here — `models` re-exports for back-compat). `BlogRole` is defined here from
the profile entity's values so contracts never import from an app.

Known gaps named in the parity spec: `ProfileCommands.Delete` is sent by the
gateway with no microservice handler; `GetPhoto`/`GetCover` and the timeline
`Update`/`Delete` commands have neither sender nor handler; the timelines
service keeps divergent local DTOs (`apps/profile/src/timelines/dto/`) that
unify onto these contracts as follow-up work.

## Install

```bash
npm install @optimistic-tanuki/profile-contracts
```

## Usage

```ts
import { CreateProfileDto } from '@optimistic-tanuki/profile-contracts';
```

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
