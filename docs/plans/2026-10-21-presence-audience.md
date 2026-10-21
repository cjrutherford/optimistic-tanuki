# J20 — Conversation-scoped Presence

J17 bound Presence writes to the authenticated account. J20 closes authenticated global discovery and repairs the profile/account mismatch in Messages without adding a new UI component. The HAI privacy philosophy requires an explicit audience; a signed-in session alone is not permission to discover another person's activity.

## Audience and projection

Unscoped single, batch and online reads expose only the authenticated account. Foreign account IDs fail before Social; empty batches return no rows without querying. Every submitted batch is capped at 100 entries before canonicalization/deduplication.

Add an explicit conversation read for peer status. Its inputs are a conversation UUID and up to 100 participant profile UUIDs. Verify that the selected profile currently belongs to the authenticated account through J18's Profile lookup. Ask Chat for a narrow, non-history audience proof: the actor and every requested profile must belong to that current conversation. Reuse current community/project membership rules rather than trusting stale stored participant lists. Unknown, removed or unrelated members fail closed. No follower, public-profile or guessed app-scope audience is introduced.

Resolve the allowed profiles to account IDs through a bounded internal Profile lookup selecting only profile/account IDs. Social filters current blocks in both directions, reads only the corresponding account-keyed Presence statuses, and returns `{profileId, status}`. Peer responses contain no account IDs, last-seen timestamps, row IDs or other activity metadata. Presence remains account-wide internally; this slice does not invent per-profile activity records or consent for named activity histories. Mutes do not define Presence permission.

All RPC proofs must match their requested scope and satisfy bounds. Malformed replies and unavailable dependencies fail closed; they must not fall back to global reads. Detect ambiguous case-variant Presence rows rather than selecting an arbitrary account state. Internal TCP remains a trusted-service boundary. No schema or migration is needed.

## Compatibility

Messages currently sends conversation participant profile IDs to an account-keyed batch endpoint, then joins those mismatched IDs. Use the new conversation read, batch within each authorized conversation, and join statuses by profile ID. Presence failure must not prevent loading conversations/messages. Reuse the existing component and service. Existing writes retain J17's account binding. Update the J17 fixture's deliberately unrestricted read expectations to the new self-only contract; keep its write/spoof/revocation proof.

The shared socket client emits Presence events but Gateway implements no corresponding server handlers. J20 adds no unverified socket feature or broadcast. Record that limit rather than claiming realtime Presence acceptance.

## Delivery and evidence

Two flat Luna workers own Gateway/client and backend/contracts respectively. Root owns the plan, E2E/runtime, integration review and findings. Preserve the 43 excluded Directory/root configuration paths in the current checkout.

Run meaningful focused tests and the changed service/client production builds and lints before E2E. Then use real private Auth, Profile, Social and Chat services with a production-controller/AuthGuard HTTP harness. Prove allowed participant status with distinct account/profile IDs, self-only/global denial, unrelated/deleted/stale membership denial, bilateral blocks, bounded and empty batches, exact peer projection, body spoof/revocation compatibility and counterpart preservation. Community/project dynamic membership may use focused unit evidence where private dependency services are not exercised; label it explicitly. Record cleanup readbacks, image/source provenance, failed attempts and zero private resources.

Synchronize the finding/receipt, master audit, execution/completion maps, register and index before committing the slice. J21 Notifications follows after this checkpoint. DF-007 and RR-11 remain open.

## Local result

Locally verified: 177 focused tests, owning production builds/lints, E2E lint and two private Auth/Profile/Social/Chat cases passed. Ten independent cleanup readbacks and private resources were zero. Current community/project membership has unit evidence only. See the [finding](../release-readiness/findings/DF-007-J20.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j20.json) for provenance and limits. J21 follows; DF-007/RR-11 remain open.
