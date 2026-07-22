# Mobile (Android / iOS) Builds with Capacitor

The Angular client apps declared in `tools/registry/apps.production.sample.yaml`
can be packaged as native Android/iOS apps using [Capacitor](https://capacitorjs.com)
(v8, installed at the workspace root). The registry is the source of truth for
which apps get a mobile shell and what identity/URLs they use.

## How it fits together

1. **Registry** — an app opts in with a `mobile` block (validated by the Go CLI
   in `tools/registry`):

   ```yaml
   mobile:
     enabled: true
     bundleId: com.forgeofwill.app # reverse-DNS Android applicationId / iOS bundle id
     project: forgeofwill # optional Nx project override; defaults to appId
     appName: Forge of Will # optional display-name override; defaults to name
   ```

2. **Generator** — `node tools/mobile/generate-capacitor.mjs` reads the registry
   and writes, per mobile-enabled client app:

   - `apps/<project>/capacitor.config.ts` — Capacitor config pointing at
     `dist/apps/<project>/browser` (regenerated every run).
   - `apps/<project>/src/environments/app-env.mobile.ts` — absolute
     `apiBaseUrl`/`socketUrl` baked from the registry (regenerated every run).
   - `apps/<project>/src/environments/app-env.ts` — web defaults (`/api`,
     relative sockets); created once, never overwritten.

   Use `--check` in CI to fail if generated files are stale, and
   `--registry <path>` to point at a different registry file.

3. **App wiring** (one-time, per app) — the app's `app.config.ts` imports
   `APP_ENV` from `../environments/app-env` and uses it for the `API_BASE_URL`
   provider and socket host/path fallbacks. Hydration providers are skipped when
   `APP_ENV.mobile` is true (the mobile bundle is pure CSR). See
   `apps/forgeofwill/src/app/app.config.ts` for the reference implementation.

4. **Build configuration** (one-time, per app) — a `mobile` configuration on the
   `build` target produces a static, non-SSR bundle with the env file replaced:

   ```jsonc
   "mobile": {
     "outputMode": "static",
     "server": false,
     "ssr": false,
     "outputHashing": "all",
     "budgets": [ /* same as production */ ],
     "fileReplacements": [
       {
         "replace": "apps/<project>/src/environments/app-env.ts",
         "with": "apps/<project>/src/environments/app-env.mobile.ts"
       }
     ]
   }
   ```

5. **Gateway CORS** — when any registry app is mobile-enabled, the gateway
   trusts the Capacitor webview origins `https://localhost` (Android) and
   `capacitor://localhost` (iOS). See `apps/gateway/src/bootstrap/security.ts`.
   The deployed registry JSON must be regenerated from the YAML for this to
   take effect at runtime. Auth already uses Bearer tokens (not cookies), so no
   credential changes are needed for webview contexts.

## Onboarded apps

forgeofwill, client-interface (Optimistic Tanuki), fin-commander, and local-hub
(Towne Square) are fully onboarded with committed `android/` and `ios/`
projects. Debug APKs build with:

```bash
cd apps/<project>/android
JAVA_HOME=/opt/android-studio/jbr ANDROID_HOME=$HOME/Android/Sdk ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

The Gradle template compiles at Java 21; use a JDK 21 (e.g. Android Studio's
bundled JBR as above) — the system JDK 17 is too old and JDK 25 is newer than
Gradle 8.14 supports. Release builds additionally need a signing config.

## Day-to-day workflow

```bash
# Regenerate mobile scaffolding after registry changes
node tools/mobile/generate-capacitor.mjs

# Build the mobile web bundle and copy it into the native projects
pnpm exec nx run forgeofwill:mobile-sync
# (equivalent to: nx build forgeofwill -c mobile && cd apps/forgeofwill && cap sync)

# Open / build native projects
cd apps/forgeofwill
pnpm exec cap open android   # requires Android Studio + SDK
pnpm exec cap open ios       # requires macOS + Xcode
```

The native projects live at `apps/<project>/android` and `apps/<project>/ios`
and are committed. The web assets `cap sync` copies into them
(`android/app/src/main/assets/public`, `ios/App/App/public`, and the derived
`capacitor.config.json`) are gitignored — they are regenerated from `dist` on
every sync. `apps/*/android` and `apps/*/ios` are excluded from ESLint.

Native toolchains are **not** required for the web-side workflow: `cap add` /
`cap sync` run anywhere (Capacitor 8 uses Swift Package Manager, so even the
iOS scaffold generates on Linux). Compiling the APK/IPA requires the Android
SDK or Xcode respectively.

## Dev mode on the Android emulator

```bash
tools/mobile/dev-android.sh <project> [--avd <name>] [--port <port>]
```

where `<project>` is one of: `forgeofwill`, `client-interface`, `fin-commander`, or `local-hub`.
The script defaults to port 4200 and the first available AVD.

**What it does:**

1. Boots an Android emulator if none is running (or uses `--avd <name>` to select one)
2. Starts `nx serve <project> --configuration mobile-dev`
3. Syncs and runs the app, setting `CAP_SERVER_URL=http://10.0.2.2:<port>` so the native webview loads the live dev server (10.0.2.2 = host loopback from the emulator) with live reload
4. Ctrl-C stops the dev server

**Why `mobile-dev` and not the default `development` configuration:** each
onboarded app also has a `mobile-dev` build configuration (CSR-only, same as
`mobile` but without the absolute-URL env swap, so relative `/api` calls still
go through the local proxy). This matters because with SSR on, Angular
resolves relative HttpClient calls against the _incoming request's_ own Host
header — normally correct, but during a CAP*SERVER_URL session the webview's
requests arrive with Host `10.0.2.2:<port>`, and that address only resolves
\_from inside the emulator*, not from the SSR Node process itself (which runs
on the host). Any route with a blocking SSR data fetch then hangs until
Angular's SSR timeout fires, crashing the whole page render with `TimeoutError:
The operation was aborted due to timeout` (visible in the dev server log) and
showing a `chrome-error://chromewebdata/` page in the webview. Since a
Capacitor shell doesn't use SSR at all, disabling it for dev-mode serving
sidesteps the bug entirely and matches what actually ships.

**After a dev session:**
The `CAP_SERVER_URL` override lives in the generated `capacitor.config.ts`. After you're done, run plain `cap sync` (no env var) to restore the bundled-assets config. The generated config should be committed as-is (without a dev URL hardcoded).

**Requirements:**

- An AVD (Android Virtual Device) created in Android Studio
- `ANDROID_HOME` (defaults to `~/Android/Sdk`)
- JDK 21 (defaults to `/opt/android-studio/jbr`)
- Each onboarded app needs `apps/<project>/proxy.conf.json` wired into its
  `serve` target's `options.proxyConfig` (see `apps/forgeofwill/project.json`),
  proxying `/api` to the local gateway (`:3000`) and `/socket.io` to the chat
  gateway (`:3300`). Without it the dev build's relative `/api` calls hit the
  Angular dev server itself and fail, which can look like broken/flickering UI
  rather than an obvious network error.

**Linux/Wayland environment notes** (this repo's dev machine): the script
forces `QT_QPA_PLATFORM=xcb` and adds the emulator's own `lib64`/`lib64/qt/lib`
to `LD_LIBRARY_PATH` before launching, because the emulator's Qt UI doesn't
ship a Wayland plugin and won't find its own bundled Qt libs otherwise —
without this it silently crashes on startup with "no Qt platform plugin could
be initialized," and the boot-wait loop used to hang for the full timeout
without showing why (it now detects the dead process and dumps the log).
Similarly, `nx serve` is started with `--host 0.0.0.0`: the Angular/Vite dev
server defaults to IPv6-loopback-only, but the emulator's `10.0.2.2` host
alias only maps to IPv4 loopback, so without this flag the webview gets
`ERR_CONNECTION_REFUSED` even though the emulator can reach the host fine.

If the emulator falls back to software rendering (log shows `Switching to
software rendering` / `VulkanVirtualQueue` warnings), animations and
backdrop-filter/blur-heavy UI will visibly tear even on capable hardware; try
launching with `-gpu host` to force GPU passthrough instead of the default
Vulkan-based `gfxstream` backend, which may not support your driver yet.

## Onboarding another registry app

1. Add the `mobile` block to the app's registry entry; run
   `go run ./cmd/registry validate --input apps.production.sample.yaml` from
   `tools/registry`.
2. Run `node tools/mobile/generate-capacitor.mjs`.
3. Wire `APP_ENV` into the app's `app.config.ts` (copy the forgeofwill pattern).
4. Add the `mobile` build configuration and `mobile-sync` target to the app's
   `project.json` (copy from `apps/forgeofwill/project.json`, replacing the
   project name).
5. `cd apps/<project> && pnpm exec cap add android && pnpm exec cap add ios`.
6. `pnpm exec nx run <project>:mobile-sync`.

## Publishing

### Prerequisites

- **Google Play Console developer account** — one-time $25 registration; later, an Apple Developer Program membership ($99/yr) for iOS
- **Release signing keystore per app** — generate with:

  ```bash
  keytool -genkeypair -keystore my-app.keystore -alias my-app \
    -keyalg RSA -keysize 2048 -validity 10000
  ```

  Keep keystores and passwords out of git. The `signingConfig` goes in `apps/<project>/android/app/build.gradle` (reference the Play App Signing option if preferred).

- **versionCode/versionName in build.gradle** — Google Play requires monotonically increasing `versionCode` with each release.
- **Real app icons and splash screens** via `@capacitor/assets` — currently Capacitor defaults are used.
- **Target API level** must meet Google Play's current requirement. The template targets SDK 36; keep it current.
- **Hosted privacy policy URL** and Google Play Data-safety form answers — the apps send auth tokens and user content to their backend APIs.
- **Store listing assets** — screenshots, feature graphic, descriptions for each Play Store listing.

### Objectives

1. **Signed release AABs** — build `bundleRelease` for all four onboarded apps and upload to Google Play's internal testing track.
2. **Deep-link and App Links verification** — configure each app domain and OAuth-style flows so the Play Store recognizes verified deep links.
3. **Closed testing** — test with real accounts against production APIs on internal testing devices.
4. **Production rollout** — promote from internal testing to production on Google Play.
5. **iOS parity** — build and TestFlight the committed `ios/` projects (requires macOS and Xcode) alongside the Android releases.
6. **CI packaging jobs** — automate `mobile-sync` and signed builds in the pipeline so releases don't require local toolchains.

## Known follow-ups

- SSR-only server routes (anything the Express server in `src/server.ts`
  provides beyond static assets, e.g. injected `window.env`) do not exist in the
  mobile bundle; `APP_ENV` covers API and socket URLs.
- Push notifications are not yet integrated.
