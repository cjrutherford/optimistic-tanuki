/**
 * Shared SSR host / trust-proxy configuration for Angular SSR (`server.ts`)
 * entry points.
 *
 * Reads `SSR_ALLOWED_HOSTS` (comma-separated, supports `*.example.com`
 * wildcards), falls back to the deprecated `NG_ALLOWED_HOSTS` for
 * compatibility, then derives sane defaults from any `*_UI_BASE_URL`
 * environment values (e.g. `CLIENT_INTERFACE_UI_BASE_URL`) and finally the
 * loopback dev defaults (`localhost,127.0.0.1`) so healthchecks and local
 * development keep working with no configuration.
 *
 * Adopt in an SSR app with a one-line change:
 *
 * ```ts
 * import {
 *   getSsrAllowedHosts,
 *   isTrustProxyEnabled,
 * } from '@optimistic-tanuki/common-ui/ssr-config';
 *
 * const commonEngine = new CommonEngine({
 *   allowedHosts: getSsrAllowedHosts(),
 * } as never);
 * app.set('trust proxy', isTrustProxyEnabled());
 * ```
 *
 * Never pass `allowedHosts: ['*']` in production code; explicit hosts only.
 */

export const SSR_ALLOWED_HOSTS_ENV = 'SSR_ALLOWED_HOSTS';
/** @deprecated Use `SSR_ALLOWED_HOSTS`. Still honoured as a fallback. */
export const LEGACY_ALLOWED_HOSTS_ENV = 'NG_ALLOWED_HOSTS';
export const SSR_TRUST_PROXY_ENV = 'SSR_TRUST_PROXY';

export const SSR_DEV_DEFAULT_HOSTS = ['localhost', '127.0.0.1'] as const;

export interface SsrAllowedHostsOptions {
  /** Extra base URLs (e.g. the app's own `uiBaseUrl`) to derive hosts from. */
  extraBaseUrls?: Array<string | undefined | null>;
  /** Extra registry-style entries (`{ uiBaseUrl }`) to derive hosts from. */
  registryApps?: Array<{ uiBaseUrl?: string } | undefined | null>;
}

/** Split a comma-separated hosts value, trimming entries and dropping empties. */
export function parseAllowedHostsList(
  value: string | undefined | null
): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const entry of value.split(',')) {
    const host = entry.trim();
    if (host && !seen.has(host)) seen.add(host);
  }
  return [...seen];
}

/** Extract the hostname from a URL string; returns `undefined` when invalid. */
export function hostnameFromBaseUrl(
  value: string | undefined | null
): string | undefined {
  if (!value) return undefined;
  try {
    const hostname = new URL(value.trim()).hostname.trim();
    return hostname || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the SSR host matches an allowed-hosts pattern.
 * Supports exact matches and `*.example.com` wildcard suffixes.
 */
export function matchesAllowedHost(
  host: string,
  patterns: readonly string[]
): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;
  for (const pattern of patterns) {
    const candidate = pattern.trim().toLowerCase();
    if (!candidate) continue;
    if (candidate === normalized) return true;
    if (candidate.startsWith('*.')) {
      const suffix = candidate.slice(1);
      if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolve the explicit SSR allowed hosts for this process.
 *
 * Precedence: `SSR_ALLOWED_HOSTS` > deprecated `NG_ALLOWED_HOSTS` >
 * hosts derived from `*_UI_BASE_URL` env values / `extraBaseUrls` /
 * `registryApps` > loopback dev defaults. Loopback hosts are always
 * included so container healthchecks (`http://127.0.0.1:4000/`) pass
 * without SSR warnings.
 */
export function getSsrAllowedHosts(
  env: NodeJS.ProcessEnv = process.env,
  options: SsrAllowedHostsOptions = {}
): string[] {
  const explicit =
    parseAllowedHostsList(env[SSR_ALLOWED_HOSTS_ENV]).length > 0
      ? parseAllowedHostsList(env[SSR_ALLOWED_HOSTS_ENV])
      : parseAllowedHostsList(env[LEGACY_ALLOWED_HOSTS_ENV]);

  const derived: string[] = [];
  if (explicit.length === 0) {
    for (const [key, value] of Object.entries(env)) {
      if (!/_UI_BASE_URL$/.test(key)) continue;
      const hostname = hostnameFromBaseUrl(value);
      if (hostname) derived.push(hostname);
    }
    for (const baseUrl of options.extraBaseUrls ?? []) {
      const hostname = hostnameFromBaseUrl(baseUrl);
      if (hostname) derived.push(hostname);
    }
    for (const app of options.registryApps ?? []) {
      const hostname = hostnameFromBaseUrl(app?.uiBaseUrl);
      if (hostname) derived.push(hostname);
    }
  }

  const seen = new Set<string>();
  const hosts = [...explicit, ...derived, ...SSR_DEV_DEFAULT_HOSTS];
  return hosts.filter((host) => {
    if (seen.has(host)) return false;
    seen.add(host);
    return true;
  });
}

/**
 * Whether the SSR server should trust `x-forwarded-*` proxy headers.
 * Defaults to `true` (containers sit behind a reverse proxy); set
 * `SSR_TRUST_PROXY=false` (or `0`/`no`) to explicitly opt out.
 */
export function isTrustProxyEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = env[SSR_TRUST_PROXY_ENV]?.trim().toLowerCase();
  if (!raw) return true;
  return raw !== 'false' && raw !== '0' && raw !== 'no' && raw !== 'off';
}

export interface SsrEngineOptions {
  allowedHosts: string[];
  trustProxyHeaders: boolean;
}

/**
 * Options object forwarded to `CommonEngine` / `AngularNodeAppEngine`.
 * Cast at the call site (`as never`) until the installed `@angular/ssr`
 * types declare these fields.
 */
export function getSsrEngineOptions(
  env: NodeJS.ProcessEnv = process.env,
  options: SsrAllowedHostsOptions = {}
): SsrEngineOptions {
  return {
    allowedHosts: getSsrAllowedHosts(env, options),
    trustProxyHeaders: isTrustProxyEnabled(env),
  };
}
