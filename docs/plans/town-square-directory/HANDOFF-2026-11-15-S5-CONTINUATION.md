# Handoff — Town Square directory continuation, 2026-11-15

## Goal and current instruction

Continue until S5 is complete; the user explicitly says milestones are not stopping points. The user wants a working local development stack for evaluation and will decide separately about public deployment. Provide short progress updates and continue independently. Preserve all uncommitted work in this checkout; do not create Git worktrees. The thread hard-stop rule in the current AGENTS instructions requires a fresh thread because this one began more than 24 hours ago.

**Read the newer [November 11 address-review handoff](HANDOFF-2026-11-11-address-review.md) first.** It is newer than the S5 checkpoint and reports P0/P1/P2 issues that the user instructed the next agent to correct in place. Its data counts and findings were not reverified on November 15. Read its linked S7 plan, decisions and operator runbook before changing that work. Do not assume the older S5 status document incorporates these later changes.

## Local stack

- Directory: https://nirvana.tail5a4a0.ts.net:8445/city/valdosta-ga
- Owner Console: https://nirvana.tail5a4a0.ts.net:8446/login
- On November 15 both URLs returned HTTP 200. Docker reported the Directory and Gateway healthy, and Local Hub, Owner Console, Social, Authentication, Permissions, Payments and Profile running. This verifies reachability, not feature correctness or public readiness.
- The ignored `.env.directory.local` holds local configuration. Do not print secrets. The ignored `.agent/s5-tailnet-registry.json` is mounted as the Gateway registry using `APP_REGISTRY_HOST_PATH`; it gives the two apps their 8445/8446 origins. Existing Tailscale Funnel on port 443 is unrelated and must not be changed.
- `scripts/start-local-directory.sh` starts the relevant local services assuming its three prerequisite databases/Redis already run; check the script and environment before use. Local Docker images were incrementally built during the November 9 session; distinguish these images from a clean Dockerfile build.

## Verified S5 work from November 9

- Local Directory/Gateway support rights-screened listing reads, exact category and text filtering, visitor-only adult opt-in, offset or encrypted query-bound 15-minute keyset cursors, and listing detail. Stable random IDs bind a town and exact source scan/row; they do not establish identity across releases or ownership. Wrong-town lookups and withdrawals were checked. Cursor results are not a frozen snapshot.
- Local bounds search only returns individually reviewed business locations; it limits the area and binds bounds to cursors. The interim implementation caps examined reviewed candidates at 5,000 and is not a production spatial index. Do not expose unreviewed coordinates, infer sensitive locations through bounds/counts, or claim every town boundary is verified.
- Shared interim listing types exist in `libs/social/contracts/src/lib/directory.ts`. Local Hub has directory and link flows; Owner Console has a town link-review queue. The checkout has since gained a separate `apps/local-hub/src/app/pages/business-directory/` page and S7 address-review code: inspect current code rather than assuming the November 9 UI is still current.
- The business-link path requires a verified Payments page owner to request a match, a separately recorded authorized Owner Console review, and current Social public visibility/Payments ownership checks before public projection. Owners can revoke links. No provider name, URL, geographic match or source ID establishes ownership. Avoid forwarding full Payments entities: they include owner and subscription fields.
- A real local-service synthetic exercise and authenticated Tailscale browser exercise covered request, review, public allowlisted projection, owner removal and audit (`request`, `approve`, `revoke`); a non-reviewer got 403. Temporary test user, listing, page and payment records were removed and zero counts verified. The owner and reviewer were exercised in separate browser profiles because app-scoped cookies share the Tailscale hostname across ports; same-profile switching is not proven.
- Directory identity and link migrations `1794260740862` and `1794261115508` were generated through the Directory Nx migration target, reviewed and applied locally and to a fresh disposable database; repository migration validation passed at that time. There is a newer November 10 migration `1794335354004`; follow its handoff and do not alter deployed timestamps.

## Critical later work and S5 gaps

The November 11 handoff documents an S7 address-review rollout with 53 published candidates and identifies serious audit findings, notably candidates whose source keys do not point to their published rows, missing town-containment checks with wrong-town published addresses, and missing owner-console retraction. It explicitly says the user chose documentation-only in that thread and expects the next agent to correct the findings in place. It also records later user authorizations for local address review and publication. Read all findings and current decisions; check present state before editing or claiming fixes. Avoid unnecessary rollback or deletion of user data.

S5 is **not complete**. The November 9 [S5 contract](S5-public-contract.md) lists remaining cross-release canonical identity, indexed spatial search/map integration, source freshness and truthful acquisition/coverage states, policy-aware cache and withdrawal/correction invalidation, concurrency/security evidence, and deletion/export lifecycle integration for link audit data. The later address-review findings may affect safe display and S5 acceptance. `SLICE-STATUS.md` is older than the November 11 work; reconcile after checking evidence. Public release still needs the user's agreed source-rights, verified-boundary and full quality controls; the user waived full review for local evaluation only. No paid provider calls are authorized.

## Mandatory current UI rules

The replacement AGENTS instructions supplied November 15 require inspecting `libs/common-ui`, `libs/form-ui` and relevant domain UI libraries before app markup. Use shared buttons, cards, badges, icons, state messages and form controls; app-local markup is for page layout only. Existing local directory and reviewer changes predate this rule and must be reviewed against it. Other uncommitted work includes shared form controls, address review and business-directory UI; do not overwrite or revert it.

## First steps and verification

1. Read the November 11 address-review handoff and newest decisions, inspect the current dirty diff and relevant skills, and confirm actual running schema/data and stack state without exposing credentials.
2. Address the documented P0/P1 issues and finish S5 in bounded, verified vertical slices, prioritizing safe source-row anchoring, town containment and reversible publication as applicable. Continue after each milestone; do not mistake one successful slice for completion.
3. Run focused Nx tests/builds using `/home/cjrutherford/.local/share/pnpm/pnpm` with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; inspect service targets before unfamiliar commands. For schema changes, generate migrations through the owning service's Nx target, inspect generated SQL, run on a fresh database and run `pnpm run validate:typeorm-migrations`.
4. Prove real runtime and authenticated flows where required; identify mocked boundaries and checks not run. Do not create paid requests, send messages, or deploy publicly. Record actual evidence and remaining risks in the appropriate plan/status docs.
