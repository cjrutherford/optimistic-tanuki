# S008 — Open-Source Stack Page

## Status

Complete

## Objective

Build `/private-cloud/open-source-stack` explaining the intended OSS stack.

## Why this slice exists

Technically curious buyers need transparency without burdening the main landing pages.

## Dependencies

S007

## In scope

- Core services
- platform/operations
- stack diagram
- configuration qualifier

## Out of scope

- Guaranteeing every product is included
- deep deployment docs

## Required References

- ../04-CONTENT-AND-MESSAGING.md
- ../02-BRAND-AND-DESIGN-CONSTRAINTS.md

## Implementation Requirements

- Clearly state exact stack varies by customer requirements.

## Acceptance Criteria

- [x] All named projects are presented accurately
- [x] Page is readable by non-specialists
- [x] Route loads

## Validation

- Build/test and responsive checks.

## Expected Files / Areas

- OSS stack page
- architecture diagram component

## Completion Notes

Completed 2026-10-06.

`/private-cloud/open-source-stack` replaces its S002 placeholder, top to
bottom:

1. **Hero:** "The open-source stack." — mature projects, none of them HAI's
   own invention. **Start an assessment** is the primary action.
2. **Configuration qualifier**, as a highlighted note directly under the
   hero: "The exact stack varies by customer… no customer automatically gets
   every service." It is repeated in the diagram caption.
3. **Core services** (new `hai-stack-list`): Files and collaboration —
   Nextcloud; Photos — Immich; Media — Jellyfin; Documents — Paperless-ngx;
   Passwords — Vaultwarden.
4. **Platform and operations:** Debian or Ubuntu Linux, Docker Compose,
   reverse proxy and TLS, WireGuard, Restic, Uptime Kuma, storage and health
   checks.
5. **Stack diagram** (reuses `hai-architecture-diagram`): how you connect →
   services → platform → storage and safety.
6. **Freedom guarantee**, linking back to `/private-cloud`.
7. **Closing panel:** Start an assessment, with Contact us as the fallback.

Readability: every item leads with a plain-language role as its heading,
then the project name, then one sentence on what it does. Accuracy: each
description states only what the project does, not versions or features we
might not deploy; Vaultwarden is described as an unofficial server
compatible with Bitwarden apps, not as Bitwarden. Named projects link to
their official sites (`rel="noopener"`); every URL was checked to resolve.
Paperless-ngx links to its GitHub repository because its docs site serves a
bot challenge to non-browser clients. Debian/Ubuntu and the two unnamed
components (reverse proxy, health checks) have no link, since no single
project site would be accurate. Copy lives in `content/private-cloud.ts`
(`STACK_*`, `CORE_SERVICES`, `PLATFORM_COMPONENTS`).

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 134 tests. New
  `open-source-stack-page.component.spec.ts` covers the single `h1`, both
  assessment actions, the qualifier wording, all five core projects in
  order, the platform projects, the Vaultwarden wording, every project link
  matching its source URL with `rel="noopener"`, role-before-project
  ordering, the diagram and caption, and the freedom section.
- `nx lint hai`, `tsc`, `nx build hai`: pass.
- Production build in Chromium at 375, 430, 768, 1024, 1440, 1920 px, light
  and dark: no overflow, no page errors. Stack lists 1 / 1 / 2 / 3 / 3 / 3;
  diagram vertical below 1200 px. `/private-cloud/home` re-checked: unchanged.
  All links reach their routes at the top of the page.

Changed files:

- `apps/hai/src/app/pages/open-source-stack/` (new page and spec)
- `apps/hai/src/app/components/private-cloud/stack-list.component.{ts,html,scss}` (new)
- `apps/hai/src/app/content/private-cloud.ts`
- `apps/hai/src/app/app.routes.ts`
- `docs/plans/hai-private-cloud/README.md`, this slice

## Deviations / Blockers

- Five core services and seven platform parts leave short last rows at
  three columns (3 + 2, 3 + 3 + 1). Accepted: they read as lists of distinct
  products, and padding the lists to fit would misstate the stack.
