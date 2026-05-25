# hai-ui

`@optimistic-tanuki/hai-ui` is a shared Angular UI library for rendering HAI identity affordances, including an about tag, an about modal, rotating HAI expansions, and app-directory helpers.

## Documentation

- architecture: [`../../docs/libs/hai-ui/architecture.md`](../../docs/libs/hai-ui/architecture.md)
- usage: [`../../docs/libs/hai-ui/usage.md`](../../docs/libs/hai-ui/usage.md)
- dependency diagram: [`../../docs/libs/hai-ui/dependency-diagram.md`](../../docs/libs/hai-ui/dependency-diagram.md)
- export map: [`../../docs/libs/hai-ui/export-map.md`](../../docs/libs/hai-ui/export-map.md)
- component relationship diagram: [`../../docs/libs/hai-ui/component-relationship.md`](../../docs/libs/hai-ui/component-relationship.md)

## Public API

The library exports:

- `HaiAboutTagComponent`
- `HaiAboutModalComponent`
- `HaiExpansionComponent`
- `HaiAboutConfig`
- `HaiAppLink`
- `HaiAppDirectoryService`
- HAI directory helpers and expansion utilities

## Runtime Notes

- Angular peer dependencies: `@angular/common` and `@angular/core`
- the about components depend on `@optimistic-tanuki/common-ui`
- `HaiAppDirectoryService` calls `/api/app-config` and resolves public app links with a repository fallback
- the modal requires a `HaiAboutConfig` input and emits `close`

## Nx Commands

```bash
pnpm exec nx test hai-ui
pnpm exec nx lint hai-ui
```
