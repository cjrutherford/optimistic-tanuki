# Deferred Feature Register

This is the working register for strategically valid features that are too expensive, broad, risky, or validation-heavy to complete inside the current release program.

Deferral is not rejection.

| ID     | Product               | Feature                                                                       | Current state                                                                                                                                                                                                                                                                                                                      | Implementation          | Validation | Marketing                      | Revisit trigger                                                                                                                                                                                                                                                                                  |
| ------ | --------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DF-001 | TS/OT                 | Reputation-driven moderation / automated trust                                | RR-14 static review found durable per-instance actor/domain moderation-risk and signed trust-evidence mechanisms; no feature acceptance. README says no license chosen/all rights reserved; this audit does not authorize direct source transfer. Placement, user appeal, retention, and adversarial resistance remain unresolved. | M/L after product scope | XL         | DEFER                          | Resolve OT/TS placement; define a transparent local policy with appeal/privacy boundaries, then map a bounded implementation and adversarial validation slice. Resolve rights/ownership separately before any direct source transfer.                                                            |
| DF-002 | TS                    | Payments, donations, featured classifieds, business tiers/analytics           | Payment service/components exist; financial lifecycle unaccepted. RR-01 removes donation/business-tier/featured/analytics promotion.                                                                                                                                                                                               | XL                      | XL         | RETRACT/DEFER                  | Core local/community/classified usage validated and monetization ADR approved                                                                                                                                                                                                                    |
| DF-003 | OT/TS                 | Self-hosting and federation                                                   | RR-15 read-only feasibility audit complete; GAP FOUND; no protocol, privacy boundary, identity model, deployment profile or runtime interoperability accepted. See [RR-15 findings](./findings/RR-15.md).                                                                                                                          | XL; decision work first | XL         | DEFER; unadvertised            | After a separately approved ADR resolves identity/IDs, explicit-public consent, remote privacy/deletion, communities/forums, trust and operator burden, scope a bounded public-only MVP with migration and two-instance evidence. Private/follower federation and DMs remain separate decisions. |
| DF-004 | OT                    | Per-community forums                                                          | Product intent exists; implementation status to verify                                                                                                                                                                                                                                                                             | M/L                     | L          | DEFER                          | RR-05 accepts main forum/community permission model                                                                                                                                                                                                                                              |
| DF-005 | TS                    | Daylight expansion beyond initial localities                                  | Initial integration in progress                                                                                                                                                                                                                                                                                                    | L                       | XL         | DEFER expansion                | RR-07 proves reliability and source-maintenance cost                                                                                                                                                                                                                                             |
| DF-006 | Forge/project         | Acknowledged chat submission and rejected-draft recovery for legacy consumers | Shared callers intentionally remain on the compatible fire-and-forget path; source review confirms eager composer clearing is not covered by RR10-I04's OT/TS opt-in repair. No runtime acceptance is claimed.                                                                                                                     | M                       | L          | No new claim                   | Complete RR10-I04-V01 live double-submit verification and the required RR-10 acceptance gates, then map a bounded Forge/project consumer slice before making cross-product recovery claims.                                                                                                      |
| DF-007 | OT/TS shared platform | Full account data deletion and export across services                         | No account-delete or export workflow found; profiles, credentials, tokens, keys, OAuth providers, and product records span multiple services. Owner requires account deletion and JSON export including portable image/video before availability claims.                                                                           | XL                      | XL         | MANDATORY RELEASE PREREQUISITE | Build a cross-service data map, then implement and validate deletion and portable JSON export across both products, including provider/backup behavior and safe readback. No retained-data exceptions are authorized. No availability claim before acceptance.                                   |

## Required analysis per deferred item

### DF-001 — RR-14 checkpoint (2026-10-13)

The reviewed prototype is a local federation-ingress and moderation-risk mechanism, not global user reputation. Its durable service, report cases, signed expiring/revocable attestations, local vouches, operator controls, decay, and audit surfaces reduce design uncertainty but do not establish safe reuse. No code or private operational configuration was copied. No source tests/build/runtime were run. Direct source transfer would require resolving rights/ownership; independently implementing selected concepts is assessed separately. Implementation remains M/L and validation XL. Marketing remains DEFER. The next step is an owner/product decision plus a bounded threat/appeal/privacy design, not implementation. See [RR-14 findings](./findings/RR-14.md).

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

RR-15's 2026-10-13 read-only audit found no federation protocol implementation in the committed tracked `apps/` and `libs/` baseline and left foundational identity, privacy, governance, operations and threat-model choices unresolved. No ADR or protocol is approved. Implementation remains XL; first resolve the bounded decision work in [RR-15 findings](./findings/RR-15.md), then size a public-only MVP and two-instance validation. Keep private/follower-scoped content and DMs out of that candidate unless separately approved. RR-14 informs only the local-versus-portable trust boundary and does not provide global identity or authorize source transfer. RR-01's “Yours Forever” withdrawal remains in force; federation/self-hosting/portability remain unadvertised until their owning acceptance evidence exists.

### DF-004 — Community forums

RR-01 names the main forum only. Per-community forums remain deferred until RR-05 accepts forum/community authorization and a separate community-scoped design is bounded. Implementation M/L; validation L across access, durable URLs, search/notifications, and moderation. Risks are cross-community disclosure and ambiguous authority. RR-15 should inform global IDs/privacy before schema expansion.

### DF-005 — Daylight expansion

No released Daylight claim is added to either landing page. Expansion remains L implementation / XL validation pending RR-07's source provenance, freshness, failures, and initial-locality maintenance evidence. Additional source diversity, timezone/OCR issues, and source upkeep justify keeping expansion separate. Revisit after the initial set is accepted and operational cost is known.

Review baseline: `e16279992` plus the RR-01 source diff; local prototype mapping SHA remains recorded in `RETUMBL-DEPENDENCY.md`, not reviewed anew here. The detailed master register supplies the earlier feature value/deferral history.

### DF-007 — Full account data deletion and export across services

RR-11 source review found no user-facing account deletion or export workflow. A profile is not the account: account credentials, sessions/tokens, key data, OAuth providers, and email-action tokens live in authentication, while profile-owned content and relationships span permissions, social/community/forum, assets, chat, and classifieds. The owner requires deletion of account-attached data and associated content plus JSON export including associated image/video in a portable encoding before either capability is claimed. This XL cross-service work is a mandatory release prerequisite, not an indefinitely deferred product direction. No retained-data exceptions are authorized. The owner selected shared-content handling: remove the deleted account's own posts/comments/reactions/media, preserve other people's content, and leave a deleted/account-deleted placeholder in affected conversations. Deletion of other people's content is not authorized. Implementation must inventory all services, authorize account-level actions, handle providers/backups, and prove idempotence, completeness/readback and privacy/data integrity. Until accepted, marketing disposition remains RETRACT/UNAVAILABLE; do not imply a working process or use the contact inbox as a deletion route.

Review baseline: `169a37ce2` (RR-11 source audit, 2026-10-13).
