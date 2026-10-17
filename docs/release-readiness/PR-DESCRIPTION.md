# Draft PR

**Title:** `feat: deliver OT and TS release-readiness slices`

## Summary

This branch carries the cross-stack release-readiness work from RR-00 through RR-15 and the bounded RR-11 guardian flow. It updates OT and Towne Square privacy boundaries, authenticated sessions, community/feed/discussion access, classified listing and media authorization, chat/forum recovery, accessibility, moderation, shared navigation, guardian consent and account controls, and operational evidence. Shared UI work is placed in reusable libraries. The audit and marketing documents record verified behavior, deferred work, and claims that remain gated.

The branch also adds deployment-evidence tooling, generated API-client updates, and local integration evidence. The final preparation commit fixes CI-revealed contract, accessibility, and test-fixture issues. The work documents release gaps; it does not declare either app ready for public release.

## Data and operator notes

The branch adds 15 service-owned TypeORM migrations across authentication, assets, profile, social, and forum. The migration-governance validator and setup-script contract passed; guardian lifecycle migrations also passed local fresh up/down/reapply validation. These checks do not establish production migration success. Review each migration with its owning service and follow the repository's existing migration/deployment process.

## Review guide

- Read [the release-readiness master audit](https://github.com/cjrutherford/optimistic-tanuki/blob/chore/ot-ts-release-readiness/docs/release-readiness/MASTER-AUDIT.md) and [execution plan](https://github.com/cjrutherford/optimistic-tanuki/blob/chore/ot-ts-release-readiness/docs/release-readiness/EXECUTION-PLAN.md) for accepted slices, open gates, and sequencing.
- Start with [the sanitized pre-PR evidence index](https://github.com/cjrutherford/optimistic-tanuki/blob/chore/ot-ts-release-readiness/docs/release-readiness/evidence/pre-pr-2026-10-16/README.md) for guardian runtime proof and its limits.
- The full review range is `efef92fec0fee2c8cb2879e98b08d046e9f3b0a3..HEAD`; this draft covers the complete branch range, not only the last guardian commits.

## Validation

Local validation passed: 148 affected test projects, 148 lint projects, 88 build tasks and the final 75-task development aggregate. All six originally repaired E2E targets and the additional 21-test Business Site suite pass; Client Interface retains 384 existing skips and Gateway retains two. The final Forgeofwill token correction passed 319 unit tests, lint, heuristics, a new immutable-source production image, the full 34-test E2E suite and settled light/dark Axe checks. The animation-wait correction preserves the Axe assertions. Business Site also passed 168 unit tests, 36 setup tests, lint, a new immutable-source image and all 21 browser tests on a fresh private database. Its repairs align service composition, app identity and proxy Origin handling; the Studio selector correction targets the existing shared select. Migration governance, setup-script and 39 E2E workflow contracts pass.

The evidence index separates initial committed-source checks from the final repairs and their per-file source manifest over base commit `c31729d990912aa7769f76a6014f3eabc612e669`. The full affected gates preceded the final localized Forgeofwill and Business Site corrections; their targeted unit/lint/build/runtime checks and the final development aggregate document the later source states. Nx ran in the shared checkout with directory projects excluded; their pre-existing aliases and Compose edits remain on disk, while the final Forgeofwill image used an immutable archive plus only intended patches. Directory service/worker/library stubs and their root Compose/alias changes are excluded from this PR. No PR or push was performed during preparation; GitHub clean-checkout checks and production gates remain pending.

## Remaining release work

This PR does not complete account deletion/export (DF-007), seven-day inactivity expiry, pre-age and pre-consent tracking prevention, 90-day deletion of all account-activity logs across providers and backups, production provider/OAuth/email/media verification, production deployment provenance, manual assistive-technology review, publication of approved public policies, or support and abuse-response operations. Guardian consent wording is owner-approved, while public policy publication and production delivery remain unverified. RR-11 remains a gap and RR-12 remains a conditional production-integration gate. See the master audit for the authoritative state.

No deployment, release, or merge approval is implied.
