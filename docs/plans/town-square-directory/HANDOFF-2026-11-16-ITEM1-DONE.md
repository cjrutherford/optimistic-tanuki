# Handoff: Town Square directory after item 1 (2026-11-16)

## Goal for the next session

Pick one slice per session:

1. **Owner Console reviewer queue.** The owner chose decision B on 2026-11-16: a reviewer-only screen in Owner Console, backed by gateway routes, showing the business-identity review queue with merge, split, confirm and retire actions. Business owners get no self-serve action.
2. **Truthful acquisition and coverage states.** This is the next item on the agreed "what's left" list. Fable plans it only if it is a hard plan; otherwise Sonnet plans it. Either way, Sonnet builds it.

## Current state (local stack, live)

- Items 2, 3, 4 and 5 are live, and item 1 (cross-release business identity) slices 0–8 are live too. The details and evidence are in the last five entries of [HANDOFF-2026-11-15-S5-PROGRESS.md](HANDOFF-2026-11-15-S5-PROGRESS.md).
- Both `ot_directory` and `ot_directory_census_stage` are at 38 migrations, the latest being `1794823970564`.
- `ot_directory` has 49 anchored `origin` businesses. Readiness reports `businessIdentity` as all zeros, the 48 bindings are suspended, the spatial index is ready, and freshness is unknown for all 37 sources.
- The operator CLIs are `scripts/local-directory-business-identity-{census,carry,review,anchor,reread}.cjs`. The TS-importing scripts need `node -r ts-node/register -r tsconfig-paths/register` with `TS_NODE_PROJECT=apps/directory/tsconfig.json`.
- `.env.directory.local` holds `DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY`. Never print it.
- Rollback:
  - Image tags: directory `:pre-identity` and `:pre-identity-review`; gateway and local-hub `:pre-identity`.
  - Dumps in `.agent/backups/`, all dated 20261116: `*-pre-identity-*`, `*-pre-identity-review-*` and `ot_directory-pre-anchor-*`.

## Owner decisions recorded

| Item | Decision |
|---|---|
| Item 1, decision 1 | The upstream id is kept only as a keyed hash. |
| Item 1, decision 8 | The public id is the business id. Old ids alias forward, and cursors are invalidated at cutover. |
| Existing policy ids | Option A: `OVERTURE_RIGHTS_FIELDS_LEGACY_V1` is frozen for existing cohorts. |
| A, export | Reviewer decisions are not exported. |
| A, deletion | The record is kept and the actor is removed. This was already implemented. |
| B, screens | Owner Console, reviewer-only. Not built. |
| C, re-read | Off. It runs only if the owner asks for a specific run. No existing scan has evidence anyway. |

## Open question for the B slice design

Which existing permission gates the reviewer actions? Look at how the Owner Console gates the existing address-review and binding review, and reuse that. If nothing fits, ask the owner.

## Next import runbook

1. Run cutover phase 1.
2. Run `carry --check --from-policy X --to-policy Y`.
3. Run `carry --apply --confirm-database <db> --plan-digest <d>`.
4. Run `review links --apply` per town.
5. Run the cutover again; this revokes the old policy.
6. Redeploy.

## Known issues (pre-existing, not caused by item 1)

- The shared test template `s5_identity_202611152` holds a stale policy row (`bbbb…`) and is behind on migrations. Migrate and clean a master clone before cloning per-target test DBs.
- `test-business-link-compose` fails unless that stale row is removed.
- `scripts/overture-release-preflight.test.mjs` fails 1/7.
- The worker's `queue.test.js` needs the Redis env.

## Constraints

The constraints are unchanged from [HANDOFF-2026-11-15-ITEMS-2-3.md](HANDOFF-2026-11-15-ITEMS-2-3.md):

- Dirty shared checkout: never git reset, clean, checkout or stash, and never create worktrees.
- No commits, pushes or merges unless asked.
- No network or provider calls.
- Migrations come only from Nx generate.
- No destructive tests against the live DB or the stage.
- Publication stays paused.
- At most 2 subagents.
- Fable only plans and unblocks; Sonnet implements.
- Bound command output to under 3000 characters.
