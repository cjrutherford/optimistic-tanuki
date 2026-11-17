# Handoff: business identity reviewer queue (2026-11-17)

## What changed

Decision B is built and committed on `t3/integrate-business-directory`. It is deployed on the local stack (see Deployment below).

| Commit      | Content                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `2a9a7f91e` | A baseline of all earlier Town Square directory work, through item 1, which was previously uncommitted. |
| `1b668d882` | Prettier formatting only.                                                                               |
| `e1ecde3fe` | The reviewer queue slice.                                                                               |

The commits are local; nothing is pushed.

- **Gate:** the same as address review. That is `AuthGuard` + `DirectoryOwnerScopeGuard` in the gateway, and the `authGuard` dashboard route in Owner Console. The open question from the previous handoff is answered: nothing new was needed.
- **Directory routes:** `GET /internal/local-evaluation/towns/:town/business-identity-review` returns `{health, queue}`. `POST …/decisions` takes confirm, retire, merge or split. Both are checked against `authority(town)` before and after. A domain refusal returns 409.
- **Actor:** recorded as `{id: profileId, domain: 'profile'}`. Account deletion already scrubs this domain.
- **Gateway:** `DirectoryBusinessIdentityReviewController` at `directory/towns/:townId/business-identity-review`. A 409 from the directory becomes `ConflictException('Decision refused')`.
- **Owner Console:** `/dashboard/directory-identity-review/:communityId`, linked as "Review Business Identity" from community ops. The `decisionId` is fixed for each opened form, so a retry replays the decision.

## Evidence

- `register-pending-runtime.test.js`: 28/28 (needs `-r ts-node/register/transpile-only`).
- `nx test gateway`: 135 suites, 1884 tests.
- `nx test owner-console`: 62 suites, 690 tests.
- `tsc --noEmit` is clean for gateway, owner-console and directory.
- The personality audit passes.
- Full directory suite, run directly: 6 failures, all in files this slice did not touch (`account-lifecycle-http.postgres`, `business-link-compose.postgres`, `receipt-server`, and recovery/reconciliation tests). They are believed to predate the slice but are unconfirmed.

## Deployment (2026-11-17)

- The stack had been down for about 16 hours: every OT container exited with code 255, after what looks like a host shutdown.
- The `ot-hostnet` buildx config under `/tmp/ot-buildx` was gone. I recreated it with the command in the memory note; the builder container had survived.
- Rollback tags are `:pre-identity-queue` on `optimistic-tanuki-directory`, `cjrutherford/optimistic_tanuki_gateway` and `cjrutherford/optimistic_tanuki_owner-console`.
- I rebuilt those three images and started the stack with `scripts/start-local-directory.sh`. Directory, gateway and the worker report healthy.
- Smoke checks for town `24ba6730-…`:
  - The internal queue returns 200, with all health counts at zero and empty lists, matching readiness.
  - A request without the credential gets 401, and a bad decision body gets 400.
  - The gateway route without auth gets 401, where an unknown route gets 404, which shows the route is registered.
  - The Owner Console page returns 200.
- No decisions were recorded.

## Next step

Item 2: truthful acquisition and coverage states.

## Constraints (updated)

- Commit verified slices on the feature branch as you go. Never push without local e2e, and never merge.
- Everything else from [HANDOFF-2026-11-16-ITEM1-DONE.md](HANDOFF-2026-11-16-ITEM1-DONE.md) still applies: no network, generated migrations only, no destructive tests on live data, publication paused, at most 2 subagents.
- Commit through the pre-commit hook, which runs a secret scan and `nx format:write` and then re-adds files. Only use `--no-verify` when splitting mixed files, and run the secret-pattern scan by hand when you do.
