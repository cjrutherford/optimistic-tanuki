# Nx Boundaries

This workspace uses Nx for orchestration and for targeted boundary enforcement on the highest-risk domains first.

## Tag Taxonomy

```text
type:{app,feature,data-access,domain,contracts,ui,util}
scope:{auth,billing,finance,gateway,payments,permissions,leads,profile,shared,...}
platform:{server,web,shared}
visibility:{internal,publishable}
```

## Dependency Rules

- `type:app` may depend on `type:feature`, `type:data-access`, `type:domain`, `type:contracts`, `type:ui`, and `type:util`.
- `type:feature` may depend on `type:domain`, `type:data-access`, `type:contracts`, and `type:util`.
- `type:domain` may depend only on `type:contracts` and `type:util`.
- `type:contracts` may depend only on `type:util`.
- first-slice scopes (`auth`, `permissions`, `payments`, `finance`, `leads`) may depend only on their own scope plus `scope:shared`
- `platform:web` may not depend on `platform:server` libraries.
- `visibility:publishable` libraries may depend only on `visibility:publishable`, `type:contracts`, and `type:util` libraries.

## Transitional Allowlist

Boundary enforcement is being phased in. A temporary allowlist remains for foundational shared packages that are still untagged or not yet split into narrower libraries:

- `@optimistic-tanuki/database`
- `@optimistic-tanuki/encryption`
- `@optimistic-tanuki/logger`
- `@optimistic-tanuki/app-config-models`
- `@optimistic-tanuki/theme-models`
- `@optimistic-tanuki/auth-ui`
- `@optimistic-tanuki/common-ui`
- `@optimistic-tanuki/motion-ui`
- `@optimistic-tanuki/notification-ui`
- `@optimistic-tanuki/theme-lib`
- `@optimistic-tanuki/ui-models`

## First Enforced Projects

- `apps/authentication`
- `apps/gateway`
- `apps/payments`
- `apps/finance`
- `apps/leads-app`
- `libs/models`
- `libs/constants`
- `libs/permission-lib`
- `libs/auth/domain`
- `libs/permissions/domain`

This rollout keeps the first slice focused on auth, permissions, payments, finance, and leads while leaving the broader repo for follow-up tagging work.
