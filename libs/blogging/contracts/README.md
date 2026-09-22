# @optimistic-tanuki/blogging-contracts

Provider-neutral blogging DTOs and contract types for blogs, catalogs, posts,
components, events, and contacts. Single source for the blogging TCP surface
consumed via the gateway (see E18/G4 in the bounded-context plan).

Shapes are promoted from `@optimistic-tanuki/models` (single source moved
here — `models` re-exports for back-compat). `BlogPostDto`/`BlogEventDto`
aliases give generated clients the unambiguous E18 names without renaming the
~20 existing `PostDto`/`EventDto` consumers; the rename itself rides the O17
codegen rollout.

## Install

```bash
npm install @optimistic-tanuki/blogging-contracts
```

## Usage

```ts
import { CreateBlogPostDto } from '@optimistic-tanuki/blogging-contracts';
```

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
