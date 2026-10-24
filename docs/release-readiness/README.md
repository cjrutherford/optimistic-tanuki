# HAI OT + Towne Square Release-Readiness Package

**Active release scope:** Optimistic Tanuki = `client-interface`; Towne Square = `local-hub`. **N05–N07 are locally verified; N04 remains active pending shared-audit erasure policy** ([N04 progress](./findings/DF-007-N04.md), [N05](./findings/DF-007-N05.md), [N06](./findings/DF-007-N06.md), [N07](./findings/DF-007-N07.md)). N01, N02 and O09-P/C/I remain accepted. Only services/data needed by these two applications enter the remaining release work. The historical platform inventory is reference material, not a count of required release slices.

**Scope clarification (2026-10-23):** The authoritative audit scope is `client-interface` (Optimistic Tanuki), `local-hub` (Towne Square), their required shared services and shared HAI navigation. Historical platform records retain their IDs and accepted evidence as reference. Another product does not become release work through queue position or shared infrastructure alone.

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

Current account-rights checkpoint: [O02 App Configurator delivery](./findings/DF-007-O02.md) is locally verified. Progress: 2/75 deliveries complete; 73 remain. Next: O03 Blogging in the [fixed sequence](../plans/2026-10-19-release-finish-sequence.md).

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

**2026-10-22 J28 Forum integration:** [Seventh-owner integration](./findings/DF-007-J28.md). Forum now participates in the real seven-owner leased export job. One private TCP case passed with zero skips, covering all six Forum sources/seven representative rows, exact Profile-parent/session/lease checks, failure-prefix/retry, multibyte checksum, restart and logout denial. Independent seven-database counts were restored, spool descriptors and private resources were zero, and 43 protected paths were unchanged. The job remains incomplete with no artifact. O01-P (Workspace policy) is next; the seventeen other owners, non-ORM stores, artifacts/downloads, deletion, shared controls and claims remain open. DF-007/RR-11 remain open. See the [receipt](./evidence/df-007/checkpoint-j28.json).

**2026-10-23 O01 Workspace delivery:** [Policy, capture and integration](./findings/DF-007-O01.md) are locally verified. One real eight-service case captured 252 owned rows across two profiles/scopes, excluded foreign/mismatched bindings, and proved parent/session/lease denial, integrity, failure-prefix/retry, restart/logout and independent cleanup. Global jobs remain incomplete with no artifact. **1/75 local deliveries complete; 74 remain. Next: O02 App Configurator.** [Receipt](./evidence/df-007/checkpoint-o01.json).

**2026-10-23 O02 App Configurator delivery:** [Policy, capture and integration](./findings/DF-007-O02.md) are locally verified. One private nine-service case captured 757 receipts across all three sources, excluded counterpart/configuration secrets, and proved parent/session/lease checks, failure-prefix/retry, integrity, restart/logout and independent cleanup. Migrated physical catalog parity passed read-only. Global jobs remain incomplete with no artifact. **2/75 local deliveries complete; 73 remain. Next planned ID: O03 Blogging, pending OT/TS scope reconciliation.** [Receipt](./evidence/df-007/checkpoint-o02.json).

**2026-10-23 O04 messaging delivery:** [Policy, capture and integration](./findings/DF-007-O04.md) are locally verified for the shared Messages backend used by `client-interface` and `local-hub`. Private catalog and ten-service cases passed without skips, capturing 255 minimal conversation receipts and 254 sent-message receipts; counterpart content, failure/retry, grant/lease/restart/logout boundaries and independent cleanup were verified. Global export remains incomplete with no artifact. **3/75 inventory deliveries accepted; 72 open, subject to OT/TS scope reconciliation.** O03 remains unstarted; another owner requires a release-app/shared-account dependency trace. [Receipt](./evidence/df-007/checkpoint-o04.json).

**2026-10-23 O09-P/C/I:** locally verified for OT/TS only. Real catalog and job cases passed without skips; 253 listing receipts proved account/profile binding, explicit two-app filtering, other-product/counterpart preservation, integrity, failure/retry/restart/revocation and independent cleanup. See [finding](./findings/DF-007-O09.md) and [receipt](./evidence/df-007/checkpoint-o09.json). Overall export remains incomplete with no artifact.

**2026-10-23 N01:** locally verified for OT/TS only. Nine work/store families are inventoried. One private runtime case passed with zero skips, proving upload compensation/crash recovery, notification drain, export cancellation/stale-completion denial and notice suppression. Independent four-database counts matched; encrypted files, temporary tables and private resources were zero. 118 focused tests and 41 CI contract checks passed. Per-item cancellation does not complete D00 account-wide fencing/deletion or U01 controls. See [finding](./findings/DF-007-N01.md) and [receipt](./evidence/df-007/checkpoint-n01.json). **Next: N02.**

**2026-10-23 N02:** locally verified for OT/TS only. Authorization reloads current Permissions state; OAuth callback grants store session references rather than bearer tokens. One private two-process HTTP case passed seven stages with zero skips, including replica revocation, cookie/bearer logout, OAuth replay/expiry/revocation, changed-profile ownership and account invalidation. Independent three-database counts matched; Redis, temporary tables and private resources were zero. See [finding](./findings/DF-007-N02.md) and [receipt](./evidence/df-007/checkpoint-n02.json). D00 permanent fencing/deletion and N06 browser cleanup remain open. **Next: N03.**

**2026-10-23 N03:** locally verified for OT/TS only. Eleven fresh catalogs reconciled 87 tables, 781 columns and 161 native indexes, including explicit migration-only Profile structures. One private case passed without skips, proving scoped history cleanup, counterpart/excluded-scope preservation, query/write races, SQL failure/retry, index reads and restart. Independent counts/schema shape were restored; private resources were zero. Community discovery now excludes private communities. See [finding](./findings/DF-007-N03.md) and [receipt](./evidence/df-007/checkpoint-n03.json). D00 permanent fencing/deletion and N06 browser cleanup remain open. **Next: N04.**
