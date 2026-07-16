---
title: Social Authorization & Privacy — Enforcement Patterns
date: 2026-07-15
status: proposed
summary: Worked-out authorization and privacy patterns for the Social domain (audit Domain 4), closing the search privacy leak, vote duplication, and untrusted identity, using the same defense-in-depth convention established for project-planning.
---

# Social Authorization & Privacy — Enforcement Patterns

## Context

The 2026-07-14 audit scored Social & Community 6/10 with the headline issue: **search
returns posts with no visibility/moderation filtering** — a live privacy leak. This is the
#1 remaining drill-in after the money-correctness batch. The `Post` entity already carries
the fields needed to fix it; the services simply don't use them. This plan works out the
enforcement patterns (it mirrors the project-planning `project-access.util.ts` approach from
the earlier authorization fix) so implementation is a matter of applying a shared convention,
not inventing infrastructure.

## Verified gaps (file:line)

1. **Search leaks non-public / hidden / deleted posts.** `SearchService.search`
   (`apps/social/src/app/services/search.service.ts:96-104`) and `getTrending` (`:146-154`)
   query posts with only `ILike` on title/content and **no** filter on the `Post` entity's
   existing `visibility: 'public' | 'followers'`, `moderationStatus: 'visible' | 'hidden'`,
   or `deleted` columns. Result: followers-only posts are returned to non-followers,
   moderator-hidden posts are returned, and soft-deleted posts are returned.
2. **Votes are not deduplicated.** `VoteService.create`
   (`apps/social/src/app/services/vote.service.ts:14-21`) always inserts; the `Vote` entity
   has no unique constraint on `(post, profileId)` / `(comment, profileId)`. A user can vote
   unlimited times on the same target.
3. **Vote identity is only half-trusted.** The gateway sets `voteDto.userId = user.userId`
   server-side (`apps/gateway/src/controllers/social/social.controller.ts:117`) but takes
   `profileId` from the client body — so any dedup/authorization keyed on `profileId` cannot
   trust it. (Posts already do this correctly: `:86` sets `postDto.profileId = user.profileId`.)
4. **Block / mute infrastructure exists but is unused by feeds/search.**
   `apps/social/src/app/services/privacy.service.ts` already implements
   `isUserBlocked` / `getBlockedUsers` / `getMutedUsers` / `reportContent` / `moderateContent`,
   but search and feed queries ignore it.
5. **Scale:** search pulls `take: 1000` profiles into memory and filters in JS
   (`search.service.ts:72-79`, `getSuggestedUsers` `:171-177`).
6. **Latent throttle bug:** `@Throttle({ default: … })` on the vote route
   (`social.controller.ts:114`) is silently ignored when named throttlers are configured —
   the same bug fixed for auth routes in the earlier throttling work. It must key on a named
   throttler.

## Patterns

### A. Trust the gateway's identity, never the request body

The gateway forwards the authenticated `profileId` into every social RPC payload: set
`voteDto.profileId = user.profileId` on the vote route, and attach a `requestingProfileId`
(from `user.profileId`) to read payloads (search, feeds, single-post fetch). Services treat
this value as authoritative and never derive identity from client-supplied fields. This is
the same defense-in-depth convention established for project-planning.

### B. A shared post-visibility scope (the core privacy fix)

Add `apps/social/src/app/common/post-visibility.util.ts` (analogous to
`project-access.util.ts`) exposing a predicate applied uniformly across search, trending,
feeds, and single-post fetch:

```
visiblePostWhere(viewerProfileId, followedProfileIds, blockedProfileIds)
```

enforcing:

- `deleted = false`
- `moderationStatus = 'visible'` — unless the viewer is the post's author or a moderator
- `visibility = 'public'` **OR** (`visibility = 'followers'` AND author ∈ `followedProfileIds ∪ {viewerProfileId}`)
- author ∉ `blockedProfileIds` (and viewer ∉ the author's blockers)

Provide both a `where`-fragment form (for `repo.find`) and a QueryBuilder form (for
`getTrending`'s aggregate query). The author always sees their own posts; moderators see
hidden content.

### C. Compose block/mute in

Feed/search queries source `blockedProfileIds` from the existing `privacy.service`
(`getBlockedUsers` + users who blocked the viewer, and optionally `getMutedUsers`). No new
infrastructure — just wire the existing service into the visibility scope input.

### D. Idempotent votes

- **Entity:** partial unique indexes on `Vote` for `(postId, profileId)` and
  `(commentId, profileId)` (a vote targets a post XOR a comment).
- **Migration:** add the indexes after de-duplicating existing rows (keep the most recent
  vote per `(target, profileId)`).
- **Service:** upsert semantics — on vote, look up the existing vote for
  `(target, profileId)`; if present, update its value; a value of `0` deletes it; otherwise
  insert. Re-voting toggles rather than duplicating.

### E. Offload profile search

Replace the 1,000-row in-memory profile scan with a paginated `ProfileCommands.Search` on
the profile service (query + limit/offset pushed down), or at minimum bound and index the
name/bio lookup. Removes both the privacy-adjacent overfetch and the scale problem.

## Sequencing

| Phase | Patterns | Rationale                                                                                        |
| ----- | -------- | ------------------------------------------------------------------------------------------------ |
| 1     | A + D    | Trustworthy identity + vote dedup (entity, migration, upsert, gateway). Mechanical and testable. |
| 2     | B + C    | The visibility-scope util applied to search/trending/feeds — closes the actual privacy leak.     |
| 3     | E        | Profile-search offload (perf); can follow independently.                                         |

The scorecard's WebSocket-backend item for Domain 4 ("build the backend handlers or correct
the real-time docs") is a separate decision from authorization and is intentionally **not**
bundled here.

## Success criteria

- No search/feed/trending query returns a post that is deleted, moderator-hidden, or
  followers-only to a non-follower (test-enforced with a shared visibility fixture).
- A user voting twice on the same target yields exactly one vote row (unique constraint +
  upsert, migration de-dups existing data).
- Vote `profileId` is always server-derived; services reject/ignore client-supplied identity.
- Blocked/muted authors' content is excluded from the viewer's search and feeds.
- Profile search no longer loads the full profile table into memory.
