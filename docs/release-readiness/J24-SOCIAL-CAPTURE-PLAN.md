# J24: Social owner captures

J24 implements the field rules accepted in [J23](./SOCIAL-DISPOSITIONS.md). Acceptance proceeds in this order: J24-A authored contributions, J24-B personal state, J24-C community participation, J24-D business and safety. The [remaining-slices register](./REMAINING-SLICES.md) defines the source sets.

Each set uses one bounded source component and the same capture driver. Separate child slices are unnecessary while the approved exclusions remain in force. Adding component JSON, poll vote history, asset bytes, shared community content or business configuration requires a separately named slice and policy review.

The driver validates the capture lease, consumes identities from the exact captured Profile descriptor, and queries Social under a repeatable-read, read-only transaction. Source queries use explicit columns, deterministic keyset paging and bounded values. Source errors, malformed records, lost leases, deadlines and consumer failures must prevent terminal success. Temporary database state and connections must be cleaned before terminal completion. The shared emitter and spool verify counts and checksums.

Stored account IDs and profile IDs remain distinct. Account/profile pairs must satisfy the declared conjunction. Subject-side invitations, membership history and guardian history include only identities that match the selected branch. Legacy records carry unverified-attribution and no-inferred-consent labels. Opaque references never authorize access or fetch counterpart content.

Media binding proof covers the stored association to a selected owned Post. Recognized asset UUIDs remain opaque references; this does not establish asset ownership, current audience permission or consent. Attachment storage paths, arbitrary cover-image URLs, raw component data, poll vote arrays and event attendees remain excluded under J23. Asset bytes and verified portable media assembly belong to their owning captures and A02.

For each set, run focused contract tests and the Social production build/lint before private PostgreSQL acceptance. Use checked-in migrations on a fresh private database, inspect actual projected rows and negative cases, compare independent table counts after cleanup, and remove only the fixture's resources. Capability replies may be controlled in this owner-level fixture; that does not prove Auth/Profile RPC or job integration.

J25 connects the completed source sets to shared leased snapshots and jobs. J24 does not expose a new public endpoint, promote the existing partial preview, enable downloads or claim deletion support.

Completed locally: see the [J24 findings](./findings/DF-007-J24.md) and [receipt](./evidence/df-007/checkpoint-j24.json). All four sets passed their owner-level acceptance; J25 remains unaccepted.
