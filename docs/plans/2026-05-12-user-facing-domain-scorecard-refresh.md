# User-Facing Domain Scorecard Refresh

**Date:** 2026-05-12

## Re-Audit Criteria

A domain only earns a `5` when all of the following are true:

- owner/user and app-scope boundaries are enforced in gateway or service code
- at least one request-level or denial-path test proves the boundary
- owner-console or client-interface surfaces exist for the relevant governed workflow
- the mutation matrix does not still mark the core mutation surface as `partial` or `missing`
- the score is backed by implementation and tests, not docs-only intent

## Scorecard

| Domain        | Rating | Status                 | Why                                                                                                                                                                                                                                                          |
| ------------- | ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Governance    | 4/5    | Improved, not complete | Core user/role/permission/app-scope mutation flows are implemented, but role-permission attach/detach is still `partial` in the mutation matrix because owner-console has no UI flow for it.                                                                 |
| Experience    | 4/5    | Improved, not complete | App configuration CRUD is implemented, but theme persistence is still explicitly `partial` and not backed by a real backend mutation surface.                                                                                                                |
| Commerce      | 4/5    | Improved, not complete | Business-site/store governance boundaries and booking flows are better covered, but resource create/update/delete is still `missing` in owner-console and the planned shared catalog-readiness helper is not present in `libs/business-data-access/src/lib`. |
| Community Ops | 4/5    | Improved, not complete | Community/city governance and manager workflows are materially stronger, but social/forum governance still exists only as owner-console shells with `partial` matrix rows and no routed moderation mutations.                                                |

## Domain Evidence

### Governance

- Mutation matrix evidence:
  - `apps/owner-console/src/app/owner-console-mutation-matrix.ts:80`
  - `apps/owner-console/src/app/owner-console-mutation-matrix.ts:93`
- What is complete:
  - User role assignment/unassignment, role CRUD, permission CRUD, and app-scope CRUD are all marked `complete` in `apps/owner-console/src/app/owner-console-mutation-matrix.ts:17`.
- Remaining blocker:
  - Role permission add/remove is still `partial` because the endpoint exists but owner-console does not expose the workflow: `apps/owner-console/src/app/owner-console-mutation-matrix.ts:80`.

### Experience

- Mutation matrix evidence:
  - `apps/owner-console/src/app/owner-console-mutation-matrix.ts:177`
  - `apps/owner-console/src/app/owner-console-mutation-matrix.ts:214`
- What is complete:
  - App configuration create/update/delete are marked `complete` in `apps/owner-console/src/app/owner-console-mutation-matrix.ts:177`.
- Remaining blocker:
  - Theme persistence is still `partial` because the workspace remains proof-of-concept and does not persist through a backend service: `apps/owner-console/src/app/owner-console-mutation-matrix.ts:214`.

### Commerce

- Gateway and request-contract evidence:
  - `apps/gateway/src/controllers/trainer/trainer.controller.spec.ts:334`
  - `apps/gateway/src/controllers/trainer/trainer.controller.spec.ts:441`
  - `apps/gateway/src/controllers/trainer/trainer.controller.spec.ts:499`
  - `apps/gateway/src/guards/permissions.guard.spec.ts:248`
  - `apps/gateway/src/guards/permissions.guard.spec.ts:339`
- Owner-console and matrix evidence:
  - `apps/owner-console/src/app/operator-workspaces.ts:111`
  - `apps/owner-console/src/app/owner-console-mutation-matrix.ts:263`
  - `apps/owner-console/src/app/owner-console-mutation-matrix.ts:396`
- What is complete:
  - Business-site catalog-source updates are explicitly permission-scoped to `business-site.catalog.update` with request-contract and guard coverage.
  - Product/order/appointment/availability governance surfaces are marked `complete` in the matrix.
- Remaining blockers:
  - Resource create/update/delete remains `missing` in owner-console: `apps/owner-console/src/app/owner-console-mutation-matrix.ts:396`.
  - The Task 1 plan called for `libs/business-data-access/src/lib/catalog-readiness.ts`, but `libs/business-data-access/src/lib/` currently does not contain that helper, so the readiness policy is not yet centralized as planned.

### Community Ops

- Owner-console route and workspace evidence:
  - `apps/owner-console/src/app/app.routes.spec.ts:4`
  - `apps/owner-console/src/app/app.routes.spec.ts:30`
  - `apps/owner-console/src/app/operator-workspaces.ts:164`
- Gateway and guard evidence:
  - `apps/gateway/src/controllers/communities/communities.controller.spec.ts:52`
  - `apps/gateway/src/guards/permissions.guard.spec.ts:404`
  - `apps/gateway/src/guards/permissions.guard.spec.ts:451`
  - `apps/gateway/src/controllers/social/social.controller.test.ts:114`
  - `apps/gateway/src/controllers/forum/forum.controller.spec.ts:65`
  - `apps/gateway/src/controllers/social/notification/notification.controller.spec.ts:112`
  - `apps/gateway/src/controllers/profile/profile.controller.spec.ts:285`
- UI isolation and denial-path evidence:
  - `apps/client-interface/src/app/components/social/feed.component.spec.ts:190`
  - `libs/notification-ui/src/lib/notification.service.spec.ts:226`
  - `libs/search-ui/src/lib/search.service.spec.ts:263`
  - `apps/owner-console/src/app/components/community-members.component.spec.ts:76`
  - `apps/owner-console/src/app/components/city-management.component.spec.ts:63`
  - `apps/owner-console/src/app/components/city-editor.component.spec.ts:87`
  - `docs/plans/2026-05-12-community-ops-domain-refresh.md:1`
- What is complete:
  - Community manager appointment/revocation, city governance denial handling, social post identity normalization, forum acting-identity propagation, notification stream isolation, search-history scoping, and profile privacy boundary checks all have direct implementation and test evidence.
- Remaining blockers:
  - Social governance shell is still `partial`: `apps/owner-console/src/app/owner-console-mutation-matrix.ts:435`.
  - Forum governance shell is still `partial`: `apps/owner-console/src/app/owner-console-mutation-matrix.ts:448`.
  - These shells document the governance surface, but report triage and forum moderation actions are not yet routed through owner-console.

## Overall Assessment

- The re-audit does not justify any domain moving to `5` yet.
- The recent passes materially improved request-level isolation, denial-path proof, and governance visibility.
- The highest-confidence outcome is that all four user-facing domains are stronger, but each still has at least one explicit implementation gap recorded in the mutation matrix or the plan artifacts.

## Next Blockers To Clear For `5`

1. Governance: implement owner-console role-permission attach/detach flows.
2. Experience: back theme changes with a real persistence API and tests.
3. Commerce: add owner-console resource CRUD and centralize catalog readiness into the planned shared helper.
4. Community Ops: replace social/forum governance shells with real moderation/report workflows and tests.
