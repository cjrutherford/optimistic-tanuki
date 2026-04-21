# Public Package Release Workflow

Public SDK and contract packages are released separately from deployable app images.

## Publishable Packages

- `@optimistic-tanuki/billing-contracts` from `libs/billing/contracts`
- `@optimistic-tanuki/billing-sdk` from `libs/billing-sdk`
- `@optimistic-tanuki/app-catalog-contracts` from `libs/app-catalog-contracts`

These packages must stay narrow. They must not import from `apps/*`, `@optimistic-tanuki/models`, domain libraries, or data-access libraries.

## Release Mechanism

The repository uses Changesets for public package versioning and changelogs.

For a releaseable package change:

```bash
pnpm changeset
```

Then select the affected public package, choose the semver bump, and write the release note.

## Local Validation

Run this before changing package release surfaces:

```bash
pnpm run packages:test
pnpm run packages:check
pnpm run packages:build
```

## GitHub Actions

`.github/workflows/release-packages.yml` validates publishable packages on package-related pull requests.

On pushes to `main`, the workflow:

1. installs dependencies
2. tests publishable packages
3. checks public package boundaries
4. builds publishable packages
5. uses Changesets to create a version PR or publish packages

Publishing requires `NPM_TOKEN` in repository secrets. The package release workflow is intentionally separate from Docker image build and deploy workflows.
