# Dependency PR triage and Nx / Angular / NestJS upgrade assessment

Date: 2026-09-08
Base: `main` @ `ecbbbb32`

## Part 1 — Open PR inventory

| PR   | Title                            | Mergeable       | CI                                                     | Verdict                                      |
| ---- | -------------------------------- | --------------- | ------------------------------------------------------ | -------------------------------------------- |
| #242 | prod deps, 67 updates            | MERGEABLE       | **UNSTABLE** — test + coverage + 4 Lighthouse jobs red | **Needs fixes**                              |
| #236 | dev deps, 51 updates             | MERGEABLE       | CLEAN, fully green                                     | Green, but **one latent defect** (see below) |
| #216 | `actions/setup-node` 6→7         | MERGEABLE       | green                                                  | Ready                                        |
| #215 | `actions/setup-python` 6→7       | MERGEABLE       | green (1 cancelled)                                    | Ready                                        |
| #214 | `actions/setup-go` 6→7           | MERGEABLE       | green (1 cancelled)                                    | Ready                                        |
| #213 | `pnpm/action-setup` 4→5          | MERGEABLE       | green                                                  | Ready                                        |
| #212 | `actions/upload-artifact` 6→7    | MERGEABLE       | green                                                  | Ready                                        |
| #186 | Metro cast social/business/video | **CONFLICTING** | n/a                                                    | Owner's branch, 233 files, needs rebase      |
| #167 | User assessment                  | **CONFLICTING** | n/a                                                    | Owner's branch, 84 files, needs rebase       |

`main` has no branch protection beyond a deletion rule; the `BLOCKED` merge state on
#212–#216 is the pending-review requirement from `dependabot.yml`'s `reviewers:` list,
not a failing gate.

## Part 2 — Residual bugs found

### Bug A — Angular version set is torn in half (root cause of #242's red CI)

`libs/theme-lib` specs fail with `TypeError: Cannot read properties of null (reading 'ngModule')`
in both the `Quality - test` and `Generate Coverage Report` jobs. The cause is a split
Angular version set on #242's head:

| Package                                                                                                           | On #242                              | Where it lives                     |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------- |
| `@angular/core`, `common`, `compiler`, `forms`, `platform-browser`, `platform-server`, `router`, `service-worker` | **20.3.30**                          | `dependencies` → bumped by #242    |
| `@angular/animations`                                                                                             | **20.2.4**                           | `dependencies` → _not_ bumped      |
| `@angular/platform-browser-dynamic`                                                                               | **20.2.4**                           | `dependencies` → _not_ bumped      |
| `@angular/compiler-cli`, `language-service`                                                                       | **20.2.4** on #242 / 20.3.30 on #236 | `devDependencies` → bumped by #236 |
| `@angular/build`, `@angular-devkit/*`, `@schematics/angular`                                                      | 20.2.2 on #242 / 20.3.36 on #236     | `devDependencies` → bumped by #236 |

Angular refuses to run a `TestBed` when `@angular/compiler-cli` and `@angular/core`
disagree on their patch line. #236 and #242 each hold one half of the fix, so neither
can go in alone — and the two `@angular/*` packages left at 20.2.4 are in neither PR.

### Bug B — zone.js 0.16 violates the Angular 20 peer range

#242 bumps `zone.js` `~0.15.0` → `~0.16.3`. `@angular/core@20.3.30` declares
`peerDependencies.zone.js: "~0.15.0"`. zone.js 0.16 is only sanctioned from Angular 21
onward. Dependabot read `0.15 → 0.16` as a minor bump; for a `0.x` package it is a
breaking one. This must be reverted to `~0.15.0` until the Angular 21 step lands.

### Bug C — `@angular-devkit/architect` 0.2002.2 → 0.2201.7 in #236 is a hidden major

The `0.MINOR.PATCH` scheme encodes the Angular version in the minor field. `0.2201.7`
is the **Angular 22.1.7** architect running against an Angular 20 workspace. Dependabot's
`ignore: version-update:semver-major` rule cannot see this — the leading `0` makes every
Angular release look like a minor. CI is green only because architect is barely exercised
directly; it should still be pinned back to the `0.2003.x` line matching Angular 20.3.

