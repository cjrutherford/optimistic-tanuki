# Deferred Feature Register

This is the working register for strategically valid features that are too expensive, broad, risky, or validation-heavy to complete inside the current release program.

Deferral is not rejection.

| ID     | Product | Feature                                                             | Current state                                                                                 | Implementation     | Validation | Marketing            | Revisit trigger                                                               |
| ------ | ------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------ | ---------- | -------------------- | ----------------------------------------------------------------------------- |
| DF-001 | TS/OT   | Reputation-driven moderation / automated trust                      | Related prototype exists in private `cjrutherford/retumbl`; untested and pending RR-14 review | M/L pending review | XL         | DEFER                | Review local `retumbl` clone, complete RR-14, then re-estimate                |
| DF-002 | TS      | Payments, donations, featured classifieds, business tiers/analytics | Ahead of accepted production behavior                                                         | XL                 | XL         | RETRACT/DEFER        | Core local/community/classified usage validated and monetization ADR approved |
| DF-003 | OT/TS   | Self-hosting and federation                                         | Active feasibility under RR-15                                                                | XL likely          | XL         | DEFER implementation | RR-15 produces protocol/identity/privacy ADR and bounded MVP                  |
| DF-004 | OT      | Per-community forums                                                | Product intent exists; implementation status to verify                                        | M/L                | L          | DEFER                | RR-05 accepts main forum/community permission model                           |
| DF-005 | TS      | Daylight expansion beyond initial localities                        | Initial integration in progress                                                               | L                  | XL         | DEFER expansion      | RR-07 proves reliability and source-maintenance cost                          |

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
