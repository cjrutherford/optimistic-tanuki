# RR04-I03 feed and privacy acceptance plan

**Date:** 2026-10-09
**Baseline:** `7ebb970da765f438cc61bccdb038627141ecbc4d` (accepted RR04-I02)
**Status:** ACCEPTED — 2026-10-09. All 23 unique live cells, affected verification, exact cleanup/restoration and independent review pass. Parent RR-04 is accepted; RR-09 is next and RR-12 repeats integration.

## Goal and boundaries

Complete the integrated feed/privacy acceptance that remains after I01 and I02. Primary feeds must remain chronological and unranked, discovery must stay separate, visibility and relationship changes must remove content from every applicable surface, and an in-flight read must neither restore stale protected content nor leave the feed empty after access is restored. Repair only reproduced defects in the shared policy/read path. Do not add feed ranking, new notification kinds, a scheduling system, or a new moderation feature.

I03 evidence completes the integrated RR-04 criteria; the parent finding is accepted. Reuse I01/I02 evidence only for the exact behavior and surface it proves. Unit tests and source inspection support but do not replace real-stack acceptance. No PR, push, deployment, or promotion is included.

## Criterion-to-evidence map

| Criterion                                          | Existing evidence reused                                                                               | Completed I03 evidence                                                                                                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chronological primary feeds; no engagement ranking | I02 timestamp ordering and separate Public/Following/Communities paths                                 | Chronology API after vote and desktop 21-post pagination; checks fixture-relative order, actual response IDs, rendered IDs, uniqueness and page boundaries. Follow/Explore browser confirms discovery remains separate.                         |
| Tabs and pagination                                | I02 live matrix covers initial public/following/community separation                                   | Browser switches Public/Following, waits for page-originated offset-0/offset-20 responses and compares rendered rows without duplicates at the page boundary.                                                                                   |
| Follow/unfollow controls                           | I01 authorization/cache invalidation; I02 feed inclusion                                               | Closed-loop follower-only denial → follow positive → unfollow denial, including protected direct target, at desktop/mobile/tablet.                                                                                                              |
| Direct/search/comment parity                       | I01 private-community/follower/revoked/suspended cases; I02 audience/share and image boundaries        | Audience narrowing, moderation and bidirectional blocks check direct/feed/search/comments; exact I01 lifecycle cells are reused where I03 changes no policy branch.                                                                             |
| Community/member lifecycle and alternate profiles  | I01 approved membership, suspension/revocation, alternate profiles and direct/feed cache removal       | Exact I01 conditions reused; new I03 block cases independently exercise the changed community visibility branch in both directions.                                                                                                             |
| Share restriction and deletion                     | I02 owner deletion and restriction/unfollow behavior                                                   | Existing share metadata and direct positive before source deletion; afterward share listing, direct, feed and search filter the source.                                                                                                         |
| Scheduled and moderated content                    | RR-08 controls/audit evidence reused only for supported policy                                         | Existing scheduled state checked before/after publish; controlled public community post is outsider-readable before hide, absent during hide across relevant surfaces, and readable again after restore.                                        |
| Notification previews and recipient ownership      | I01 generic mention behavior                                                                           | Existing mention remains generic after access loss; a different recipient cannot mark/delete the notification while the owner mutation works. Desktop/mobile/tablet browser checks wait for the detail response and assert settled empty state. |
| Bidirectional blocks                               | QueryBuilder policy and I01 direct policy; community/legacy visibility regressions added in this slice | Both block directions cover API read parity, active browser views, socket positive controls/denial after reconnect and restored authorized content at desktop/mobile/tablet.                                                                    |
| Active-client cache and socket lifecycle           | I01 deletion/unfollow invalidation and reconnect denial; I02 selected audience and public refresh      | Live audience narrowing and community blocks remove content from active and fresh reads. Cross-author Socket.IO case proves positive delivery, blocked denial and subscription reauthorization after reconnect.                                 |
| Pending GET_FEED vs visibility UPDATE              | I02 post-creation revision protection                                                                  | Deterministic held real feed read across audience UPDATE suppresses stale output, then confirms a fresh authorized feed is emitted; real-stack active/reconnect transitions pass without a production test hook.                                |

### Claim disposition

