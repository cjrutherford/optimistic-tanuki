# README Template

Use this shape for `apps/*/README.md` and `libs/*/README.md`.

Keep the first screen short and predictable. Put project-specific deep detail after the core sections, not before them.

## App Template

````md
# Project Name

One short paragraph explaining what the project is and where its source lives.

## Local Development

Use this section for runtime entrypoints, local URLs, required stack assumptions, or special setup.

## Repo Role

- what the project owns
- what depends on it
- whether it is part of deployment inventory, CI, or image promotion

## Nx Commands

```bash
pnpm exec nx build <project>
pnpm exec nx test <project>
pnpm exec nx serve <project>
```
````

Add extra sections only when the project needs them, for example:

- `## Environment Variables`
- `## API Surface`
- `## Features`
- `## Migrations`
- `## Troubleshooting`

## Library Template

````md
# Project Name

One short paragraph explaining what the library is and where its source lives.

## Repo Role

- what the library provides
- who should consume it
- whether it is frontend-only, backend-only, or shared

## Nx Commands

```bash
pnpm exec nx build <project>
pnpm exec nx test <project>
```
````

Add extra sections only when useful:

- `## Usage`
- `## Components`
- `## Configuration`
- `## Dependencies`
- `## Documentation`

For Angular UI libraries, prefer a short `## Documentation` section that points to:

- deeper markdown under `libs/<project>/docs/` when present
- the generated Compodoc route in `ui-playground`, for example `/docs/api/<project>`

## E2E Project Template

````md
# Project Name

One short paragraph explaining what the suite covers.

## Repo Role

- which product flow it validates
- whether it expects real services, mocks, or Docker-backed dependencies

## Running The Suite

Commands for the default path.

## Nx Commands

```bash
pnpm exec nx e2e <project>
```
````
