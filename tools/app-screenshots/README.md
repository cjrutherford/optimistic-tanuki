# app-screenshots

Review screenshots of a built frontend app: light/dark x desktop (1440x900) / mobile (390x844) for its unauthenticated routes.

    export PATH=$HOME/.local/share/pnpm:$PATH
    nx build <app> -c development            # if dist/apps/<app> is missing or stale
    node tools/app-screenshots/capture.mjs --app <name> [--out /tmp/app-review] [--gateway http://127.0.0.1:PORT] [--routes /a,/b] [--dist <dir>]
    node tools/app-screenshots/gallery.mjs   # writes /tmp/app-review/index.html from every */meta.json

- Serves dist/apps/<app>/browser with SPA fallback. `/api`, `/admin-api`, `/socket.io`, `/chat`, `/social` are proxied to the gateway (auto-detected from a running docker container with "gateway" in its name and a port mapped to 3000, or `--gateway`); absolute `http://localhost:3000/*` calls are rerouted there too. With no gateway, API calls return 502 and are recorded as failed requests.
- Routes come from `apps.mjs` (add an entry per app: `routes` plus `skipped` auth routes). Unknown apps capture `/` only.
- Mode: the app's default personality is read from a clean load (`personality-*` body class), then the saved theme key `optimistic-tanuki-personality-theme` is seeded with that personality, the default primary and the mode; `prefers-color-scheme` is emulated as well. The personality is never forced.
- meta.json records personality, mode applied, console errors, failed requests and readability failures (`renderedContrastFailures`, copied from tools/personality-baseline).