| Claim                                                                                 | Disposition | Reason                                                                                          |
| ------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| Chronological, non-engagement-ranked primary feeds                                    | COMPLETE    | API chronology and rendered pagination pass; RR-12 repeats on the integrated release candidate. |
| Explore/discovery is separate from primary feeds                                      | COMPLETE    | Follow/Explore separation passes at desktop, mobile and tablet.                                 |
| Privacy parity across feeds, search, direct links, comments, shares and notifications | COMPLETE    | Exact I01/I02 reuse plus I03 transition, block, preview and read-surface checks pass.           |
| Scheduling/moderation visibility                                                      | COMPLETE    | Existing scheduled state and controlled moderation lifecycle pass.                              |

No core chronology or privacy claim was reworded, deferred, or retracted. Broader release-candidate integration remains assigned to RR-12; RR-10 reliability and shared email/operator gates remain independent promotion requirements.

## Ordered implementation and verification

1. **Social block policy, test first.** Add repository-helper regressions for member-only and legacy community branches in both block directions. Confirm RED, then apply the shared block exclusion to the missing branches. Preserve the QueryBuilder policy and authorized positives.
2. **Gateway update/read ordering, test first.** Add a deterministic test around the actual feed read and authorization/revision path. Hold the real read, narrow audience, then release the response. The stale result must not emit; the invalidation/refetch path must subsequently emit the fresh authorized feed. Confirm RED before the smallest revision/invalidation repair.
3. **Notification recipient binding, test first.** Add an owning-route/service regression proving recipient A cannot mutate recipient B's notification and that B's readback remains unchanged. Preserve own-recipient read/delete. If the required contract expansion exceeds the existing gateway/social route and service, stop for scope review.
4. **Add missing live acceptance cases.** Create `apps/client-interface-e2e/src/rr04-i03-acceptance.spec.ts` and a checked-in Nx target if needed. Reuse the existing live fixture helpers, real authenticated contexts and owning APIs. Include the missing surfaces/transitions from the table, existing notification types only, and no asset cases already accepted by I02.
5. **Run focused source checks, then live acceptance.** Run focused social, gateway and notification tests plus affected lint. Use the checked-in Nx Playwright target against the already-running local stack. Run desktop API gates, browser flows at desktop/mobile/tablet, and one deterministic race case; use fresh unique fixtures and cleanup/readback. Verification agent owns live test execution after source freeze.
6. **Build and independent review.** Run affected uncached units/lint and the full development build after source changes. Independently review the final source, test method, evidence, cleanup and claims. Synchronize I03, parent RR-04, Master Audit and Execution Plan only after evidence is complete.

## Candidate owned paths

- `apps/social/src/app/common/post-visibility.util.ts`
- `apps/social/src/app/common/post-visibility.util.spec.ts`
- `apps/gateway/src/controllers/social/social.controller.ts`
- `apps/gateway/src/app/social-gateway/social.gateway.ts`
- `apps/gateway/src/app/social-gateway/social.gateway.spec.ts`
- `apps/gateway/src/controllers/social/notification/notification.controller.ts`
- `apps/gateway/src/controllers/social/notification/notification.controller.spec.ts`
- `apps/social/src/app/app.controller.ts`
- `apps/social/src/app/services/notification.service.ts`
- relevant owning social/gateway specs or DTO contracts only if required by the minimal recipient-ID propagation
- `apps/client-interface-e2e/src/rr04-i03-acceptance.spec.ts`
- `apps/client-interface-e2e/project.json` only if a named Nx target is required
- `docs/plans/2026-10-09-rr04-i03-feed-privacy-acceptance.md`
- `docs/release-readiness/findings/RR-04-I03.md`
- `docs/release-readiness/findings/RR-04.md`, `docs/release-readiness/MASTER-AUDIT.md`, and `docs/release-readiness/EXECUTION-PLAN.md` at closeout only

All paths remain subject to review after inspecting exact ownership and current status. User-owned paths and unrelated work remain excluded.

## Acceptance and closeout limits

Acceptance is complete: targeted regressions, affected lint/units, full build, all 23 unique live/API/browser cells, race suppression plus recovery, notification ownership/privacy, exact fixture cleanup, baseline restoration and independent review pass. RR-09 is next. RR-10, stable operator key/email, and other promotion gates remain separate and do not waive I03.
