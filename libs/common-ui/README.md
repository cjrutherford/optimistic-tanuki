# Common UI

`common-ui` contains shared Angular UI primitives and styles used across multiple applications. Its source lives under `libs/common-ui/src/lib/common-ui` and `libs/common-ui/src/lib/styles`.

## Repo Role

- common presentation building blocks
- reduces duplication across app-specific UI libraries

## Key Surfaces

- buttons, cards, badges, and other shared primitives
- shared style helpers under `libs/common-ui/src/lib/styles`

## Documentation

- generated API reference in `ui-playground`: `/docs/api/common-ui`
- use `pnpm exec nx run ui-playground:api-docs-content` to regenerate the curated API index

## Nx Commands

```bash
pnpm exec nx build common-ui
pnpm exec nx test common-ui
```
