# Deferred Feature Register

This is the working register for strategically valid features that are too expensive, broad, risky, or validation-heavy to complete inside the current release program.

Deferral is not rejection.

| ID     | Product       | Feature                                                                       | Current state                                                                                                                                                                                                  | Implementation     | Validation | Marketing            | Revisit trigger                                                                                                                                                                             |
| ------ | ------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DF-001 | TS/OT         | Reputation-driven moderation / automated trust                                | Local `/home/cjrutherford/workspace/retumbl` confirmed; review pending RR-14; no reputation acceptance                                                                                                         | M/L pending review | XL         | DEFER                | Review local `retumbl` clone, complete RR-14, then re-estimate                                                                                                                              |
| DF-002 | TS            | Payments, donations, featured classifieds, business tiers/analytics           | Payment service/components exist; financial lifecycle unaccepted. RR-01 removes donation/business-tier/featured/analytics promotion.                                                                           | XL                 | XL         | RETRACT/DEFER        | Core local/community/classified usage validated and monetization ADR approved                                                                                                               |
| DF-003 | OT/TS         | Self-hosting and federation                                                   | Active feasibility under RR-15                                                                                                                                                                                 | XL likely          | XL         | DEFER implementation | RR-15 produces protocol/identity/privacy ADR and bounded MVP                                                                                                                                |
| DF-004 | OT            | Per-community forums                                                          | Product intent exists; implementation status to verify                                                                                                                                                         | M/L                | L          | DEFER                | RR-05 accepts main forum/community permission model                                                                                                                                         |
| DF-005 | TS            | Daylight expansion beyond initial localities                                  | Initial integration in progress                                                                                                                                                                                | L                  | XL         | DEFER expansion      | RR-07 proves reliability and source-maintenance cost                                                                                                                                        |
| DF-006 | Forge/project | Acknowledged chat submission and rejected-draft recovery for legacy consumers | Shared callers intentionally remain on the compatible fire-and-forget path; source review confirms eager composer clearing is not covered by RR10-I04's OT/TS opt-in repair. No runtime acceptance is claimed. | M                  | L          | No new claim         | Complete RR10-I04-V01 live double-submit verification and the required RR-10 acceptance gates, then map a bounded Forge/project consumer slice before making cross-product recovery claims. |

## Required analysis per deferred item

Record:

- why the feature matters;
- current implementation state;
- reason for deferral;
- implementation estimate;
- validation estimate;
- dependencies;
- risk profile;
- public-marketing disposition;
- revisit trigger;
- related slices/PRs/ADRs;
- last-reviewed date and commit(s).

## Effort scale

- `S`: comfortably one bounded slice.
- `M`: one substantial slice or two small slices.
- `L`: multiple slices and/or meaningful cross-service work.
- `XL`: program-level work, major architecture, payments, federation, reputation systems, or similar operational scope.

## Important rule

Validation cost is independent of implementation cost.

A feature that is quick to code but expensive to prove safe, private, reliable, or abuse-resistant remains deferred until the validation burden is acceptably bounded.

## RR-01 review notes — 2026-10-05

The withdrawal of public claims preserves every deferred feature. This review evaluates marketing exposure and source evidence; it does not accept prototype, financial, or federation behavior.

### DF-001 — Reputation and automated trust

Community safety remains valuable, but RR-01 removes TS's broad reputation/moderation guarantee. The confirmed local prototype is reviewable; no decision about reusable reputation logic is made here. Implementation remains M/L pending RR-14, and validation XL because contextual scoring, brigading/Sybil/collusion/retaliation, human override, appeals, privacy, auditability, and automated enforcement require separate evidence. Dependencies: RR-08 minimum safety boundaries and RR-14 architecture/threat review. Revisit after the reuse matrix and placement ADR; no released reputation claim before adversarial acceptance.

### DF-002 — Financial and paid business features

Local sustainability/business utility remains valid product direction. `apps/local-hub/src/app/services/payment.service.ts` and donation/business UI source exist; that reduces uncertainty about source presence, but does not prove checkout, recurring donations, refunds, disputes, payouts, entitlements, featured placement, or analytics are production-ready. RR-01 removes funding widgets/default targets, the business demo, tier copy, and CTAs implying these capabilities are released.

Implementation and validation remain XL until a monetization ADR bounds the intended subset. Remaining work spans provider/webhook correctness, financial state transitions, identity/authorization, entitlement enforcement, disputes/refunds, and operational/support processes. Dependencies: accepted RR-03 identity, RR-06 core usage, RR-08 authorization, and a specified business model. Risks include incorrect money movement, inconsistent entitlements, false safety claims, fraud, and misleading pricing. Revisit with the ADR and a bounded capability/validation plan; marketing disposition remains RETRACT/DEFER. Existing endpoints elsewhere are not removed or accepted by this slice.

### DF-003 — Federation, self-hosting, and portability

RR-01 removes OT's “Yours Forever” language rather than implying permanent hosting or implemented portability. Implementation and validation remain XL pending RR-15 because identities, durable IDs, deletion, privacy, migration, media, instance trust, and operations need explicit decisions. RR-14 is an input. Revisit implementation only after the federation/privacy/identity ADR and bounded MVP; current marketing is deferred.

### DF-004 — Community forums

RR-01 names the main forum only. Per-community forums remain deferred until RR-05 accepts forum/community authorization and a separate community-scoped design is bounded. Implementation M/L; validation L across access, durable URLs, search/notifications, and moderation. Risks are cross-community disclosure and ambiguous authority. RR-15 should inform global IDs/privacy before schema expansion.

### DF-005 — Daylight expansion

No released Daylight claim is added to either landing page. Expansion remains L implementation / XL validation pending RR-07's source provenance, freshness, failures, and initial-locality maintenance evidence. Additional source diversity, timezone/OCR issues, and source upkeep justify keeping expansion separate. Revisit after the initial set is accepted and operational cost is known.

Review baseline: `e16279992` plus the RR-01 source diff; local prototype mapping SHA remains recorded in `RETUMBL-DEPENDENCY.md`, not reviewed anew here. The detailed master register supplies the earlier feature value/deferral history.
