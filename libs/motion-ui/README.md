# Motion UI

`motion-ui` contains reusable animation and interaction primitives for Angular clients. Its source lives under `libs/motion-ui/src/lib`.

## Repo Role

- shared motion and transition presentation
- frontend companion library for richer interaction states across apps

## Nx Commands

```bash
pnpm exec nx build motion-ui
pnpm exec nx test motion-ui
pnpm exec nx run motion-ui:build-storybook
```

## API Reference

- generated Compodoc: `/docs/api/motion-ui`

## Personality scene host

`<otui-personality-scene>` renders the scene that suits the active personality, so an app shell no longer hard-codes one scene or re-implements reduced-motion detection.

```html
<otui-personality-scene height="100vh" fallbackScene="aurora-ribbon" />
```

Inputs: `height`, `fallbackScene`, `speed`, `intensity`, `density` (1-10), `prefer` (index into the personality's scene list, 0 by default) and `reducedMotion` (defaults to the OS setting). The host is `aria-hidden` and pauses its scene while offscreen.

Provide the personality once in the app providers:

```ts
provideScenePersonality(() => inject(ThemeService).personality$);
```

motion-ui does not depend on theme-lib, so the app supplies the observable. Without it the host shows `fallbackScene`.

### Fallback

The scene comes from the personality's `motion.scenes`, filtered to kinds the registry knows. `prefer` picks from that list, else the first entry. `fallbackScene` applies when the list is empty or names no known scene, which includes `foundation` (its list is empty). If `fallbackScene` is unset, nothing renders in that case.

### Scene contract

- Kinds are the keys of `SCENE_REGISTRY` (`scene-registry.ts`). Personalities name them as strings in `motion.scenes`.
- Every scene takes `height`, `speed`, `intensity` and `reducedMotion`. `density` is mapped to each scene's own input (`count`, `ringCount`) or dropped where it does not apply.
- Scenes use theme colours only and pause when the host has `.is-offscreen`. One scene per view is the budget.

### Presence measurement

`tools/personality-baseline/presence.mjs` checks that each scene is visible and visibly moves, in light and dark, under its lead personality. Content must be 4-30 and motion 0.5-10 (0-255 luminance). It exits 1 when a scene is outside the band. Build the storybook with `nx build-storybook motion-ui --outputDir=/tmp/motion-ui-sb`, then run `node presence.mjs --storybook /tmp/motion-ui-sb`. See `tools/personality-baseline/README.md`.

### Removed

`murmuration` and its `three` dependency are gone. `flock-field` replaces it. Business sites that still set the legacy `'murmuration-scene'` name render `flock-field`.
