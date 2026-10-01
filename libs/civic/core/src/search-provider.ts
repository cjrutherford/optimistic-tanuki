import type { SearchProvider } from './sourcing.js';

/**
 * Web search for the sourcing engine, when one is configured.
 *
 * Search only supplies starting points. What it returns is crawled and
 * trial-read like anything else, and adopted by the same rules; a search
 * result on its own adopts nothing. The query is the town's name and state
 * and what kind of body we are looking for — nothing about any person.
 *
 * SearXNG, self-hosted on loopback (deploy/searxng), is the provider
 * (SEARCH_PROVIDER=searxng, SEARCH_URL). A Brave client exists for later
 * (SEARCH_PROVIDER=brave, SEARCH_API_KEY) and is not used unless chosen.
 * With neither configured there is no search, and the engine works from the
 * directories and official sites alone, and says so.
 */

export function searchProviderFromEnvironment(
  env: NodeJS.ProcessEnv = process.env
): SearchProvider | null {
  const provider = (
    env['SEARCH_PROVIDER'] ?? (env['SEARCH_URL'] ? 'searxng' : '')
  ).toLowerCase();
  if (!provider) return null;
  if (provider === 'searxng') {
    const url = env['SEARCH_URL']?.trim();
    if (!url)
      throw new Error(
        'SEARCH_PROVIDER=searxng needs SEARCH_URL, for example http://127.0.0.1:8980'
      );
    return searxngSearch(url);
  }
  if (provider === 'brave') {
    const key = env['SEARCH_API_KEY']?.trim();
    if (!key) throw new Error('SEARCH_PROVIDER=brave needs SEARCH_API_KEY');
    return braveSearch(key);
  }
  throw new Error(`SEARCH_PROVIDER=${provider} is not supported; use searxng`);
}

/**
 * A SearXNG instance's JSON API. Engines that answered with a CAPTCHA or a
 * block are reported by SearXNG as unresponsive and suspended there; their
 * absence is passed on as it is, never worked around.
 */
export function searxngSearch(
  baseUrl: string,
  fetcher: typeof fetch = fetch
): SearchProvider {
  const base = baseUrl.replace(/\/+$/u, '');
  return {
    name: 'searxng',
    async search(query: string) {
      const url = new URL(`${base}/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('language', 'en-US');
      url.searchParams.set('categories', 'general');
      url.searchParams.set('safesearch', '0');
      const response = await fetcher(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok)
        throw new Error(`search failed: HTTP ${response.status}`);
      const body = (await response.json()) as {
        results?: { url?: string; title?: string }[];
      };
      return (body.results ?? [])
        .filter(
          (result): result is { url: string; title?: string } =>
            typeof result.url === 'string' && /^https?:\/\//u.test(result.url)
        )
        .map((result) => ({ url: result.url, title: result.title ?? '' }));
    },
  };
}

export function braveSearch(
  apiKey: string,
  fetcher: typeof fetch = fetch
): SearchProvider {
  return {
    name: 'brave',
    async search(query: string) {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', '10');
      url.searchParams.set('country', 'us');
      const response = await fetcher(url, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok)
        throw new Error(`search failed: HTTP ${response.status}`);
      const body = (await response.json()) as {
        web?: { results?: { url?: string; title?: string }[] };
      };
      return (body.web?.results ?? [])
        .filter(
          (result): result is { url: string; title?: string } =>
            typeof result.url === 'string'
        )
        .map((result) => ({ url: result.url, title: result.title ?? '' }));
    },
  };
}
