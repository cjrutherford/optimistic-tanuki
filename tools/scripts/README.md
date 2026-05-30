# tools/scripts

Workspace-level helper scripts.

## `check-client-ui-heuristics.mjs`

Scans `apps/**/*.scss` for theme-system anti-patterns:

- `hex-literal` — hex colors outside `:root` and outside token/theme/personality files; use semantic CSS vars instead.
- `narrow-layout` — top-level `shell`/`layout` containers with `max-width < 1280px`.
- `badge-fixed-color` — `color: white|black` inside `badge`/`chip`/`pill` selectors; use semantic foreground tokens.

### Modes

| Command                           | Purpose                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm run ui:heuristics`          | Report findings; always exits 0 (developer feedback).                                                           |
| `pnpm run ui:heuristics:ci`       | Enforce per-app allowlist in `ui-heuristics-allowlist.json`; exits 1 if any app exceeds its budget. Used by CI. |
| `pnpm run ui:heuristics:strict`   | Fail on **any** finding (no allowlist). Use locally when working toward zero.                                   |
| `pnpm run ui:heuristics:snapshot` | Rewrite `ui-heuristics-allowlist.json` from current counts. **Do not run unless intentionally rebaselining.**   |

### Allowlist rules

`tools/scripts/ui-heuristics-allowlist.json` maps each app to its current maximum allowed finding count. The CI check runs `--allowlist` against it.

**Per-app remediation PRs MUST lower the relevant app's budget.** Never raise a budget. The script reports apps that are below their budget so you remember to lower them in the same PR that reduced the count.

The goal is every app reaching `0` over time; once an app is at `0` it remains pinned to `0` (any new violation fails CI).
