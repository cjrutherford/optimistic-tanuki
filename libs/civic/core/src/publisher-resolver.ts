import type { HttpClient } from './types.js';

/**
 * Find the publisher's own URL for a headline seen in a news aggregate.
 *
 * Aggregate feeds name the publisher's site next to each headline, but their
 * article links lead back to the aggregator. Instead of decoding those links
 * through the aggregator, the headline is looked up where the publisher lists
 * its own stories: news sitemaps, sitemaps and feed. The publisher's
 * robots.txt decides first: rules written for AI crawlers (or for everyone)
 * that disallow the site or the article path leave the item snippet-only.
 */

/** Crawler names whose robots.txt rules this pipeline follows, most specific first. */
export const AI_CRAWLER_AGENTS = [
  'anthropic-ai',
  'claudebot',
  'claude-web',
] as const;
const OWN_AGENT = 'civic-pipeline';
const MAX_LISTING_FETCHES = 6;
const LISTING_MAX_BYTES = 3 * 1024 * 1024;
const LISTING_TIMEOUT_MS = 15_000;
export const HEADLINE_MATCH_THRESHOLD = 0.7;

interface RobotsRule {
  allow: boolean;
  path: string;
}
interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

export interface PublisherRobots {
  url: string;
  sitemaps: string[];
  /** Rules that apply to this pipeline: AI-crawler groups when present, else the default group. */
  rules: RobotsRule[];
  /** True when the applicable rules came from a group naming an AI crawler or this pipeline. */
  namedGroup: boolean;
}

export function parseRobots(text: string, robotsUrl: string): PublisherRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.replace(/#.*$/u, '').trim();
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/u);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current || (field !== 'allow' && field !== 'disallow')) continue;
    // An empty Disallow allows everything; it adds no rule.
    if (value) current.rules.push({ allow: field === 'allow', path: value });
  }
  const named = groups.filter((group) =>
    group.agents.some(
      (agent) =>
        (AI_CRAWLER_AGENTS as readonly string[]).includes(agent) ||
        agent.startsWith(OWN_AGENT)
    )
  );
  const chosen = named.length
    ? named
    : groups.filter((group) => group.agents.includes('*'));
  return {
    url: robotsUrl,
    sitemaps,
    rules: chosen.flatMap((group) => group.rules),
    namedGroup: named.length > 0,
  };
}

function rulePattern(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/gu, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`, 'u');
}

/** Standard robots matching: the longest matching rule wins, Allow on a tie. */
export function robotsAllows(
  robots: PublisherRobots,
  pathAndQuery: string
): boolean {
  let best: RobotsRule | null = null;
  for (const rule of robots.rules) {
    if (!rulePattern(rule.path).test(pathAndQuery)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow)
    )
      best = rule;
  }
  return best ? best.allow : true;
}

export interface ListedArticle {
  url: string;
  title?: string;
  listing?: string;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;|&#039;|&#39;/gu, "'")
    .replace(/&#(\d+);/gu, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .trim();
}

function tagValue(block: string, tag: string): string | undefined {
  const match = block.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'u')
  );
  return match ? decodeXml(match[1]) : undefined;
}

/** Entries from a urlset sitemap, a sitemap index (as child sitemaps), or an RSS/Atom feed. */
export function parseListing(xml: string): {
  articles: ListedArticle[];
  childSitemaps: string[];
} {
  if (/<sitemapindex\b/u.test(xml)) {
    return {
      articles: [],
      childSitemaps: [...xml.matchAll(/<sitemap\b[\s\S]*?<\/sitemap>/gu)]
        .map((m) => tagValue(m[0], 'loc'))
        .filter((url): url is string => Boolean(url)),
    };
  }
  if (/<urlset\b/u.test(xml)) {
    return {
      articles: [...xml.matchAll(/<url\b[\s\S]*?<\/url>/gu)].flatMap((m) => {
        const url = tagValue(m[0], 'loc');
        const title = tagValue(m[0], 'news:title');
        return url ? [{ url, ...(title ? { title } : {}) }] : [];
      }),
      childSitemaps: [],
    };
  }
  const items = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gu)].flatMap(
    (m) => {
      const title = tagValue(m[0], 'title');
      const link =
        tagValue(m[0], 'link') ||
        m[0].match(/<link\b[^>]*href="([^"]+)"/u)?.[1];
      return link
        ? [{ url: decodeXml(link), ...(title ? { title } : {}) }]
        : [];
    }
  );
  return { articles: items, childSitemaps: [] };
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'at',
  'by',
  'with',
  'from',
  'is',
  'are',
  'was',
  'as',
  'its',
  'after',
]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/gu, '')
      .toLowerCase()
      .replace(/['’‘`]/gu, '')
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  );
}

function slugTokens(url: string): Set<string> {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    // The last segment that reads as words; ids and dates are dropped by length.
    const slug =
      [...segments]
        .reverse()
        .find((segment) => /[a-z]{3,}-[a-z]{2,}/iu.test(segment)) ?? '';
    return new Set(
      [...tokens(slug.replace(/\.[a-z]+$/iu, ''))].filter(
        (token) => !/^\d+$/u.test(token)
      )
    );
  } catch {
    return new Set();
  }
}

