# @optimistic-tanuki/learning-contracts

Provider-neutral learning DTOs and contract types for enrolments, lesson
progress, attempts, evaluations, and offerings. Single source for the
learning-service TCP surface consumed via the gateway (see L7 in the
bounded-context plan).

Enum values mirror `learning-domain` zod schemas (`ActivityTypeSchema`,
`EvaluationSchema`, `PublicationStatusSchema`, `CO_EDITOR_PROFILE_ID_MAX`)
without importing them: `learning-domain` is `type:domain` and contracts libs
may only depend on contracts and util. The parity spec pins the mirrored
values; if a zod schema changes, the pin test fails and both are updated
together.

Deep content validation (modules, activities, rubrics) stays zod-side in
`learning-domain`; these contracts guard the wire envelope.

## Install

```bash
npm install @optimistic-tanuki/learning-contracts
```

## Usage

```ts
import { EnrolDto } from '@optimistic-tanuki/learning-contracts';

const enrol: EnrolDto = { profileId: 'profile_123', offeringId: 'offering_123' };
console.log(enrol);
```

## Runtime

This package is runtime-neutral and intended for TypeScript or JavaScript consumers in browser or Node.js environments.

## Source And Releases

Source development happens in the internal Optimistic Tanuki monorepo. Public package releases are mirrored into a package-only repository for distribution.
