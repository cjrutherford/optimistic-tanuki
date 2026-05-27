# Public Package Mirroring

Optimistic Tanuki public libraries are free npm packages intended for adoption independent of the hosted platform. Source development happens in the main monorepo. Public distribution happens through a dedicated mirror repository.

## Mirror Workflow

1. Register the package in `tools/public-packages/public-packages.json`.
2. Ensure package metadata and boundaries pass `pnpm run packages:check`.
3. Validate package targets with `pnpm run packages:test` and `pnpm run packages:build`.
4. Export the mirror tree with `pnpm run packages:sync`.
5. Configure `PUBLIC_PACKAGES_MIRROR_REPO` so the source repo knows which mirror repository to sync.
6. Configure `PUBLIC_PACKAGES_MIRROR_PUSH_TOKEN` so `.github/workflows/sync-public-packages.yml` can push updates.
7. Let the mirror repository own versioning and npm publication.

## Source Repo Responsibilities

- maintain the publishable package allowlist in `tools/public-packages/public-packages.json`
- validate boundaries with `scripts/validate-publishable-packages.mjs`
- generate the mirror tree with `scripts/sync-public-packages.mjs`
- run source-side validation in `.github/workflows/release-packages.yml`
- sync the generated mirror repository tree in `.github/workflows/sync-public-packages.yml`

## Mirror Repo Responsibilities

- receive the generated package-only tree
- own Changesets versioning and release metadata
- own npm publication

`package.json` in the source repo already enforces this boundary by failing `packages:version` and `packages:publish` with instructions that versioning and publication moved to the mirror repo.
