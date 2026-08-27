import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Per-route render-mode strategy for business-site.
 *
 * business-site is a multi-tenant hosted platform: most routes are scoped by
 * `:siteSlug` and/or `:productId`, or gated behind an auth guard whose state
 * (`BusinessAuthService`) is stored exclusively in `localStorage` (see
 * libs/business-data-access/src/lib/business-auth.service.ts). That has two
 * consequences that drive the choices below:
 *
 * 1. `RenderMode.Prerender` needs `getPrerenderParams` to enumerate build-time
 *    values for any `:siteSlug`/`:productId` segment. Doing that would mean
 *    querying live tenant data in CI and baking a snapshot that goes stale the
 *    moment a business signs up or edits their site. That is not safe, so no
 *    parameterized route below uses Prerender.
 * 2. `localStorage` does not exist during SSR, so `businessAuthGuard` /
 *    `clientAuthGuard` always evaluate "unauthenticated" on the server and
 *    redirect to the login route -- regardless of whether the real visitor
 *    has a valid session. Server-rendering these routes therefore burns full
 *    SSR compute to produce a guard result that is not just wasted but can be
 *    actively wrong for an already-authenticated visitor doing a hard
 *    navigation. Routing them through `RenderMode.Client` sends the plain CSR
 *    shell instead (Client mode returns `index.csr.html` directly and never
 *    bootstraps the server app, so no guard runs server-side), and the guard
 *    then evaluates correctly against the real browser localStorage once
 *    hydrated. This mirrors the existing pattern in apps/fin-commander,
 *    apps/local-hub, and apps/owner-console, which all route their own
 *    tenant-scoped/authenticated app shells through RenderMode.Client.
 */
export const serverRoutes: ServerRoute[] = [
  // --- Public, dynamic, SEO-relevant content: stays Server. ---
  // Root lists live published tenant sites (BusinessApiService.listPublishedSites)
  // -- prerendering would bake a stale directory, and CSR-only would drop SEO
  // crawlability + TTFB content for a marketing/discovery page.
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  // Product + tenant landing pages fetch live, per-id/per-slug data and are
  // meant to be crawlable -- correctness and freshness require SSR, and
  // Prerender is unsafe because the slug/id space is unbounded and dynamic.
  {
    path: 'products/:productId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'sites/:siteSlug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'sites/:siteSlug/products/:productId',
    renderMode: RenderMode.Server,
  },
  // Booking availability is real-time and gated by a legitimate, HTTP-backed
  // feature guard (BusinessSiteConfigStore, not localStorage) that evaluates
  // correctly during SSR -- keep it fresh and server-rendered.
  {
    path: 'sites/:siteSlug/book',
    renderMode: RenderMode.Server,
  },

  // --- Paramless, static auth forms and email-action screens: Prerender. ---
  // These render identical markup for every visitor (no live data is fetched
  // until form submission) and have no `:siteSlug`/`:productId` segment, so
  // build-time generation is fully safe -- no getPrerenderParams needed and
  // no staleness risk.
  { path: 'auth', renderMode: RenderMode.Prerender },
  { path: 'auth/verify', renderMode: RenderMode.Prerender },
  { path: 'auth/magic-link', renderMode: RenderMode.Prerender },
  { path: 'auth/reset-password', renderMode: RenderMode.Prerender },
  { path: 'owner/register', renderMode: RenderMode.Prerender },
  { path: 'client/login', renderMode: RenderMode.Prerender },
  { path: 'client/register', renderMode: RenderMode.Prerender },

  // --- Tenant-scoped and top-level owner/client app shells: Client. ---
  // Covers the auth-gated dashboards (owner workspace, client portal, and
  // their children incl. finance/billing) plus the tenant-scoped variants of
  // the login/register forms. `:siteSlug`-parameterized forms can't safely
  // use Prerender (see file header), so they land here instead of alongside
  // the paramless forms above. The dashboards themselves rely on
  // `businessAuthGuard`/`clientAuthGuard`, which only ever see real auth
  // state client-side (see file header) -- Client mode skips the
  // always-wrong server-side guard evaluation entirely.
  { path: 'owner/**', renderMode: RenderMode.Client },
  { path: 'sites/:siteSlug/owner/**', renderMode: RenderMode.Client },
  { path: 'client/**', renderMode: RenderMode.Client },
  { path: 'sites/:siteSlug/client/**', renderMode: RenderMode.Client },

  // Fallback for anything not covered above.
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
