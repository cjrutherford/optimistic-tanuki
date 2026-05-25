# hai-ui Architecture

`hai-ui` is a small shared Angular library that packages the HAI identity surface used across apps. It combines standalone UI components with link-resolution helpers so applications can show HAI branding, explain what the app is, and cross-link to other HAI apps.

## Main Building Blocks

- `HaiAboutTagComponent`: compact trigger that toggles the about modal
- `HaiAboutModalComponent`: tabbed modal for app details, HAI copy, and related-app links
- `HaiExpansionComponent`: small utility component that displays a rotating HAI expansion string
- `HaiAppDirectoryService`: fetches app configuration from `/api/app-config` and resolves app links
- `hai-app.directory.ts`: static registry and link-resolution helpers
- `hai-app.config.ts`: public config and link interfaces

## Integration Shape

The main component contract is `HaiAboutConfig`:

- `appId`
- `appName`
- `appTagline`
- `appDescription`
- optional `appUrl`
- optional `logoSrc`

Consumers usually bind that config into `hai-about-tag`, which then opens `hai-about-modal` as needed.

## Runtime Behavior

- app links are resolved from `/api/app-config`
- if a public domain is active, links point to the deployed app
- if no public domain is active, links fall back to the repository URL
- the modal excludes the current app from the related-app list

This makes the library useful in both deployed and local or partial environments.
