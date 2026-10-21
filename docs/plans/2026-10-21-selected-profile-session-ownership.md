# J18 — Check selected-profile ownership before minting sessions

The signing boundary must verify that an explicitly selected profile belongs to the credential-verified account. Gateway profile switching already checks account/app ownership, but password Login, internal Issue, EmailAuth and OAuth have direct signing paths. Use a shared asynchronous verifier across every explicit-profile mint path; reject before JWT creation and token-row insertion. Preserve existing profileless bootstrap/OAuth behavior and browser/bearer response contracts.

## Contract and boundaries

Add a narrow internal Profile `CheckAccountProfileOwnership` TCP command. Its typed request is `{accountId, profileId}`; its response echoes canonical UUIDs and an `owned` boolean. Validate UUIDs before querying, select at most the matching primary-key profile with a case-insensitive account-owner comparison for legacy varchar UUIDs, and return no profile fields. The lookup does not call Authentication or depend on an existing session token, so first login cannot recurse through Auth validation. This is a trusted-service account-attribution lookup, not a public HTTP authorization API.

Authentication must use its credential-verified account UUID, not browser/body profile-owner fields. Strictly validate the scoped RPC reply and bound network waits. A foreign, absent, malformed or unavailable selected profile cannot create a session. Missing selection keeps existing profileless semantics. Preserve existing Gateway app-scope/guardian checks; this account-ownership slice adds no guessed appScope-to-appId equality rule or alias changes. Ownership proof is at mint time; it does not establish continuous revalidation of every existing session after later profile mutation.

Root owns the shared contract, plan, runtime/evidence and audit documents. The Profile worker owns the Profile lookup/controller and focused tests. The Auth worker owns shared verifier/provider wiring, all direct signing callers and meaningful regressions. No nested delegation, root Compose/configuration/Directory edits, UI, schema or migration changes. Use the current checkout and exact path ownership.

## Verification

First prove narrow regressions fail, then run changed tests once. Check the Profile-contract build/lint, owning Profile and Authentication production builds/lints, and changed E2E lint before private runtime. Retain source and image identity, skips and cached checks.

Real Auth/Profile services must allow an owned secondary profile and deny foreign/missing/malformed selections without additional token rows. Password login must work before a session exists, and Profile lookup must not call Auth.Validate. Exercise Issue, current selection and profileless compatibility; test magic-link/OAuth signing paths through their existing local contracts without claiming external provider delivery. Run actual Gateway cookie/bearer switch compatibility where affected. Update the J17 fixture to use legitimate selected profiles once J18 stops minting the intentionally mismatched claims; its actor-binding regression must still pass. Independently read exact account/profile/token fixtures and remove only the private project.

Source/unit evidence is insufficient for acceptance. Record the finding/receipt, mark the explicit slice register and synchronize the master/execution/completion status only after the actual private checks. DF-007/RR-11, complete Social capture, downloads and deletion remain open.

## Local result — 2026-10-21

J18 is locally verified. The [finding](../release-readiness/findings/DF-007-J18.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j18.json) record 169 focused tests, production/shared gates, two passing private real-service cases, the corrected fixture-email failure, image provenance, zero readback/teardown and unrun external/deployment checks. J19 is next; DF-007 and RR-11 remain open.
