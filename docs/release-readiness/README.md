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
