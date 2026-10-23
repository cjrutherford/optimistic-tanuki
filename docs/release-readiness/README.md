# HAI OT + Towne Square Release-Readiness Package

This working package lives in `docs/release-readiness/`. RR-00 establishes this as the stable audit location and records version-control evidence.

## Purpose

This package defines and records:

- the HAI product/public-good philosophy;
- the Optimistic Tanuki (OT) and Towne Square (TS) public-release standard;
- the active release-readiness audit;
- the intended `RR-00` through `RR-15` slices;
- a running deferred-feature register;
- the private `retumbl` prototype dependency;
- a installed `AGENTS.md` guidance and its reference snippet.

## Start here

1. Read [the HAI philosophy](../product/HAI-PUBLIC-GOOD-PHILOSOPHY.md).
2. Read `MASTER-AUDIT.md`.
3. Review `DEFERRED-FEATURES.md`.
4. Work slices from `slices/` using [the execution map](./EXECUTION-PLAN.md), which makes the master audit order and dependency gates explicit.
5. Update slice status and evidence as work progresses.
6. Do not mark a slice `ACCEPTED` merely because code exists. Acceptance requires the evidence stated in the slice.

Current account-rights checkpoint: [J27 Forum owner capture](./findings/DF-007-J27.md) is locally verified. Continue with J28 integration using the [remaining-slices register](./REMAINING-SLICES.md).

## Core release rule

> Everything we advertise works, private things stay private, primary workflows do not predictably break, and an ordinary person can understand the product without its creator standing beside them.

## Claim reconciliation rule

Every advertised claim should be assigned one of:

- `VERIFY`
- `COMPLETE`
- `REWORD`
- `RETRACT`
- `DEFER`

If a claim is strategically correct and can be implemented **and validated** in one bounded slice, prefer `COMPLETE` over deleting useful product direction.

If implementation or validation is larger than one bounded slice, preserve it in the deferred-feature register rather than allowing it to expand the launch scope silently.

## Private repository note

The reputation-system prototype is in the private repository `cjrutherford/retumbl`.

The operator confirmed `/home/cjrutherford/workspace/retumbl` as the current checkout (mapping HEAD `9f2c1cc76cad41208cdbe8104682d2bc0c196491`). RR-14 must record the actual reviewed SHA and working-tree state. GitHub connector access is not required.

## Canonical locations

- Product constraints: `docs/product/HAI-PUBLIC-GOOD-PHILOSOPHY.md`.
- Release contract and registry: `docs/release-readiness/MASTER-AUDIT.md`.
- Working order and closeout procedure: `docs/release-readiness/EXECUTION-PLAN.md`.
- Slice criteria: `docs/release-readiness/slices/RR-xx.md`.
- Detailed findings: `docs/release-readiness/findings/RR-xx.md`.
- Deferred capabilities: `docs/release-readiness/DEFERRED-FEATURES.md`.

Keep these locations stable. If a future relocation is necessary, update all consumers and preserve the audit history in the same change.

**2026-10-22 J25 Social snapshot/job integration:** [Local integration finding](./findings/DF-007-J25.md) records a real six-owner job invoking the leased Social participant and all 33 declared sources. The selected Profile parent was verified; the job remained incomplete with no artifact; failure stopped at the five-owner prefix, retry restored all owners, and range/lease/restart/logout checks passed. The runtime fixture verified 265 representative rows and restored table counts; J24's unchanged source-specific evidence supplies the positive 33-source coverage. Seven fresh application images plus the generic database setup image were used. The first combined production gate recorded and the repair gate cleared a Social type error. 35 distinct focused unit tests passed (9 Social, 26 Authentication); three DB-gated Authentication unit tests remained skipped. Authentication and Social production builds, Auth/Social/Constants/Models/Storage lint, Authentication E2E lint, and Social production build/lint after its recorded type repair passed. This is local capture/job integration evidence only. The real runtime captured 265 representative A/B/C/D records (Post 1, SearchHistory 261, Notification 1, CommunityMembershipAudit 1, GuardianContentAudit 1); it does not establish 33 positive source fixtures in J25. The unchanged J24 source-set proof remains the positive coverage evidence for all 33 sources. No schema, UI, download, deletion, remote-CI, or production-qualification claim is made. The job remains incomplete and DF-007/RR-11 remain open. See the [J25 receipt](./evidence/df-007/checkpoint-j25.json).

**2026-10-22 J26 Forum dispositions:** [Policy and schema coverage](./findings/DF-007-J26.md) resolves all six entities, 66 mapped columns, six relations, the Post–Link junction and three operational stores. Account/profile and profile-only actor domains, shared stewardship, private audit exclusions, nullable legacy scope and safe media-reference boundaries are explicit. Two focused tests and Forum production build/lint passed; one fresh PostgreSQL read-only case passed with zero skips after three existing migrations. All eight tables/71 columns and junction constraints matched, counts were unchanged and private resources were zero. This approves policy, not capture enforcement. J27 capture is next; DF-007/RR-11 remain open. See the [human policy](./FORUM-DISPOSITIONS.md) and [receipt](./evidence/df-007/checkpoint-j26.json).

**2026-10-22 J27 Forum owner capture:** [Six-source capture](./findings/DF-007-J27.md) enforces the J26 field policy with typed references and a reusable PostgreSQL/Profile driver. All three child slices passed: 25 focused tests, owning builds/lints, and one fresh PostgreSQL case with zero skips after three migrations. It captured 267 records, including 261 Posts across database/emitter pages, and verified the snapshot fence with a concurrent insert. Failure/privacy, restored eight-table counts, spool cleanup, private teardown and protected-file checks passed. Capability replies are controlled; actual RPC/jobs remain J28. See the [receipt](./evidence/df-007/checkpoint-j27.json). DF-007/RR-11 remain open.
