# @optimistic-tanuki/social-contracts

Provider-neutral social DTOs and contract types for posts, events, communities,
follows, polls, shares, and presence. Single source for the social TCP surface
consumed via the gateway (see E17/E18/G2/G4 in the bounded-context plan).

Naming rule (E17/E18): social shapes are prefixed `Social` (`SocialPost`,
`SocialEvent`) so OpenAPI codegen never confuses them with the blogging
equivalents (`BlogPost`, `BlogEvent` in `blogging-contracts`).

Votes, reactions, comments, attachments, links, notifications, search, privacy,
activity, saved items, analytics, scheduled posts, and the community
election/manager/invite sub-surface are deferred to follow-up slices and named
in the parity spec — covering them now would exceed one reviewable slice.

## Install

```bash
npm install @optimistic-tanuki/social-contracts
```

## Usage

```ts
import { CreateSocialPostDto } from '@optimistic-tanuki/social-contracts';

const post: CreateSocialPostDto = {
  title: 'Hello',
  content: 'World',
  profileId: 'profile_123',
  userId: 'user_123',
};
console.log(post);
```

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
