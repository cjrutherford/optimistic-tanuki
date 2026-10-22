# Forum account-rights dispositions

J26 defines policy and schema coverage. It does not implement J27 capture or J28 snapshot/job integration. The existing Forum preview remains partial and unfenced. DF-007 and RR-11 remain open.

The [machine inventory](../../apps/forum/src/app/forum-account-export-dispositions.json) assigns every mapped field and relation an action, selector, reason and source reference. Its validator checks coverage and the critical identity/private-field rules; passing it does not prove that a capture reader enforces the policy.

## Selection and attribution

Topic, Thread and ForumPost require **both** the authenticated account's `userId` and a `profileId` in the captured current Profile identity set. UUID comparisons must be canonical. Gateway producers supply these two identities; the existing preview already uses their conjunction. Neither field alone establishes ownership.

This is an account-wide inventory across recorded application scopes. Preserve each row's `appScope`; the capture grant's `appId` authenticates the operation and must not silently filter out other owned scopes. App scope is context, not identity proof. A Link must have the same nonempty scope as its selected Post. Do not guess the scope of legacy Reports with a null value: retain it as explicitly unknown in the subject-side receipt.

Every selected historical contribution retains `recorded-unverified` attribution. Current ownership does not prove historical authorship, sole authorship, consent, current visibility outside the account export, or present moderator authority. Synthetic seed identities and topic titles do not establish a real person's ownership.

## Source policy

| Source                | Selection and retained contribution                                                                                                                                                                                        | Exclusions and boundaries                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topic                 | Account/profile conjunction. A stewardship receipt with identifiers, recorded scope, visibility, timestamps, and bounded inert title/description text as the selected container definition.                                | No claim of exclusive ownership or sole authorship of that shared definition. Exclude pin/lock governance flags and all nested Threads.                                          |
| Thread                | Account/profile conjunction. Own recorded title, description, content, identity/scope, visibility and timestamps. Retain `topicId` opaquely.                                                                               | Exclude pin/lock state, view counts and all moderation columns. Do not fetch the parent Topic or child Posts through this row.                                                   |
| ForumPost             | Account/profile conjunction. Own recorded content, envelope, timestamps and edit flag. Retain `threadId` opaquely.                                                                                                         | An own Post on a foreign Thread remains eligible. Exclude all moderation columns and do not fetch parent content.                                                                |
| ForumLink             | No independent owner. Select only persisted associations under selected own Posts with matching recorded scope. Retain a bounded safe URL/reference, Link ID, selected Post ID, scope and timestamp.                       | Exclude copied title/description metadata and unselected Posts. Association proves neither Link authorship nor ownership of the destination.                                     |
| ForumReport           | `reporterId` is a **profile UUID** in captured owned Profile identities. Retain a narrow reporter receipt: ID, reporter profile, content type, reason, status, timestamp, recorded or unknown scope, and opaque target ID. | Exclude free-text description and private administrator notes. Do not fetch reported content or select another reporter's row merely because its target belongs to the account.  |
| ForumModerationAction | `actorProfileId` is a **profile UUID** in captured owned Profile identities. Retain a narrow actor-action receipt with ID, scope, action, subject type, timestamp and opaque subject ID.                                   | Exclude raw `details` JSON and every unreviewed nested value. Being moderated does not grant access to private audit records. Recorded action is not proof of current authority. |

These receipt policies resolve the mixed report/audit rows without excluding a person's own action altogether. They follow the subject-side boundary already used for Social reports and moderation actions. Future implementations must allowlist the actual producer enums and validate bounded fields; they may not serialize the underlying rows.

## Associations, content and media

The initial Forum migration defines `forum_post_links_forum_link`, its composite key and its two foreign keys. Capture only associations reachable through independently selected Posts. Never export standalone Links or traverse inverse associations into counterpart Posts. J26 verifies metadata/catalog structure; J27 must prove actual selected-row relation queries and paging.

Text is inert export data, never renderable HTML. J27 must implement a reviewed resource-reference projection: recognize `/asset/:uuid` and `/api/asset/:uuid` as canonical opaque asset IDs labeled `referenceOnly-unverified`; never dereference them, include backend storage paths, fetch external destinations or infer audience/ownership. Associated external URLs must be bounded HTTP(S), credential-free, without query or fragment. Reject executable schemes, arbitrary relative URLs and storage locators. Unsafe, malformed or unreviewed references require an explicit uncovered/failure outcome, rather than truncation or silent complete success.

Private/public classification must remain explicit. A portable artifact and its media access must preserve the account boundary; selection does not publish content. Assets owns byte capture and storage provenance. J26 establishes neither media portability nor asset access.

## Other stores and acceptance limits

The inventory separately declares migration bookkeeping, process/logger output and configuration/seed inputs. Exclude these from ordinary Forum account snapshots. Logger output is not assumed nonpersonal or absent: deployed sinks, retention and purge remain later N/X work. Configuration credentials must never enter an export. Request-local profile lists and audience working sets are transient computation, not a newly discovered durable owner store.

Missing fields, unexpected tables, identity ambiguity, read/page/size limits, unsafe resource references or unavailable services must remain visible as uncovered/failed capture state. J27 must supply consistent paging, row-level inclusion/exclusion, cleanup and bounded-read proof. J28 must supply real lease/Profile-parent RPC and job proof. No download or deletion acceptance follows from J26.
