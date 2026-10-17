# Draft PR

**Title:** `feat: deliver OT and TS release-readiness slices`

## Summary

This branch carries the cross-stack release-readiness work from RR-00 through RR-15 and the bounded RR-11 guardian flow. It updates OT and Towne Square privacy boundaries, authenticated sessions, community/feed/discussion access, classified listing and media authorization, chat/forum recovery, accessibility, moderation, shared navigation, guardian consent and account controls, and operational evidence. Shared UI work is placed in reusable libraries. The audit and marketing documents record verified behavior, deferred work, and claims that remain gated.

The branch also adds deployment-evidence tooling, generated API-client updates, and local integration evidence. The final preparation commit fixes CI-revealed contract, accessibility, and test-fixture issues. The work documents release gaps; it does not declare either app ready for public release.

## Data and operator notes

The branch adds 15 service-owned TypeORM migrations across authentication, assets, profile, social, and forum. The migration-governance validator and setup-script contract passed; guardian lifecycle migrations also passed local fresh up/down/reapply validation. These checks do not establish production migration success. Review each migration with its owning service and follow the repository's existing migration/deployment process.

## Review guide

- Read [the release-readiness master audit](./MASTER-AUDIT.md) and [execution plan](./EXECUTION-PLAN.md) for accepted slices, open gates, and sequencing.
- Start with [the sanitized pre-PR evidence index](./evidence/pre-pr-2026-10-16/README.md) for guardian runtime proof and its limits.
- The full review range is `efef92fec0fee2c8cb2879e98b08d046e9f3b0a3..HEAD`; this draft covers the complete branch range, not only the last guardian commits.

## Validation

Final workflow-equivalent results are recorded in the evidence index above. The source readiness commit checked against `main` is `a14e902c102671673cb14e9f03e05fed6fd8e9f8`; the evidence and this draft are included in a documentation-only follow-up commit. GitHub required checks remain pending because this preparation did not create a PR. No check is represented as green unless it completed against the stated source revision. Local-checkout contamination and infrastructure-dependent checks not run are listed explicitly.

## Remaining release work

This PR does not complete account deletion/export (DF-007), seven-day inactivity expiry, pre-age and pre-consent tracking prevention, 90-day deletion of all account-activity logs across providers and backups, production provider/OAuth/email/media verification, production deployment provenance, manual assistive-technology review, publication of approved public policies, or support and abuse-response operations. Guardian consent wording is owner-approved, while public policy publication and production delivery remain unverified. RR-11 remains a gap and RR-12 remains a conditional production-integration gate. See the master audit for the authoritative state.

No deployment, release, or merge approval is implied.
