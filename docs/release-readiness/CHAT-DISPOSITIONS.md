# Chat ownership and release boundary (O04)

O04 supports Messages in both release applications. Optimistic Tanuki's `apps/client-interface/src/app/components/messages.component.ts` uses its ChatService and shared chat UI. Towne Square's `apps/local-hub/src/app/pages/messages/messages.component.ts` and New Message page use the same shared chat transport. Their HTTP and socket paths terminate in Gateway's ChatController/ChatGateway, `ChatCommands`, and Chat Collector's Conversation and Message tables. This is a concrete release dependency; a generic Gateway registration or HAI navigation link alone would not establish one.

O03 Blogging remains unstarted: no primary Blogging workflow was established in these two clients. Its existing inventory entry is retained without declaring it a release blocker. O04 reuses its existing P/C/I gates; no delivery ID or replacement finish list is introduced.

## Shared-account contract

Conversation and Message have no stored app-scope field. The capture therefore follows the existing shared-account contract across captured current Profile identities. It cannot claim an OT-only or Towne-Square-only partition based on a request header. This qualifies one shared backend used by both apps and does not expand the release to other products.

Current Profile ownership is a selection proof, not historical authorship, consent or current conversation access. Each exported record retains `attribution: recorded-unverified` and `consent: not-inferred`.

| Source       | Selection                                                                                                            | Safe representation                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation | A captured profile is a recorded participant or recorded owner, or has a sent message in the conversation.           | ID, known type, deletion flag, timestamps and booleans for recorded participation, stewardship and sent contributions.                                                                  |
| Message      | Its sender is a captured profile; its parent conversation must exist. Recipient membership does not select messages. | ID, sender profile ID, opaque conversation reference, known type and timestamps. Chat content is bounded inert text. Other message types receive an explicit content-exclusion receipt. |

Conversation owner IDs are profile-domain IDs in the current Gateway community and project producers. An account UUID in that field without any captured-profile or sent-message evidence is ambiguous and blocks capture. It is never reinterpreted as a profile UUID or treated as an empty successful selection.

Conversation titles, participant arrays, raw owner IDs and community/project references are excluded. They can contain counterpart identities or shared context. Minimal receipts preserve the subject's connection to a shared conversation without copying its contents or claiming exclusive ownership. A sent-message receipt can retain context after recorded membership loss; it grants no live chat access.

Message recipients and received-only messages are excluded. Only `chat` content is selected as inert text; raw info/warning/system payloads are not read into the export because those fields can carry generated or counterpart context. Selected chat text is capped at 65,536 Unicode characters, with over-limit or malformed data failing capture rather than being silently truncated. Referenced assets are not fetched or represented as subject-owned bytes.

## Stores and lifecycle limits

The inventory must reconcile both entities, their relations, the physical message conversation foreign key and migration bookkeeping. Migration records and configuration credentials are excluded. Chat's existing process logs can contain message text and profile IDs; their external sinks and deletion/retention remain explicit N04 work, not accepted by this database capture. Gateway's connected-client registry is volatile socket state; N02 owns its lifecycle boundary. No chat-specific Redis store is asserted without a concrete producer/consumer path.

The existing message-to-conversation foreign key cascades on conversation deletion. O04 is read-only and does not authorize using that cascade for account erasure. The later deletion adapter must preserve counterpart messages and prove its own recovery/readback behavior.

Full O04 acceptance requires real migrated source reads, bounded multi-page capture, the leased Profile-bound transport and job integration, denial/retry/restart/revocation cases, and independent cleanup. Policy or unit tests alone do not complete O04. Global export stays incomplete, with no artifact or deletion claim.

## D11 local erasure qualification

Sent messages are removed; counterpart message content remains. Matched recipient/participant and steward IDs use the inert nil placeholder; direct/owned titles are cleared. The permanent operational fence is excluded from captured user content. See [the owner finding](./findings/DF-007-D11.md) for real database/TCP evidence and its limits. Full-account coordination remains later work.
