# Chat UI

`chat-ui` provides the shared Angular chat workspace used across the repo. Its
source lives under `libs/chat-ui/src/lib`.

## What It Exposes

- `lib-chat-ui`: top-level chat workspace with sidebar + active conversation
- `lib-chat-window`: individual conversation shell
- `lib-compose-chat`: composer with Enter-to-send behavior
- shared chat types and utilities under `src/lib/types` and `src/lib/utils`

## Supported Layouts

- `layout="embedded"`: in-flow panel for pages and dashboards
- `layout="floating"`: popout conversation window with fixed-position chrome

`embedded` is the preferred host mode for workspace pages. `floating` should be
reserved for launcher-style experiences where viewport-coupled positioning is
expected.

## Design-System Rules

- Use semantic theme tokens only: `--background`, `--surface`, `--foreground`,
  `--primary`, `--on-primary`, `--border`, `--muted-foreground`, `--success`,
  `--warning`, `--danger`.
- Reuse shared `common-ui` primitives for controls and state messaging instead
  of hand-rolled button or empty-state chrome.
- Do not add `body.personality-*` styling in this library. Personality-specific
  behavior should flow through the workspace theme variables.

## Expected Inputs

- Provide `contacts` and `conversations` from the host app.
- Set `currentUserId` so sent/received message styling and status indicators are
  computed correctly.
- Use `autoOpenFirstConversation` when the host should select the first thread
  by default.

## Nx Commands

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test chat-ui
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx lint chat-ui
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx build-storybook chat-ui
```

## API Reference

- generated Compodoc: `/docs/api/chat-ui`
