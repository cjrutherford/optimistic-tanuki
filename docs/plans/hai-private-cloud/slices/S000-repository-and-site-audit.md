# S000 — Repository and Site Audit

## Status

Complete

## Objective

Inspect the existing site implementation and replace planning assumptions with repository-specific facts.

## Why this slice exists

Every later slice depends on knowing the actual framework, routing, styling, testing, and deployment model.

## Dependencies

None

## In scope

- Audit framework/project structure
- Document current routes and navigation
- Document theme/design token implementation
- Identify favicon/logo source
- Identify test/build/deploy commands
- Identify analytics and forms

## Out of scope

- No feature development
- No route changes
- No redesign

## Required References

- ../00-PROJECT-CHARTER.md
- ../01-CURRENT-STATE.md
- ../05-TECHNICAL-CONSTRAINTS.md

## Implementation Requirements

- Update `../01-CURRENT-STATE.md` with concrete repository facts.
- Do not guess; cite file paths in completion notes.

## Acceptance Criteria

- [x] Current-state document is repository-specific
- [x] Build/test commands are known
- [x] Deployment path is documented
- [x] Logo source is documented

## Validation

- Run only non-mutating inspection commands plus baseline build/test if practical.

## Expected Files / Areas

- root project config
- route config
- theme files
- build/test config
- 01-CURRENT-STATE.md

## Completion Notes

Completed 2026-10-05 against `main` at `efef92fec`.

`01-CURRENT-STATE.md` now records repository facts with file paths. Sources
inspected: `apps/hai/project.json`, `apps/hai/Dockerfile`,
`apps/hai/jest.config.ts`, `apps/hai/public/`, `apps/hai/src/index.html`,
`main.ts`, `server.ts`, `styles.scss`, `app/app.config*.ts`,
`app/app.routes*.ts`, every component under `app/components/`,
`libs/theme-lib/src/lib/theme-lib/theme-defaults.ts`,
`libs/theme-models/src/lib/product-personalities.ts`,
`libs/common-ui/src/lib/common-ui/performance-monitor.ts`,
`libs/blogging-data-access/src/generated/blogging.ts`,
`libs/app-registry/src/lib/default-registry.json`, `docker-compose.yaml`,
`k8s/base/clients/hai.yaml`, `k8s/base/ingress.yaml`,
`k8s/overlays/production/kustomization.yaml`,
`.github/workflows/ci-cd.yml`, `.github/workflows/deploy.yml`.

Baseline validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx build hai`: pass (warnings only; see current-state doc).
- `nx test hai`: pass, 66 tests.
- `nx lint hai`: pass.
- `tsc -p apps/hai/tsconfig.app.json --noEmit`: pass.

Findings that change later slices:

- The site is one route with anchored sections. The IA's
  `/turn-key-appliances`, `/software-stacks`, `/cost-comparison`,
  `/custom-software`, and `/contact` are not routes. S002, S009, S010, S011,
  and the cross-linking rules in `03-INFORMATION-ARCHITECTURE.md` must target
  homepage anchors unless a slice deliberately splits sections into routes.
- Navigation has no dropdown; the IA's fallback rule applies.
- HAI theme defaults to light mode, `foundation`, primary `#204434`. Recorded
  as D008: colour comes from theme variables, and 13 literals in app SCSS are
  listed for replacement.
- All logo and favicon assets include `dev`, and there is no SVG source. The
  owner needs to supply a `dev`-free mark before brand work (S003 onward).
- Phone and email do not appear on the site at all.
- Existing defects: duplicate `id="stacks"`; the Cost Comparison nav item
  lands on the Infrastructure section, not the ROI calculator.
- No marketing analytics and no per-route SEO metadata exist; S014 and S015
  start from nothing.

Changed files:

- `docs/plans/hai-private-cloud/01-CURRENT-STATE.md`
- `docs/plans/hai-private-cloud/02-BRAND-AND-DESIGN-CONSTRAINTS.md` (D008
  pointer)
- `docs/plans/hai-private-cloud/09-DECISION-LOG.md` (D008, D009)
- `docs/plans/hai-private-cloud/README.md` (launcher path, statuses)
- `docs/plans/hai-private-cloud/slices/S000-repository-and-site-audit.md`
- `docs/plans/hai-private-cloud/slices/S019-qr-and-campaign-validation.md`
  (D009)

## Deviations / Blockers

- The live site (`hopefulaspirationsindustries.com`, 45.79.204.77) refused
  connections on port 443 from the audit environment, so production could not
  be compared with the repository. The packet's description of the current
  design (dark mode, teal/cyan/orange) may describe production or print
  material rather than this code.
- The dev and SSR servers were not started; not needed for an inspection
  slice.
