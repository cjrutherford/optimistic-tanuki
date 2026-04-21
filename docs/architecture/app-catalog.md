# Developer App And Package Catalog

The developer catalog describes release and billing eligibility for developer-facing apps and libraries.

It is intentionally separate from the deployment inventory in `tools/admin-env-wizard`. The deployment inventory answers runtime questions: compose service names, image names, ports, Kubernetes manifests, and service dependencies. The developer catalog answers product and package questions: who owns an app or package, whether it is internal or publishable, which release channel it uses, and whether it can be billed.

## Manifest

The source of truth is:

```text
docs/architecture/app-catalog.manifest.json
```

Each entry contains:

- `name`: app path, lib path, or package name
- `ownerDomain`: owning product/domain team
- `releaseChannel`: `alpha`, `beta`, or `stable`
- `deploymentMode`: `deployable-app`, `internal-lib`, `publishable-lib`, or `app-service`
- `billingEligibility`: one or more of `seat`, `metered`, `usage-block`, or `none`

## Validation

Run:

```bash
pnpm run catalog:check
```

The validator enforces unique entries, known enum values, and billable eligibility for `app-service` entries.

## Current Catalog Scope

The initial catalog covers the public billing/app-catalog packages, the billing and payments apps, and representative developer-facing app-service entries. Expand this manifest as more apps and libraries become publishable or billable.
