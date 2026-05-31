# Contributing

Thanks for contributing to Optimistic Tanuki.

## Before You Start

- read the contributor overview in [README.md](./README.md)
- read the product overview in [PRODUCT.md](./PRODUCT.md)
- use [docs/README.md](./docs/README.md) to find the relevant implementation and operational docs

## Local Setup

1. Install Node.js 20+, pnpm, Docker, and Docker Compose.
2. Clone the repository and run `pnpm install`.
3. Use [docs/getting-started/README.md](./docs/getting-started/README.md) for first-run setup.
4. Use [docs/devops/docker-compose.md](./docs/devops/docker-compose.md) as the canonical local workflow reference.

## Making Changes

- keep changes scoped to the problem you are solving
- prefer existing workspace patterns and libraries over one-off solutions
- update documentation when behavior, workflows, or product framing changes
- add or update tests when you change runtime behavior
- keep security and deployment implications in view for public-facing changes

## Validation Expectations

Run the most relevant existing checks for the area you changed.

Typical examples:

- `corepack pnpm exec nx lint <project>`
- `corepack pnpm exec nx test <project>`
- `corepack pnpm exec nx build <project> --configuration=development`

If you touch shared tooling or package metadata, run the corresponding repository validations documented in `package.json` and `docs/`.

## Pull Requests

- describe the user-visible or operator-visible change clearly
- note any follow-up work that is intentionally out of scope
- mention validation that you ran
- link to the relevant plan or issue when the change is part of a larger sequence

## Docs And Product Framing

Contributor docs live in this repository and should stay current.

- product and audience framing: [PRODUCT.md](./PRODUCT.md)
- implementation and operational docs: [docs/README.md](./docs/README.md)
- governance expectations: [GOVERNANCE.md](./GOVERNANCE.md)