/** Shared-word score between a headline and a listed article: 1 is identical. */
export function headlineScore(
  headline: string,
  article: ListedArticle
): number {
  const wanted = tokens(headline);
  const found = article.title ? tokens(article.title) : slugTokens(article.url);
  if (!wanted.size || !found.size) return 0;
  let shared = 0;
  for (const token of wanted) if (found.has(token)) shared += 1;
  return shared / Math.max(wanted.size, found.size);
}

export function bestHeadlineMatch(
  headline: string,
  articles: readonly ListedArticle[]
): ListedArticle | null {
  let best: ListedArticle | null = null;
  let bestScore = 0;
  for (const article of articles) {
    const score = headlineScore(headline, article);
    if (score > bestScore) {
      best = article;
      bestScore = score;
    }
  }
  return bestScore >= HEADLINE_MATCH_THRESHOLD ? best : null;
}

export type PublisherResolution =
  | { kind: 'found'; url: string; listing: string }
  | { kind: 'blocked'; robotsUrl: string; reason: string }
  | { kind: 'not-found'; reason: string };

interface PublisherIndex {
  robots: PublisherRobots | null;
  articles: ListedArticle[];
  listings: string[];
  error?: string;
}

// One lookup per publisher per client: every headline from that site reuses it.
const indexes = new WeakMap<HttpClient, Map<string, Promise<PublisherIndex>>>();

async function fetchText(
  client: HttpClient,
  url: string
): Promise<string | null> {
  try {
    const response = await client.fetch(url, {
      headers: { 'User-Agent': 'civic-pipeline/0.1 (civic intelligence POC)' },
      signal: AbortSignal.timeout(LISTING_TIMEOUT_MS),
      maxBytes: LISTING_MAX_BYTES,
      timeoutMs: LISTING_TIMEOUT_MS,
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function listingPriority(url: string): number {
  return /news/iu.test(url) ? 0 : /post|article|story/iu.test(url) ? 1 : 2;
}

async function loadIndex(
  client: HttpClient,
  origin: string
): Promise<PublisherIndex> {
  const robotsUrl = `${origin}/robots.txt`;
  const robotsText = await fetchText(client, robotsUrl);
  const robots =
    robotsText === null ? null : parseRobots(robotsText, robotsUrl);
  if (robots && !robotsAllows(robots, '/'))
    return { robots, articles: [], listings: [] };
  const queue = [
    ...[...(robots?.sitemaps ?? [])].sort(
      (a, b) => listingPriority(a) - listingPriority(b)
    ),
    `${origin}/feed/`,
  ];
  const articles: ListedArticle[] = [];
  const listings: string[] = [];
  let fetches = 0;
  while (queue.length && fetches < MAX_LISTING_FETCHES) {
    const url = queue.shift()!;
    if (listings.includes(url)) continue;
    fetches += 1;
    const xml = await fetchText(client, url);
    listings.push(url);
    if (!xml) continue;
    const parsed = parseListing(xml);
    articles.push(
      ...parsed.articles.map((article) => ({ ...article, listing: url }))
    );
    // Sitemap indexes: news children first, then the first-listed (usually newest).
    queue.unshift(
      ...[...parsed.childSitemaps]
        .sort((a, b) => listingPriority(a) - listingPriority(b))
        .slice(0, 2)
    );
  }
  return { robots, articles, listings };
}

function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export async function resolvePublisherArticle(
  input: { headline: string; publisherHome: string },
  client: HttpClient
): Promise<PublisherResolution> {
  const origin = originOf(input.publisherHome);
  if (!origin)
    return {
      kind: 'not-found',
      reason: 'publisher site is not an http(s) URL',
    };
  let perClient = indexes.get(client);
  if (!perClient) {
    perClient = new Map();
    indexes.set(client, perClient);
  }
  let pending = perClient.get(origin);
  if (!pending) {
    pending = loadIndex(client, origin);
    perClient.set(origin, pending);
  }
  const index = await pending;
  if (index.robots && !robotsAllows(index.robots, '/')) {
    return {
      kind: 'blocked',
      robotsUrl: index.robots.url,
      reason: index.robots.namedGroup
        ? "the publisher's robots.txt disallows AI crawlers"
        : "the publisher's robots.txt disallows crawling",
    };
  }
  const match = bestHeadlineMatch(
    input.headline,
    index.articles.filter(
      (article) =>
        originOf(article.url) === origin ||
        originOf(article.url)?.replace('://www.', '://') ===
          origin.replace('://www.', '://')
    )
  );
  if (!match)
    return {
      kind: 'not-found',
      reason: `headline not found in ${index.listings.length} publisher listing(s)`,
    };
  const path = new URL(match.url);
  if (
    index.robots &&
    !robotsAllows(index.robots, `${path.pathname}${path.search}`)
  ) {
    return {
      kind: 'blocked',
      robotsUrl: index.robots.url,
      reason: "the publisher's robots.txt disallows this article path",
    };
  }
  return { kind: 'found', url: match.url, listing: match.listing ?? origin };
}
