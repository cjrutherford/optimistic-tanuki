# Handoff — Town Square directory, items 2 and 3 (2026-11-15)

## Goal

Finish the remaining hard-stop items from [HANDOFF-2026-11-15-HARDSTOP.md](HANDOFF-2026-11-15-HARDSTOP.md), in this order:

1. **Item 2: production spatial index.** Bounds search currently caps the reviewed candidates it examines at 5,000 and validates them in JS before pagination. Build a reviewed-address-only indexed projection with:

   - reliable lifecycle updates
   - historical reconciliation and readiness
   - current policy, withdrawal and assignment checks
   - validation before `hasMore`

   Never index or disclose unreviewed coordinates or counts, and never guess historical assignment identity. Keep the S5 non-snapshot cursor semantics.

2. **Item 3: source freshness provenance.** `directory_overture_private_completion` holds only a scan ID. Persist the real upstream release/publication evidence and a trusted acquisition timestamp, with provenance. Historical scans without evidence stay `unknown`. The targets are a refresh at least every 90 days and stale after 120 days, and inferred dates never count as proof.

## Current state (all in the local stack)

- **Item 5 (account deletion/export participant):** live. A real end-to-end deletion needs all 13 owners running, which the local directory stack does not do.
- **Item 4 (reviewed-listing source binding):** live.
  - The 48 legacy publications are `unknown_legacy` and suspended, so they are hidden.
  - Reviewed fields are served only for an active binding with a current lease.
  - The sweep `scripts/local-directory-reviewed-binding-sweep.cjs` is run by hand; nothing schedules it yet.
- Details and evidence are in [HANDOFF-2026-11-15-S5-PROGRESS.md](HANDOFF-2026-11-15-S5-PROGRESS.md) (last four entries).
- Designs: [S5-account-lifecycle-design.md](S5-account-lifecycle-design.md) and [S5-item4-source-binding-design.md](S5-item4-source-binding-design.md). Owner decisions were taken at their conservative defaults; the owner confirmed decision 1 of item 4.

## Item 2 must build on item 4

The new projection must include only rows whose `directory_reviewed_binding` is `active` with `verifiedUntil > now()`. That is the same predicate the read gate uses in `apps/directory/src/register-pending-runtime.ts` around lines 182–205. Sweep transitions (suspend and retire) must remove rows from the projection, either in the same transaction or by having the projection read the binding.

## Files changed by items 4 and 5 (uncommitted, in a dirty shared checkout)

- **Shared Directory files:**
  - `apps/directory/src/entity.ts`, `data-source.ts`, `register-pending-runtime.ts`, `address-review-publish.ts`, `address-review-store.ts`, `listing-business-link.ts`, `boundary-decision.ts`
  - `apps/directory/project.json`
- **Item 4:**
  - `apps/directory/src/reviewed-binding.ts` and `reviewed-binding-revalidate.ts`
  - Scripts `scripts/local-directory-reviewed-binding-{legacy,sweep}.cjs`
  - Tests `apps/directory/test/reviewed-binding*.js`
- **Item 5:**
  - `apps/directory/src/account-lifecycle*.ts` and `account-export-sources.ts`
  - Authentication's `account-deletion` and `account-export-jobs` code
  - `libs/models` and `libs/storage` export coverage
- **Migrations** (all applied to the live `ot_directory`, 34 rows): `1794773566665`, `1794774382803`, `1794775325695`, `1794794657383`.

## Operating notes

- **Nx:** `PATH=$HOME/.local/share/pnpm:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true pnpm exec nx ...`
- **PostGIS:** reachable at 127.0.0.1:32768 (container `town-square-directory-db`). The credentials are in `DIRECTORY_DATABASE_URL` in `.env.directory.local`; never print them.
- **Disposable test DBs:** clone with `createdb -T s5_identity_202611152 <name>`, then set the logging policy with `ALTER DATABASE` if a test needs it. Note that this template predates migration `1794794657383`, so run the migrations on each clone. Drop every clone afterwards.
- **Migrations:**
  - Generate only with `directory:typeorm:migration:generate` against a DB already at head.
  - Strip only the unrelated `ALTER COLUMN "id"` UUID-default drift lines, and keep the generated timestamp.
  - Verify up, down, up, then run `pnpm run validate:typeorm-migrations`.
- **Images:** incremental, `FROM optimistic-tanuki-directory:latest` plus `COPY main.js` and `register-recovery-begin-operator.js` from `dist/apps/directory/`, built with plain `docker build`. Start with `APP_REGISTRY_HOST_PATH="$PWD/.agent/s5-tailnet-registry.json" scripts/start-local-directory.sh`. Afterwards, check whether the container was renamed with an id prefix.
- **Rollback:** the `:pre-lifecycle` and `:pre-binding` image tags, plus the dumps in `.agent/backups/`.
- **Sweep env:**
  - `DIRECTORY_REVIEWED_BINDING_HMAC_KEY` and `DIRECTORY_CONTACT_STAGE_LABEL`, both in `.env.directory.local`
  - `DIRECTORY_CONTACT_STAGE_DATABASE_URL`, the same server with database `ot_directory_census_stage`
  - `TS_NODE_PROJECT=apps/directory/tsconfig.json`

## Constraints

- Never git reset, clean, checkout or stash.
- Never commit, push or merge unless asked.
- Never create worktrees.
- Never run destructive tests against `ot_directory` or the stage.
- Publication and auto-approval stay paused.
- No paid provider calls, no public deploys, no messages sent, and leave the port-443 Funnel alone.
- Fable only plans and unblocks; Sonnet implements. Run at most 2 subagents at once.
- Bound command output to under 3000 characters.

## Status 2026-11-16

Items 2 and 3 are done and live in Directory (see the last two progress entries). Remaining follow-ups: migrate the stage DB before the next capture, redeploy the gateway, show the freshness label in Local Hub, schedule the binding sweep, run a full 13-owner deletion.

## Original next step

Start a fresh session from this file. Have Fable write `S5-item2-spatial-projection-design.md` (design only, building on the binding predicate above). Then a Sonnet agent implements it in slices on disposable DBs. Item 3 follows the same pattern.
