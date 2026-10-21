# Social account-data dispositions

**J23 is a policy and schema-coverage checkpoint.** J24-A/B/C/D must implement these rules in bounded captures. Existing partial previews do not establish compliance for every field. Downloads and deletion remain unavailable.

The [machine-readable inventory](../../apps/social/src/app/social-account-export-dispositions.json) declares every field and relation; its [validator](../../apps/social/src/app/social-account-export-dispositions.ts) checks coverage against metadata and the physical catalog. The [J23 finding](./findings/DF-007-J23.md) records acceptance and limits.

A current selector establishes who may select a record now. It does not verify historical authorship, establish consent or transfer ownership of shared content. Every legacy source retains an unverified-attribution label. Foreign identifiers remain opaque; no recursive counterpart content is fetched.

Actions distinguish subject values, opaque references, server templates, excluded fields and required typed projections. A typed projection is a requirement for future implementation; it does not permit raw JSON or row export.

## Authored contributions

| Source          | Selection and limit                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Post            | Require account and currently owned profile conjunction; visibility does not establish authorship.                          |
| Comment         | Require account and current profile binding conjunction.                                                                    |
| Reaction        | Both stored account and current profile binding must match.                                                                 |
| Vote            | Both stored account and profile must match the authenticated principal's current binding.                                   |
| Attachment      | Include only as an attachment reference of a selected subject post.                                                         |
| Poll            | Require account and current profile binding conjunction.                                                                    |
| SocialComponent | Include only when parent post passes its subject selector.                                                                  |
| Link            | No author selector exists on Link; include only through subject-owned post association and never claim verified authorship. |
| PostShare       | Select sharedById in currently owned profiles; do not reinterpret it as an account UUID or fetch the original Post.         |
| Event           | Require account and current profile binding conjunction.                                                                    |

## Personal state

| Source        | Selection and limit                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| SavedItem     | Select profileId in currently owned profiles; preserve bookmark action without copying counterpart-authored titles.          |
| SearchHistory | Select by currently owned profile.                                                                                           |
| FollowEntity  | Select outgoing follows only when followerId is a currently owned profile; never select inbound relationships by followeeId. |
| UserBlock     | Select only blockerId in currently owned profiles; no inbound blocks.                                                        |
| UserMute      | Select only muterId in currently owned profiles; no inbound mutes.                                                           |
| Activity      | Select profileId in currently owned profiles; raw descriptions have no reliable provenance.                                  |
| UserPresence  | Select where account userId matches principal.                                                                               |
| ProfileView   | Select viewerId equal to authenticated account only; analytics ownership of target profile is a separate J19 path.           |
| Notification  | Select recipientId in currently owned profiles and use projectNotification from social-contracts (J21).                      |

## Community participation

| Source                   | Selection and limit                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Community                | Select recorded owner account and currently owned owner profile conjunction for a stewardship receipt only; exclude system communities. Administration is not individual ownership of shared content.                                                   |
| CommunityMember          | Require account and current profile conjunction; export only this member's contribution.                                                                                                                                                                |
| CommunityInvite          | Select inviterId or inviteeId equal to authenticated account; emit only the matching subject side and an opaque community reference. Do not expose the other participant identity.                                                                      |
| CommunityMembershipAudit | Two separate projections: subjectId in current owned profiles receives own lifecycle receipt; actorId equal to account receives own admin-action receipt. Do not interchange profile subjectId and account actorId or expose unmatched participant IDs. |
| CommunityElection        | Select initiatedBy equal to authenticated account for an initiation receipt only; no whole-community governance ownership is inferred.                                                                                                                  |
| ElectionCandidate        | Require current account/profile binding; include candidate's own nomination only.                                                                                                                                                                       |
| ElectionVote             | Select voterId equal to account AND voterProfileId currently owned; export only the subject’s own recorded vote, never other voters.                                                                                                                    |

## Business and safety

| Source                      | Selection and limit                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BusinessPageContent         | Select ownerId equal to authenticated account, as bound by PaymentsController.createBusinessCheckout, for an owner registration receipt only; do not imply sole authorship of shared business content.   |
| BusinessThemeContent        | Select only via a BusinessPageContent row whose ownerId is the authenticated account; emit a configuration reference, not shared raw theme content.                                                      |
| CommunitySponsorshipContent | Select userId equal to authenticated account for the sponsorship purchase/contribution receipt; do not treat linked business/community content as owned.                                                 |
| GuardianContentAudit        | Actor branch: actorUserId equals account. Dependent branch: dependentUserId equals account. Project only branch-safe action receipt; do not infer current guardian relationship or consent from the row. |
| GuardianPublishedAssetGrant | Actor branch selects actorUserId equal to account; dependent branch selects dependentProfileId in currently owned profiles. Grant history does not authorize present asset access or prove consent.      |
| ContentReport               | Select reporterId in currently owned profiles; the Gateway binds it to user.profileId, not user.userId.                                                                                                  |
| ContentModerationAction     | Select actorProfileId in currently owned profiles for an actor-action receipt only; being moderated does not confer ownership of the private audit.                                                      |

## Sensitive fields

- Notification sender/resource/action fields are excluded; title/body use server templates.
- Invitation email/token, raw attachment paths, arbitrary component JSON, raw poll votes and private audit details are excluded.
- Saved counterpart titles and unverified activity descriptions are excluded; the user’s save/activity fact remains eligible.
- Event media/URL fields require bounded safe-link or opaque asset-reference projection. A reference never grants bytes or current publication permission.
- Community administration and business ownership select narrow stewardship/registration receipts, not whole shared content.
- Guardian and membership audits use separate actor and subject branches; unmatched counterpart identities and private payloads are excluded.
- Election votes preserve only the subject’s own record and opaque choice/context references; other voter and candidate account data is excluded.
- Post/Poll relation persistence is unverified. Both relation directions remain excluded until a separate owning-association repair; author-selected poll definitions do not require that relation.

## Stores

| Store                                    | Treatment                                                                                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typeorm_migrations_store                 | Exclude migration bookkeeping rows. Migration tracking is schema metadata and is excluded from personal export.                                                                                                                        |
| NotificationService.pendingNotifications | Exclude volatile debounce payload and timer state. This is not a durable delivery ledger or a retention guarantee. Transient delivery payload may include private notification data; not durable account data.                         |
| Social.processOutput                     | Exclude this entire source from ordinary account snapshots. Social log messages may contain mixed participant context. Persistence and retention belong to deployment/infrastructure; no safe per-account log selector is established. |
| Social.configurationInputs               | Exclude this entire source from ordinary account snapshots. Operator configuration is an input, not a personal-data ledger; credentials and service configuration are excluded wholesale.                                              |

The physical gate accounts for the current Social database and the declared source-visible stores. It does not discover external sinks from operator configuration or prove retention, log deletion or a durable notification-delivery ledger. Auth, Profile, Assets and Payments remain separate owners; references do not duplicate those datasets.

## Acceptance boundary

The local gate checks every physical table/column and mapped relation, source evidence, identity-domain decisions and drift rejection. It does not prove any J24 capture enforces these rules. Each later capture needs its own real row-selection, privacy, pagination and integrity evidence before acceptance.