### Bug D — same `0.x` blind spot on `esbuild`

#236 moves `esbuild` `^0.19.2` → `^0.28.2` — nine effective majors. Worth an explicit
build smoke test rather than trusting the group.

### Bug E — dependabot group ordering makes A and C inevitable

In `.github/dependabot.yml`, `production-dependencies` and `development-dependencies`
(type-based) are declared **before** `angular-dependencies`, `nx-dependencies`, and
`nestjs-dependencies` (pattern-based). Dependabot assigns each package to the _first_
matching group, so the three framework groups never receive anything and every framework
is guaranteed to be split across the prod/dev PR boundary. This will recur every week
until the ordering is fixed.

Also noted, non-blocking: `libs/theme-models/jest.config.ts` logs
`Warning: Failed to load the ES module` on every CI run.

## Part 3 — Remediation plan for the PRs

Ordered so each step lands green.

1. **Merge the five GitHub Actions PRs** (#212–#216). Independent of npm, all green.
   Owner presses the button.
2. **Fix `.github/dependabot.yml`** on `main`: move `angular-dependencies`,
   `nx-dependencies`, `nestjs-dependencies` above the two type-based groups, and add
   `@angular-devkit/*` + `@schematics/angular` to the Angular pattern list so the whole
   Angular release train moves as one PR. Add an explicit `ignore` for `esbuild` and
   `@angular-devkit/architect` majors, which the `semver-major` rule cannot catch.
3. **Combine #236 and #242 into one branch.** They share `pnpm-lock.yaml`, so merging
   either invalidates the other's lockfile anyway. On the combined branch:
   - bump `@angular/animations` and `@angular/platform-browser-dynamic` to `20.3.30`
   - revert `zone.js` to `~0.15.0`
   - pin `@angular-devkit/architect` back to the Angular 20.3 line
   - regenerate the lockfile, run the full `test` + `lint` + `build` targets
4. **Verify the four Lighthouse jobs go green** — they failed on #242 only, which points
   at the broken build rather than a genuine perf regression.
5. Close #236 and #242 in favour of the combined branch, or push the fixes onto #242 and
   let #236 close as a subset.
6. **Rebase #186 and #167** onto `main` separately. Both are the owner's feature branches
   and out of scope for dependency work; flagging them only as stale.

Remaining judgement calls after the fixes: `class-validator` `0.14 → 0.15` (pre-1.0,
treat as breaking; DTO validation across every Nest service), `katex` `0.16 → 0.18`,
`monaco-editor` `0.54 → 0.56`, `three` `0.183 → 0.185`, `@nestjs-mcp/server` `0.3 → 0.4`.
All are `0.x` and all reached #242 through the same blind spot as Bugs C and D.

## Part 4 — Nx / Angular / NestJS upgrade assessment

### Current vs latest

|            | Current                  | Latest               | Gap      |
| ---------- | ------------------------ | -------------------- | -------- |
| Nx         | 21.5.3                   | 23.2.0               | 2 majors |
| Angular    | 20.2.4 (20.3.30 pending) | 22.1.5               | 2 majors |
| NestJS     | 11.0.x (11.2.3 pending)  | 12.0.1               | 1 major  |
| TypeScript | 5.9.3                    | 6.0.3 (7.0.2 exists) | 1 major  |
| Jest       | 29.7.0                   | 30.x                 | 1 major  |

### The binding constraints

These peer ranges dictate the whole ordering:

- `@nx/angular@22.x` peers `@angular/build: ">= 19.0.0 < 22.0.0"` — **Nx 22 cannot host
  Angular 22.** Angular 22 requires Nx 23.
- `@nx/angular@23.2.0` peers `@angular/build: ">= 20.0.0 < 23.0.0"` — Nx 23 happily hosts
  Angular 20, 21, or 22. **So Nx can go all the way to 23 before Angular moves at all.**
- `@angular/compiler-cli@21.x` peers `typescript: ">=5.9 <6.1"` — Angular 21 works on the
  current TS 5.9.3. No TS change needed for the 20→21 step.
- `@angular/compiler-cli@22.x` peers `typescript: ">=6.0 <6.1"` — **Angular 22 forces
  TypeScript 6.** This is the single largest item in the whole effort.
- `jest-preset-angular@17` (needed for Angular 22) peers `jest: "^30.0.0"` — **Angular 22
  drags Jest 29 → 30 across 127 jest configs.** `jest-preset-angular@16.x` covers Angular
  20–22 on Jest 29 and is the escape hatch for the intermediate step.
- NestJS 12 is orthogonal — it peers only on rxjs 7 and its own packages, and shares
  nothing with the Angular constraint chain.

### What makes this _easier_ than it looks

Surveying the workspace (80 apps, 59 libs):

- **1** file declares an `@NgModule`. **0** files import `@angular/platform-browser-dynamic`.
  The workspace is already fully standalone, which removes the single biggest source of
  Angular 21/22 migration pain.
- **1** file imports `@angular/animations`.
- 60 templates still use `*ngIf` / `*ngFor`. Still supported in v22 (deprecated only);
  `nx migrate` ships an automated control-flow migration.
- `nx migrate` handles the Nx 21→22→23 hops with codemods; the Nx steps are largely
  mechanical.

### What makes it hard

- **557 spec files use `TestBed`.** Any TestBed behaviour change in Angular 21/22 or the
  Jest 29→30 move multiplies across all of them. This is the dominant risk and the reason
  the Angular 22 step is materially harder than the Angular 21 step.
- **TypeScript 6** brings stricter defaults; with
  `noPropertyAccessFromIndexSignature` already on workspace-wide, expect a meaningful
  compile-error tail across 139 projects.
- **Jest 29 → 30** across 127 jest configs: `jest-environment-jsdom`, `ts-jest`,
  `@swc/jest`, and `jsdom` (currently `^29.0.1`) all move together.
- **Storybook 9.1 → 10** is implied by `@storybook/angular` tracking Angular; it is a
  separate major with its own migration.
- 80 apps × Docker image checks means the CI feedback loop on any single attempt is long.

### Recommended sequencing

Each phase is a separate PR that must be green before the next starts.

| Phase | Scope                                                                                               | Difficulty     | Notes                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| **0** | Land the fixed combined #236+#242 (Angular 20.3.x, Nx 21.6.11)                                      | Low            | Prerequisite; gets the version set coherent                                                             |
| **1** | Nx 21.6 → 22.7.9 via `nx migrate`                                                                   | **Low–Medium** | Angular untouched; codemods do most of it                                                               |
| **2** | Nx 22 → 23.2.0 via `nx migrate`                                                                     | **Low–Medium** | Unlocks Angular 22 later; still Angular-20-compatible                                                   |
| **3** | NestJS 11 → 12                                                                                      | **Medium**     | Fully independent of 1/2/4/5 — can run in parallel. ~40 backend apps, no shared constraint with Angular |
| **4** | Angular 20.3 → 21.2, `jest-preset-angular` → 16.2, zone.js → 0.16                                   | **Medium**     | TS and Jest stay put. Standalone-first codebase keeps this contained                                    |
| **5** | Angular 21 → 22.1, TypeScript 5.9 → 6.0, Jest 29 → 30, `jest-preset-angular` → 17, Storybook 9 → 10 | **High**       | The hard one. Four coupled majors; 557 TestBed specs and 127 jest configs in blast radius               |

Phases 1–4 are ordinary upgrade work. Phase 5 is the real project and deserves its own
plan once 1–4 have landed. Splitting the TS 6 move out of phase 5 is not possible —
Angular 22's `compiler-cli` hard-requires it.

Do not chase TypeScript 7 (the native port). Angular 22 pins `<6.1`.

## Open questions for the owner

1. Merge the five GitHub Actions PRs now, or hold them until the npm work settles?
2. Fix #242 in place, or open a fresh combined branch and close both dependabot PRs?
3. Is Angular 22 wanted this cycle, or is landing at Angular 21 / Nx 23 (phases 0–4) the
   right stopping point for now?
4. Should #186 and #167 be rebased as part of this, or handled separately?
