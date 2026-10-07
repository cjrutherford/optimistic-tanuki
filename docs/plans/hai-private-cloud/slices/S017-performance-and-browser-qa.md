# S017 — Performance and Browser QA

## Status

Complete

## Objective

Validate and optimize performance and browser compatibility.

## Why this slice exists

Heavy marketing imagery must not undermine the site experience.

## Dependencies

S016

## In scope

- image optimization
- lazy loading
- LCP/CLS/INP
- Chrome
- Firefox
- Safari if available
- mobile Chromium

## Out of scope

- New features
- visual redesign

## Required References

- ../06-SEO-ANALYTICS-ACCESSIBILITY.md

## Implementation Requirements

- Do not ship print-resolution assets directly.

## Acceptance Criteria

- [x] Performance is acceptable
- [x] No major browser regressions
- [x] Images optimized

## Validation

- Performance audit/build/browser smoke tests.

## Expected Files / Areas

- image assets
- page loading
- shared layout

## Completion Notes

Measured against the production build (`node dist/apps/hai/server/server.mjs`)
with a Playwright and Chrome DevTools Protocol runner. Mobile profile: 375×812,
4× CPU slowdown, 150 ms latency, 1.6 Mbps. Desktop profile: 1440×900, no
throttling. Every number below is from the rendered page, not from estimates.

### What was wrong

- **No client hydration.** `app.config.ts` lacked `provideClientHydration`,
  so the browser threw away the server-rendered page and rebuilt it once the
  JavaScript arrived (about 5–6 s on the mobile profile). That caused both
  bad metrics:
  - LCP: the text was painted again, so LCP landed at 5.9–7.8 s;
  - CLS: the contact strip jumped while the routed page was empty, a single
    shift of 0.38.
- **Unused Google Fonts.** `index.html` loaded Cormorant Garamond and Manrope,
  which nothing uses, as a render-blocking stylesheet.
- **Oversized logo.** The header logo was a 315×340 PNG (51 KB) shown at
  44×47.

### Changes

- `provideClientHydration(withEventReplay())` in `app.config.ts`, as the other
  server-rendered apps in the repo already do. No hydration errors (NG05xx) on
  any of the 13 routes.
- Removed the Google Fonts link and its preconnects from `index.html`. The
  Public Sans request that remains is the `foundation` personality's font,
  loaded by `FontLoadingService`.
- Header logo is now `assets/haidev-logo-88.webp`: 88×94, which is 2× the
  display size, and 5.9 KB. The original PNG stays because the app registry
  uses it as an icon. The replacement logo without "dev" should be exported
  the same way.
- **Drawer fix** (found during the browser pass). The open drawer is inside the
  sticky title bar (z-index 50), so the fixed "HAI" about tag (z-index 1060)
  covered the left part of the drawer's last item, Contact. While the drawer
  is open the title bar now uses `--z-index-overlay`, via the `menu-open` host
  class. A unit test covers the class.

### Results (mobile throttled; desktop in brackets)

| Metric            | Before                      | After                                                    |
| ----------------- | --------------------------- | -------------------------------------------------------- |
| LCP               | 5.9–7.8 s (0.2–0.9 s)       | 0.54–0.72 s, `/contact` 1.4 s (≤0.1 s)                   |
| CLS               | 0.38–0.41 (0.14–0.26)       | 0.009–0.087 (0.006–0.055)                                |
| TBT               | up to 1,700 ms              | 129–270 ms; `/private-cloud/assessment` 573 ms (0–12 ms) |
| INP (open menu)   | up to 312 ms                | 32–64 ms (40–112 ms)                                     |
| Third-party hosts | Google Fonts, 2 stylesheets | Google Fonts, personality font only                      |

On `/contact` the LCP element is the lazy-loaded contact banner (31 KB WebP).
At 1.4 s it is still within the "good" threshold of 2.5 s.

A cross-check with Vercel Labs `agent-browser vitals` (iPhone 14, no
throttling) agreed: LCP 76–240 ms and CLS ≤ 0.01. On this host its Chrome
needs `--no-sandbox`.

### Browser smoke tests

All 13 routes were checked in Chromium and Firefox (1440×900), mobile Chromium
(Pixel 7) and Firefox (390×844). Each route was checked for:

- a 200 response and a single visible `h1`;
- no horizontal overflow and no page errors;
- a working navigation drawer: 15 items, and tapping "Cost Comparison"
  navigates;
- on `/private-cloud/assessment`, focus moving to the error summary after an
  empty submit.

Result: 0 failures. The only console errors were 504s from the gateway, which
was deliberately offline during the test.

Using agent-browser on an iPhone 14 viewport, these worked:

- the drawer and every tap target in it;
- the about modal;
- the appearance menu and the dark-mode switch;
- the cost calculator. With $2,000 hardware, 10 setup hours, 1 support hour
  a month and $250 a month in subscriptions rising 5% a year, it shows owned
  $6,750 against subscriptions $16,953, which matches the formula.

### Validation

- `nx lint hai` and `nx test hai` pass (37 suites, 217 tests).
- `nx build hai` passes; the initial bundle is 897.86 kB raw, about 202 kB
  compressed.

## Deviations / Blockers

- **Safari/WebKit not tested.** Playwright's WebKit needs `libmanette`, which
  needs sudo to install on this host. Run
  `sudo npx playwright install-deps webkit` to enable it, or check on a real
  iPhone during S019.
- **No compression on the server.** Neither the Express server nor any nginx
  config in the repo gzips responses, so about 1 MB goes over the wire per
  page instead of about 250 KB. That is a deployment change, outside this
  slice. Recommended: turn on gzip/brotli at the proxy in front of the HAI
  pod, or add `compression` to `apps/hai/src/server.ts`. That needs a new
  dependency, so it is the owner's call.
- **Left for later:**
  - `/private-cloud/assessment` has the highest mobile TBT (573 ms), but its
    INP is fine (48 ms).
  - The contact banner could load eagerly on `/contact` only, once the shared
    contact form accepts a loading option.
- **For S020 and the logo swap:**
  - In dark mode, headings show through the translucent header while
    scrolling.
  - The blue "HAI dev" logo has low contrast on the dark background.
