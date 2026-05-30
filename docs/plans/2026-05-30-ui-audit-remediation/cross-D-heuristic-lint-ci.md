# Cross-Cutting D: Enforce Heuristic Lint in CI

**Goal:** Wire `pnpm run ui:heuristics:ci` into CI with a per-app allowlist so net-new violations fail the build while existing debt is tracked.

**Current state:** `tools/scripts/check-client-ui-heuristics.mjs` runs locally and reports 679 findings. CI does not enforce it.

## Approach

1. Extend the script to accept `--allowlist <path>` pointing at a JSON file mapping `app -> max-allowed-findings`.
2. The script exits non-zero only when an app's count exceeds its allowed budget.
3. Each per-app remediation PR reduces its budget; the goal is every app reaching `0` over time.

## Files

- Modify: `tools/scripts/check-client-ui-heuristics.mjs` — add `--allowlist` flag, per-app aggregation, and a `--write-allowlist` snapshot mode for initial baselining.
- Create: `tools/scripts/ui-heuristics-allowlist.json` — initial per-app budgets equal to today's counts (see audit numbers).
- Modify: `package.json` — add `ui:heuristics:ci` to point at the allowlist by default.
- Modify: `.github/workflows/*.yml` (or whatever CI definition file exists) — add a job that runs `pnpm run ui:heuristics:ci` on push and PR.
- Modify: `docs/audits/client-app-ui-audit-2026-05-30.md` — append a note pointing at the allowlist as the source of truth going forward.

## Tasks

1. Refactor the script to group findings by `apps/<name>/` and compare against the allowlist.
2. Snapshot today's counts: run `node tools/scripts/check-client-ui-heuristics.mjs --write-allowlist tools/scripts/ui-heuristics-allowlist.json`.
3. Confirm `--allowlist` mode exits 0 with the snapshot in place and exits 1 when any app exceeds its budget (write a small fixture test or shell smoke test).
4. Add a CI job using the workspace's existing CI conventions (check `.github/workflows/` first; do not invent a new pipeline).
5. Update `tools/scripts/README.md` (or add one) explaining how to lower budgets after remediation PRs.
6. Document the rule that per-app remediation PRs MUST update `ui-heuristics-allowlist.json` downward.

## Verification

- `pnpm run ui:heuristics:ci` exits 0 with the snapshot.
- Manually bump one allowlist budget down by 1, re-run, confirm exit 1 and a useful diff message.
- New CI job appears and passes on the PR that introduces it.

## Risks

- Wrong baseline freezes debt forever; require remediation PRs to drop counts (enforce in PR template).
- Script must be deterministic across OSes (sort findings before counting).
