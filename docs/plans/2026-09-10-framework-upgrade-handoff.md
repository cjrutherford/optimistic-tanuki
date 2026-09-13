# Framework upgrade handoff — Nx, Angular, NestJS

Companion to `2026-09-08-dependency-prs-and-framework-upgrade.md`. That document
establishes _why_ the phases are ordered as they are — the peer ranges that bind
them are in its "binding constraints" section and are not repeated here. This
one is about _how to run each phase_: what to do, what will break, and how to
know it worked.

Nothing here has been started. Phase 0 (landing the combined dependency refresh)
is PR #244, which is open and awaiting a merge decision.

## Ground rules for every phase

- **One phase per branch, green before the next starts.** The phases share a
  lockfile; overlapping them makes a failure impossible to attribute.
- **Every Nx invocation needs `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`** or it
  hangs in this workspace. That applies to `nx migrate --run-migrations` too.
- **Never hand-write a TypeORM migration.** Generate it from the entity change
  and commit the generated timestamp as-is.
- **Do not merge a PR.** Drive it to green and report it as ready.
- **Expect a long CI loop.** 46 Docker image checks plus 21 e2e jobs; budget on
  the order of an hour and a half per full run, and use `nx affected` locally
  before pushing.
- **e2e now runs against the images the run built** (`scripts/pull-e2e-images.sh`),
  so a service-code change is genuinely exercised on the PR rather than only
  after merge. This matters more for these phases than for anything so far.

## Phase 1 — Nx 21.6.11 → 22.7.9

**Difficulty: low–medium.** Angular is untouched.

Run `nx migrate 22.7.9`, then `nx migrate --run-migrations`, then review the
generated `migrations.json` before deleting it. The Nx codemods do most of the
work.

What to check specifically:

- `nx.json` target defaults and named inputs are the usual casualties of an Nx
  major. Diff them deliberately rather than accepting wholesale.
- The 127 jest configs are generated per project; a `@nx/jest` major sometimes
  rewrites their shape. Confirm `coverageDirectory` is unchanged — several are
  nested (`coverage/libs/leads/data-access`, `coverage/libs/payments/domain`,
  `coverage/libs/permissions/domain`) and the coverage workflow reads those
  paths.
- `scripts/e2e-environment-manifest.mjs` and the tests under `scripts/tests/`
  are plain Node and unaffected, but `nx affected` behaviour changes can alter
  which e2e targets CI selects. Re-run `node --test scripts/tests/*.test.mjs`.

**Done when:** `nx run-many -t test --all`, `nx run-many -t lint --all` and
`nx run-many -t build --all` are green, and a full CI run passes including e2e.

## Phase 2 — Nx 22 → 23.2.0

**Difficulty: low–medium.** Still Angular-20-compatible; this is the step that
_unlocks_ Angular 22 later without moving Angular now.

Same mechanics as phase 1. The reason to take it separately is attribution: if
something breaks across two Nx majors at once there is no way to bisect it
cheaply given the CI loop length.

Watch for `@nx/angular@23` tightening its `@angular/build` peer; the workspace
is on Angular 20.3.30 and that is inside `>= 20.0.0 < 23.0.0`, so it should be
quiet. Verify with `pnpm peers check` — the only pre-existing skew is
`ng2-charts@10` wanting Angular 21, which is expected and harmless until
phase 4.

## Phase 3 — NestJS 11 → 12

**Difficulty: medium. Fully independent — can run in parallel with 1, 2, 4 or 5.**

Roughly 40 backend apps. It shares no constraint with the Angular chain, so it
does not need to wait for anything.

The work is mostly mechanical, but two areas in this codebase deserve attention:

- **Microservice message contracts.** The TCP `MessagePattern` / `@Payload`
  handlers are where this repo has repeatedly had gateway-to-service payload
  mismatches (community create, community invite). A Nest major that changes
  payload deserialisation would surface as 500s in e2e rather than compile
  errors, so read the microservices changelog carefully and lean on the
  microservice e2e suites, which are all currently green.
- **Guards and decorators.** `AuthGuard`, `PermissionsGuard` and the custom
  `@User()` / `@AppScope()` / `@FinanceTenantId()` param decorators are load
  bearing for authorization. `PermissionsGuard` is also `targetId`-aware. Any
  change to execution-context handling needs the gateway suite (1045 unit tests)
  and gateway-e2e to confirm it.

**Done when:** every microservice e2e suite is green — they are the only thing
that exercises the real TCP contracts.

## Phase 4 — Angular 20.3 → 21.2

**Difficulty: medium.** TypeScript and Jest stay put.

Moves with it: `jest-preset-angular` → 16.2, `zone.js` → 0.16 (Angular 21 is the
first version whose peer range sanctions 0.16 — see bug B in the companion
document; it was pinned back to `~0.15.0` on #244 precisely because Angular 20
forbids it).

The workspace is already fully standalone — 1 `@NgModule`, 0
`platform-browser-dynamic` imports — which removes the usual bulk of this
migration. The real exposure is the 557 `TestBed` specs; run the full unit suite
early rather than at the end.

Two workspace-specific things to re-verify, because both were broken once
already:

- **SSR bootstrap.** All 20 `apps/*/src/main.server.ts` files pass a
  `BootstrapContext` to `bootstrapApplication`. Confirm Angular 21 has not
  changed that signature again; a regression here breaks the _build_, which
  previously showed up only as failing Lighthouse audits.
- **Workspace peer ranges.** All 36 library `package.json` files pin
  `^20.3.30`. They must move together with the root, or pnpm's
  `auto-install-peers` resolves a second `@angular/core` and produces
  `NG3004` / `__@ɵINPUT_SIGNAL_BRAND_WRITE_TYPE@…` mismatches that look nothing
  like a version problem. Also update
  `tools/public-packages/mirror-root/package.json`, which mirrors the root.

`ng2-charts` needs to reach a version that accepts Angular 21 as part of this
phase.

## Phase 5 — Angular 21 → 22.1 (+ TypeScript 6, Jest 30, Storybook 10)

**Difficulty: high. This is the real project and deserves its own plan.**

Four coupled majors that cannot be separated:

- Angular 22's `compiler-cli` hard-requires TypeScript `>=6.0 <6.1`.
- `jest-preset-angular@17` (needed for Angular 22) requires Jest `^30`, which
  moves `jest-environment-jsdom`, `ts-jest`, `@swc/jest` and `jsdom` with it
  across 127 jest configs.
- `@storybook/angular` tracks Angular, so Storybook 9.1 → 10 comes too.

Expect the dominant cost to be the 557 `TestBed` specs and a long TypeScript 6
compile-error tail — `noPropertyAccessFromIndexSignature` is on workspace-wide,
so index-signature access errors will be numerous and mechanical.

Do **not** chase TypeScript 7 (the native port); Angular 22 pins `<6.1`.

Before starting, answer the open question from the companion document: whether
Angular 22 is wanted this cycle at all, or whether stopping at Angular 21 / Nx 23
is the right resting point. Phases 0–4 leave the workspace in a coherent,
supported state, so stopping there is a legitimate outcome rather than a
half-finished migration.

## Suggested order

```
Phase 0 (#244) ──▶ Phase 1 (Nx 22) ──▶ Phase 2 (Nx 23) ──▶ Phase 4 (Angular 21) ──▶ Phase 5
                └──▶ Phase 3 (Nest 12) ── independent, any time
```
