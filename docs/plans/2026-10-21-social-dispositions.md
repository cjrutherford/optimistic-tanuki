# J23 — Social field and store dispositions

J23 follows J22 at `56201c4f23c6fb705fb8cdcb441ed373b3a48f61`. It approves the selection and field rules that J24 captures must enforce. It does not implement those captures or promote the existing partial preview to complete.

## Policy contract

Account and profile UUIDs are distinct identity domains. Where both are recorded, require the account and its currently owned profile together. Profile-only actions select currently owned profiles; Presence and ProfileView use account identities. Shared community, business and audit rows are not wholly owned because a person administers or participates in them. Preserve only the subject's own contribution or a narrow participation/action receipt, with opaque context references.

Every mapped column and relation must appear exactly once in the checked-in inventory, with its classification, explicit handling action, reason and real source evidence. Classifications are owned, shared, opaque or nonpersonal. Actions are include-owned, opaque-reference, template, exclude or typed-projection. A typed projection permits no raw JSON/row passthrough.

Legacy attribution is unverified across the inventory. A present account/profile match establishes current selection authority, not historical authorship or consent. Never infer consent, media ownership, or current grant authority from an association or audit row. Exclude raw storage paths, invitation credentials, counterpart private text, unreviewed JSON, saved counterpart title snapshots and private moderation/guardian payloads. Notification previews use J21's template projection.

Declare the Post/Link junction, migration bookkeeping, volatile notification debounce state, mixed process logs and operator configuration inputs. Logs/configuration are exclusions, not a claim to have qualified external log persistence or retention.

## Verification

Use real production TypeORM metadata for all 33 entities, 314 mapped columns and 27 relations, plus the junction. The pure validator rejects omission, duplication, new fields/relations/stores, invalid handling/evidence and unsupported legacy certainty. A fresh PostgreSQL 15 fixture applies 27 migrations, then compares all public table/column names against the inventory through a read-only connection. Include negative physical-catalog drift checks, unchanged table counts and zero private resources. Run focused tests and Social production build/lint before runtime.

Flat Luna work supplies the initial inventory/validator/tests; root reviews producer identity semantics, corrects policy, validates the actual catalog, records evidence and commits. Preserve the 43 excluded paths, current checkout and no nested delegation. J24-A/B/C/D capture remains next; downloads, deletion, external flows and release qualification are separate work.

## Local result

Policy/schema coverage is locally verified: eight focused tests, Social production build/lint and one fresh read-only PostgreSQL catalog case passed. All 35 tables/319 columns were accounted for; table counts were unchanged and private resources were zero. See the [finding](../release-readiness/findings/DF-007-J23.md), [human policy](../release-readiness/SOCIAL-DISPOSITIONS.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j23.json). Capture enforcement remains J24.
