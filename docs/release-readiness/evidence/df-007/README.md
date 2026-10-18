# DF-007 evidence

[Checkpoint A findings](../../findings/DF-007-A.md) describe the locally verified internal export preview and its limits. The [sanitized receipt](checkpoint-a.json) records commands, source hashes, image identities, results and private-log hashes. The final private Authentication/Profile run passed 20/20 tests and removed its generated fixtures and private stack.

[Checkpoint B1 findings](../../findings/DF-007-B1.md) and its [receipt](checkpoint-b1.json) add locally verified age eligibility, owned provider-link metadata and profile roles. The CI-aligned gates, static rereview and 20/20 private TCP tests passed, followed by fixture readback and private-stack teardown. [B2 findings](../../findings/DF-007-B2.md) and its [receipt](checkpoint-b2.json) now verify those linked guardian and own notice/action/activity projections. B2 passed CI-aligned gates, independent GO and 20/20 private TCP tests, direct fixture readback and private-stack teardown. Continue at B3 for Permissions and bounded profile-ID lookup.

The [ownership catalog](ownership-catalog.json) covers 165 tracked entity files and 24 candidate owners at base `6fc407676`. It is source evidence, not an accepted cross-store ownership inventory. Its [readable report](../../findings/DF-007-OWNERSHIP.md) explains unresolved joins and stores.

DF-007 remains a mandatory release prerequisite. There is no complete public export or account-deletion workflow yet. Provider/backup, portable media, all participants, durable orchestration, readback and final UI acceptance remain open. The evidence contains no raw user records, bearer tokens or private keys.
