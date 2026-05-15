# Community Ops Domain Refresh

**Scope:** Community Ops evidence gathered after explicit community governance hardening in gateway and owner-console.

## Evidence Checklist

- Gateway permission enforcement:
  - `apps/gateway/src/controllers/communities/communities.controller.ts`
  - `apps/gateway/src/controllers/communities/communities.controller.spec.ts`
- Guard-level scoped-profile proof:
  - `apps/gateway/src/guards/permissions.guard.spec.ts`
- Owner-console manager workflow:
  - `apps/owner-console/src/app/services/community.service.ts`
  - `apps/owner-console/src/app/components/community-members.component.ts`
  - `apps/owner-console/src/app/components/community-members.component.spec.ts`
- Owner-console city/community denial-path coverage:
  - `apps/owner-console/src/app/components/city-management.component.spec.ts`
  - `apps/owner-console/src/app/components/city-editor.component.spec.ts`
  - `apps/owner-console/src/app/components/community-members.component.spec.ts`

## Completed Improvements

- Community create, update, delete, invite, member-role update, and member removal mutations now require explicit permission metadata in the gateway instead of auth-only access.
- The permissions guard test suite now proves Community Ops mutations resolve against the active app-scope profile rather than an unrelated scoped profile.
- Owner-console now exposes current manager state plus appoint/revoke manager workflows from the community members screen.
- City governance remains on the shared communities API, but now has explicit Community Ops copy plus permission-aware failure coverage for create/update/delete flows.

## Remaining Risk

- This pass hardens Community Ops governance mutations and manager workflows, but it does not expand into election governance UX or broader community analytics/moderation surfaces.
- The score increase should be attributed to explicit permission enforcement and tested owner-console governance coverage, not to any new domain breadth.
