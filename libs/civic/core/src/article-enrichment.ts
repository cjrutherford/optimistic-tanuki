import { resolvePublisherArticle } from './publisher-resolver.js';
import { createHash } from 'node:crypto';
import type {
  ArticleExtraction,
  ArticleProvenance,
  AggregateProvenance,
  DraftItem,
  ExtractionQuality,
  HttpClient,
  HttpResponse,
  SourceConfig,
} from './types.js';
import { OutboundPolicyError } from './outbound-policy.js';
import {
  findRestrictedPublisher,
  restrictedPublisherDomains,
} from './restricted-publishers.js';
import {
  assessEditorialText,
  extractReadableArticle,
  isReadableArticleText,
} from './readable-text.js';

export type { ArticleExtraction, ArticleProvenance } from './types.js';

export interface ArticleEnrichmentResult {
  body: string;
  originalSnippet: string;
  publisher: string | null;
  canonicalUrl: string | null;
  provenance: ArticleProvenance;
  accessMode?: 'full' | 'snippet-only';
  accessRestrictionReason?: string | null;
  restrictionPolicyUrl?: string | null;
  aggregateUrl?: string | null;
  aggregateProvenance?: AggregateProvenance | null;
  unresolvedAggregateLink?: boolean;
  observedAt?: string;
}

const AGGREGATE_DOMAINS = new Set([
  'news.google.com',
  'google.com',
  'www.google.com',
  'bing.com',
  'www.bing.com',
  'news.yahoo.com',
  'yahoo.com',
  'search.brave.com',
  'brave.com',
]);

export function normalizePublisherDomain(value: string): string | null {
  try {
    const host = new URL(value).hostname
      .toLowerCase()
      .replace(/^www\./u, '')
      .replace(/\.$/u, '');
    if (!host) return null;
    const labels = host.split('.');
    if (labels.length <= 2) return host;
    const publicSuffix = labels.slice(-2).join('.');
    const secondLevel = new Set([
      'co.uk',
      'org.uk',
      'ac.uk',
      'com.au',
      'net.au',
      'co.nz',
      'com.br',
    ]);
    return secondLevel.has(publicSuffix)
      ? labels.slice(-3).join('.')
      : labels.slice(-2).join('.');
  } catch {
    return null;
  }
}

/**
 * Remove common extracted page chrome before text is offered to synthesis.
 * This is marker-based and publisher-agnostic: publication metadata is kept,
 * while repeated navigation/recommendation tails cannot become evidence.
 */
export function cleanEditorialBody(value: string): string {
  let text = value.replace(/\s+/gu, ' ').trim();
  const publication =
    /\bPublished(?:\s+on)?\s+\d{1,2}:\d{2}\s+(?:a\.m\.|p\.m\.|am|pm)\b/iu.exec(
      text
    );
  if (publication && publication.index > 0)
    text = text.slice(publication.index);
  // Carousel controls are page chrome, including the counter variants used
  // by publisher embeds ("1/2 Swipe or click to see more"). They must never
  // become evidence tokens or appear in a synthesized citation excerpt.
  text = text
    .replace(
      /\b\d+\s*\/\s*\d+\s+swipe\s+or\s+click\s+to\s+see\s+more\b[.!…:;-]?/giu,
      ' '
    )
    .replace(/\bswipe\s+or\s+click\s+to\s+see\s+more\b[.!…:;-]?/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const chrome =
    /\b(?:Email newsletter signup|Sign up for our daily email newsletter|Most Popular\b|Sections\s+Home\b|©\s*\d{4}[^.]*Privacy Policy)/iu.exec(
      text
    );
  if (chrome && chrome.index > 0) text = text.slice(0, chrome.index).trim();
  return text;
}

/** Deterministic fail-closed gate for evidence that is only page chrome. */
export function isEditoriallyEligibleBody(
  value: string,
  kind: string = 'news',
  title = ''
): boolean {
  const text = cleanEditorialBody(value);
  const combined = `${title} ${text}`.trim();
  if (combined.length < (kind === 'news' ? 32 : 24)) return false;
  if (
    /^(?:subscribe|home|news|services|contact|about|sections|most popular)\b/iu.test(
      text
    )
  )
    return false;
  if (
    /^(?:e[-\s]?board\s+(?:site|directory)|(?:public\s+)?meeting\s+directory|(?:civic|document|meeting)\s+portal)\b/iu.test(
      combined
    )
  )
    return false;
  if (
    /\b(?:subscribe\s+home|sections\s+home|most\s+popular|e[-\s]?board\s+(?:site|directory)|navigation)\b/iu.test(
      combined
    ) &&
    combined.split(/\s+/u).length < 18
  )
    return false;
  // Page-length news text must be mostly prose; short snippets are judged by the checks above.
  if (kind === 'news') {
    const assessment = assessEditorialText(text);
    if (
      assessment.words >= 60 &&
      (assessment.proseRatio < 0.5 || assessment.menuRatio > 0.2)
    )
      return false;
  }
  return true;
}

/** Returns true for the configured restricted publishers, regardless of source kind/access mode. */
export function isRestrictedPublisher(
  publisher?: string | null,
  url?: string | null
): boolean {
  return findRestrictedPublisher(publisher, url) !== null;
}

export function isAggregateUrl(value?: string | null): boolean {
  const host = value ? normalizePublisherDomain(value) : null;
  return (
    host !== null &&
    [...AGGREGATE_DOMAINS].some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    )
  );
}

export interface PublisherAccessDecision {
  restricted: boolean;
  accessMode: 'full' | 'snippet-only';
  accessRestrictionReason: string | null;
  restrictionPolicyUrl: string | null;
  aggregateDiscovery: boolean;
  aggregateUrl: string | null;
}

/** Resolve item-level publisher policy independently of the declaring source. */
export function classifyPublisherAccess(input: {
  publisher?: string | null;
  url?: string | null;
  source?: SourceConfig;
}): PublisherAccessDecision {
  const restricted =
    isRestrictedPublisher(input.publisher ?? input.source?.name, input.url) ||
    isRestrictedPublisher(input.source?.name, input.source?.url) ||
    isRestrictedPublisher(null, input.source?.aggregateUrl);
  const configured = input.source;
  return {
    restricted,
    accessMode: restricted ? 'snippet-only' : configured?.accessMode ?? 'full',
    accessRestrictionReason: restricted
      ? configured?.accessRestrictionReason ??
        "The publisher's crawler policy blocks automated AI retrieval of the article body; only aggregate headline and snippet metadata may be used."
      : configured?.accessRestrictionReason ?? null,
    restrictionPolicyUrl: restricted
      ? configured?.restrictionPolicyUrl ?? null
      : configured?.restrictionPolicyUrl ?? null,
    aggregateDiscovery: restricted || configured?.aggregateDiscovery === true,
    aggregateUrl:
      configured?.aggregateUrl ??
      (isAggregateUrl(input.url) ? input.url ?? null : null),
  };
}

function normalizedUrl(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, '');
  return url.toString();
}

/**
 * Select a direct publisher URL only when it is explicitly carried in the
 * aggregate payload. Redirect URLs and aggregate hosts are diagnostics, not
 * article citations. This function never performs network I/O.
 */
function explicitDirectPublisherUrl(draft: DraftItem): string | null {
  // canonicalUrl/sourceUrl are preferred explicit aggregate fields. For an
  // RSS item, its link is also documented metadata and is accepted when it is
  // already a direct restricted-publisher URL. Google/Bing links are never
  // treated as direct URLs.
  const candidate =
    draft.canonicalUrl ??
    draft.sourceUrl ??
    draft.originalUrl ??
    draft.uris?.[0];
  if (!candidate || isAggregateUrl(candidate)) return null;
  const host = normalizePublisherDomain(candidate);
  if (!host || !isRestrictedPublisher(null, candidate)) return null;
  try {
    const url = normalizedUrl(candidate);
    return new URL(url).pathname === '/' ? null : url;
  } catch {
    return null;
  }
}

function usableSnippet(draft: DraftItem): string {
  return (draft.originalSnippet ?? draft.body ?? '').trim();
}

/** Apply item-level restricted publisher policy before any article enrichment. */
export function classifyArticleAccess(
  draft: DraftItem,
  source?: SourceConfig,
  observedAt = draft.observedAt
): DraftItem {
  const access = classifyPublisherAccess({
    publisher: draft.publisher,
    url:
      draft.canonicalUrl ??
      draft.sourceUrl ??
      draft.originalUrl ??
      draft.uris?.[0],
    source,
  });
  if (!access.restricted && source?.accessMode !== 'snippet-only') return draft;
  const snippet = usableSnippet(draft);
  const aggregateUrl =
    source?.aggregateUrl ??
    draft.aggregateUrl ??
    draft.originalUrl ??
    draft.uris?.[0] ??
    '';
  const directPublisherUrl = explicitDirectPublisherUrl(draft);
  const canonicalUrl = directPublisherUrl;
  const accessRestrictionReason =
    access.accessRestrictionReason ??
    "The publisher's crawler policy blocks automated AI retrieval of the article body; only aggregate headline and snippet metadata may be used.";
  const restrictionPolicyUrl = access.restrictionPolicyUrl;
  const aggregateProvenance: AggregateProvenance = {
    aggregateUrl,
    resolution: directPublisherUrl ? 'direct' : 'unresolved',
    directPublisherUrl,
    ...(observedAt ? { observedAt } : {}),
  };
  const extraction: ArticleExtraction = snippet
    ? 'snippet-fallback'
    : 'fetch-failed';
  const provenance: ArticleProvenance = {
    originalUrl:
      draft.originalUrl ?? draft.sourceUrl ?? draft.uris?.[0] ?? aggregateUrl,
    resolvedUrl:
      draft.originalUrl ?? draft.sourceUrl ?? draft.uris?.[0] ?? aggregateUrl,
    redirectChain: [],
    extraction,
    checksum: checksum(snippet),
    publisher: draft.publisher?.trim() || source?.name || null,
    accessMode: 'snippet-only',
    accessRestrictionReason,
    restrictionPolicyUrl,
    aggregateUrl,
    ...(observedAt ? { observedAt } : {}),
    canonicalUrlSource: directPublisherUrl
      ? 'aggregate-metadata'
      : 'unresolved',
    unresolvedAggregateLink: !directPublisherUrl,
  };
  return {
    ...draft,
    body: snippet,
    originalSnippet: draft.originalSnippet ?? draft.body,
    publisher: provenance.publisher,
    canonicalUrl,
    uris: [
      ...new Set([
        ...(draft.uris ?? []),
        ...(directPublisherUrl ? [directPublisherUrl] : []),
      ]),
    ],
    accessMode: 'snippet-only',
    accessRestrictionReason,
    restrictionPolicyUrl,
    aggregateDiscovery: true,
    aggregateUrl,
    aggregateProvenance,
    unresolvedAggregateLink: !directPublisherUrl,
    ...(observedAt ? { observedAt } : {}),
    articleProvenance: provenance,
    contentChecksum: provenance.checksum,
  };
}

/** Backwards-compatible descriptive alias for callers at the intake boundary. */
export const classifyRestrictedSource = classifyArticleAccess;

export const ARTICLE_FETCH_TIMEOUT_MS = 10_000;
export const ARTICLE_FETCH_MAX_BYTES = 2 * 1024 * 1024;

async function boundedText(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal
): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
    throw new Error(`article exceeds ${maxBytes} byte limit`);
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  const onAbort = () => {
    void reader.cancel('article request aborted');
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('article exceeds byte limit');
        throw new Error(`article exceeds ${maxBytes} byte limit`);
      }
      text += decoder.decode(next.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function checksum(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, '');
  return url.toString();
}

function canonicalFrom(html: string, finalUrl: string): string {
  const match =
    html.match(
      /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["']/iu
    ) ??
    html.match(
      /<meta\b[^>]*(?:property|name)=["']og:url["'][^>]*content=["']([^"']+)["'][^>]*>/iu
    );
  const candidate = match?.[1];
  if (!candidate) return normalizeUrl(finalUrl);
  const canonical = new URL(candidate, finalUrl);
  const resolved = new URL(finalUrl);
  if (canonical.origin !== resolved.origin)
    throw new Error('canonical URL origin is not allowed');
  return normalizeUrl(canonical.toString());
}

function resultFor(
  input: {
    title: string;
    snippet: string;
    publisher?: string | null;
    originalUrl: string;
  },
  body: string,
  extraction: ArticleExtraction,
  resolvedUrl: string,
  redirectChain: readonly string[],
  canonicalUrl: string | null,
  canonicalUrlSource?: ArticleProvenance['canonicalUrlSource']
): ArticleEnrichmentResult {
  const publisher = input.publisher?.trim() || null;
  return {
    body,
    originalSnippet: input.snippet,
    publisher,
    canonicalUrl,
    provenance: {
      originalUrl: input.originalUrl,
      resolvedUrl,
      redirectChain: [...redirectChain],
      extraction,
      checksum: checksum(body),
      publisher,
      ...(canonicalUrlSource ? { canonicalUrlSource } : {}),
    },
  };
}

function explicitCanonicalUrl(input: {
  canonicalUrl?: string | null;
  sourceUrl?: string | null;
}): string | null {
  const candidate = input.canonicalUrl ?? input.sourceUrl;
  if (!candidate || isAggregateUrl(candidate)) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return null;
    return normalizeUrl(parsed.toString());
  } catch {
    return null;
  }
}

export async function enrichDiscoveredArticle(
  input: {
    title: string;
    snippet: string;
    publisher?: string | null;
    originalUrl: string;
    /** Optional canonical article URL explicitly supplied by aggregate metadata. */
    canonicalUrl?: string | null;
    /** Alias used by some RSS/aggregate providers for an explicit article URL. */
    sourceUrl?: string | null;
    /** The publisher's site named by the aggregate item; the article is looked up there. */
    publisherHome?: string | null;
  },
  deps: { httpClient: HttpClient; timeoutMs?: number; maxBytes?: number },
  source?: SourceConfig,
  observedAt?: string
): Promise<ArticleEnrichmentResult> {
  // Classification happens before constructing a fetch operation. This is an
  // item-level guard, so generic full-access feeds cannot fetch a restricted
  // publisher merely because their source configuration says "full".
  if (
    isRestrictedPublisher(input.publisher ?? source?.name, input.originalUrl) ||
    isRestrictedPublisher(null, input.canonicalUrl ?? input.sourceUrl) ||
    isRestrictedPublisher(source?.name, source?.url) ||
    isRestrictedPublisher(null, source?.aggregateUrl) ||
    source?.accessMode === 'snippet-only'
  ) {
    const classified = classifyArticleAccess(
      {
        title: input.title,
        body: input.snippet,
        kind: 'news',
        originalSnippet: input.snippet,
        publisher: input.publisher,
        originalUrl: input.originalUrl,
        canonicalUrl: input.canonicalUrl ?? input.sourceUrl ?? null,
      },
      source,
      observedAt
    );
    return {
      body: classified.body,
      originalSnippet: classified.originalSnippet ?? '',
      publisher: classified.publisher ?? null,
      canonicalUrl: classified.canonicalUrl ?? null,
      provenance: classified.articleProvenance!,
      accessMode: classified.accessMode,
      accessRestrictionReason: classified.accessRestrictionReason,
      restrictionPolicyUrl: classified.restrictionPolicyUrl,
      aggregateUrl: classified.aggregateUrl,
      aggregateProvenance: classified.aggregateProvenance,
      unresolvedAggregateLink: classified.unresolvedAggregateLink,
      observedAt: classified.observedAt,
    };
  }
  const snippet = input.snippet.trim();
  const timeoutMs = deps.timeoutMs ?? ARTICLE_FETCH_TIMEOUT_MS;
  const maxBytes = deps.maxBytes ?? ARTICLE_FETCH_MAX_BYTES;
  const fallbackBody = snippet;
  let resolvedUrl = input.originalUrl;
  let redirectChain: readonly string[] = [];
  const metadataCanonicalUrl = explicitCanonicalUrl(input);
  const fallback = (
    extraction: ArticleExtraction = snippet
      ? 'snippet-fallback'
      : 'fetch-failed',
    fallbackUrl = resolvedUrl,
    fallbackChain: readonly string[] = redirectChain
  ) => {
    const aggregateOnly =
      isAggregateUrl(input.originalUrl) || isAggregateUrl(fallbackUrl);
    const canonical =
      metadataCanonicalUrl ??
      (aggregateOnly ? null : normalizeUrl(input.originalUrl));
    const result = resultFor(
      input,
      fallbackBody,
      extraction,
      fallbackUrl,
      fallbackChain,
      canonical,
      metadataCanonicalUrl
        ? 'aggregate-metadata'
        : aggregateOnly
        ? 'unresolved'
        : undefined
    );
    if (!aggregateOnly) return result;
    // A transport failure or a successful response from an aggregate host is
    // not article evidence. Preserve an explicitly supplied direct publisher
    // URL (when one exists), but never derive a canonical URL from the
    // aggregate response itself.
    const aggregateUrl = isAggregateUrl(input.originalUrl)
      ? input.originalUrl
      : fallbackUrl;
    const directPublisherUrl = metadataCanonicalUrl;
    return {
      ...result,
      accessMode: 'snippet-only' as const,
      canonicalUrl: directPublisherUrl,
      aggregateUrl,
      aggregateProvenance: {
        aggregateUrl,
        ...(observedAt ? { observedAt } : {}),
        resolution: directPublisherUrl
          ? ('direct' as const)
          : ('unresolved' as const),
        directPublisherUrl,
      },
      unresolvedAggregateLink: !directPublisherUrl,
      provenance: {
        ...result.provenance,
        aggregateUrl,
        canonicalUrlSource: directPublisherUrl
          ? ('aggregate-metadata' as const)
          : ('unresolved' as const),
        unresolvedAggregateLink: !directPublisherUrl,
      },
    };
  };

  // Aggregate article links (Google News) lead back to the aggregator, whose
  // robots.txt refuses crawlers. They are never fetched: the headline is looked
  // up on the publisher's own site instead, subject to that site's robots.txt.
  let articleUrl = input.originalUrl;
  let publisherMatch: { listing: string } | null = null;
  if (isAggregateUrl(input.originalUrl) && !metadataCanonicalUrl) {
    const resolution = input.publisherHome
      ? await resolvePublisherArticle(
          { headline: input.title, publisherHome: input.publisherHome },
          deps.httpClient
        )
      : {
          kind: 'not-found' as const,
          reason: 'the aggregate item names no publisher site',
        };
    if (resolution.kind === 'blocked') {
      const classified = classifyArticleAccess(
        {
          title: input.title,
          body: input.snippet,
          kind: 'news',
          originalSnippet: input.snippet,
          publisher: input.publisher,
          originalUrl: input.originalUrl,
        },
        source,
        observedAt
      );
      return {
        body: classified.body,
        originalSnippet: classified.originalSnippet ?? '',
        publisher: classified.publisher ?? null,
        canonicalUrl: null,
        provenance: classified.articleProvenance!,
        accessMode: 'snippet-only',
        accessRestrictionReason: `Only the aggregate headline and snippet are used: ${resolution.reason}.`,
        restrictionPolicyUrl: resolution.robotsUrl,
        aggregateUrl: classified.aggregateUrl,
        aggregateProvenance: classified.aggregateProvenance,
        unresolvedAggregateLink: true,
        observedAt: classified.observedAt,
      };
    }
    if (resolution.kind === 'not-found')
      return fallback('snippet-fallback', input.originalUrl, []);
    articleUrl = resolution.url;
    publisherMatch = { listing: resolution.listing };
  }

  const fetcher = deps.httpClient.fetch.bind(deps.httpClient);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`article fetch timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const operation = (async () => {
      const response: HttpResponse = await fetcher(articleUrl, {
        signal: controller.signal,
        timeoutMs,
        maxBytes,
        policy: {
          allowPublicCrossOriginRedirects: true,
          deniedRegistrableDomains: restrictedPublisherDomains(),
        },
      });
      // Capture transport provenance before checking status or reading the body.
      resolvedUrl = response.finalUrl;
      redirectChain = response.redirectChain;
      // A defensive transport/client can still hand us a final restricted
      // publisher target after a redirect. Refuse to consume its body before
      // checking status or calling boundedText; this protects misconfigured
      // rows that bypass source config validation.
      if (isRestrictedPublisher(null, resolvedUrl)) {
        const publisher =
          findRestrictedPublisher(null, resolvedUrl)?.names[0] ??
          normalizePublisherDomain(resolvedUrl);
        const classified = classifyArticleAccess(
          {
            title: input.title,
            body: input.snippet,
            kind: 'news',
            originalSnippet: input.snippet,
            publisher,
            originalUrl: input.originalUrl,
            canonicalUrl: input.canonicalUrl ?? input.sourceUrl ?? null,
          },
          source,
          observedAt
        );
        return {
          body: classified.body,
          originalSnippet: classified.originalSnippet ?? '',
          publisher: classified.publisher ?? null,
          canonicalUrl: classified.canonicalUrl ?? null,
          provenance: classified.articleProvenance!,
          accessMode: classified.accessMode,
          accessRestrictionReason: classified.accessRestrictionReason,
          restrictionPolicyUrl: classified.restrictionPolicyUrl,
          aggregateUrl: classified.aggregateUrl,
          aggregateProvenance: classified.aggregateProvenance,
          unresolvedAggregateLink: classified.unresolvedAggregateLink,
          observedAt: classified.observedAt,
        };
      }
      // Aggregator landing pages can return 200 and contain article-like
      // markup, but that markup is still not the publisher article. Stop
      // before reading/extracting the body and retain only the feed snippet.
      if (isAggregateUrl(resolvedUrl))
        return fallback('snippet-fallback', resolvedUrl, redirectChain);
      if (!response.ok) return fallback();
      const html = await boundedText(response, maxBytes, controller.signal);
      const canonicalUrl =
        metadataCanonicalUrl ?? canonicalFrom(html, resolvedUrl);
      const article = extractReadableArticle(html, resolvedUrl);
      if (!article) return fallback('rejected-boilerplate');
      const assessment = assessEditorialText(article.text);
      const quality: ExtractionQuality = {
        method: article.method,
        words: assessment.words,
        proseRatio: round(assessment.proseRatio),
        menuRatio: round(assessment.menuRatio),
      };
      if (!isReadableArticleText(article.text)) {
        const rejected = fallback('rejected-boilerplate');
        return {
          ...rejected,
          provenance: { ...rejected.provenance, extractionQuality: quality },
        };
      }
      const result = resultFor(
        input,
        article.text,
        'article',
        resolvedUrl,
        redirectChain,
        canonicalUrl,
        metadataCanonicalUrl
          ? 'aggregate-metadata'
          : publisherMatch
          ? 'publisher-fetch'
          : undefined
      );
      if (!publisherMatch)
        return {
          ...result,
          provenance: { ...result.provenance, extractionQuality: quality },
        };
      // Found on the publisher's site: full article evidence, with the
      // aggregate observation kept as provenance.
      return {
        ...result,
        accessMode: 'full' as const,
        aggregateUrl: input.originalUrl,
        aggregateProvenance: {
          aggregateUrl: input.originalUrl,
          ...(observedAt ? { observedAt } : {}),
          resolution: 'publisher-match' as const,
          directPublisherUrl: canonicalUrl,
          publisherListing: publisherMatch.listing,
        },
        unresolvedAggregateLink: false,
        provenance: {
          ...result.provenance,
          extractionQuality: quality,
          aggregateUrl: input.originalUrl,
          unresolvedAggregateLink: false,
        },
      };
    })();
    return await Promise.race([operation, timeout]);
  } catch (error) {
    // OutboundPolicy validates redirect targets before DNS/transport. Turn a
    // blocked restricted target into aggregate-only evidence while retaining
    // a typed policy diagnostic; the blocked URL is never a citation.
    if (
      error instanceof OutboundPolicyError &&
      error.code === 'restricted-domain'
    ) {
      const publisher =
        findRestrictedPublisher(null, error.url)?.names[0] ??
        normalizePublisherDomain(error.url);
      const classified = classifyArticleAccess(
        {
          title: input.title,
          body: input.snippet,
          kind: 'news',
          originalSnippet: input.snippet,
          publisher,
          originalUrl: input.originalUrl,
          canonicalUrl: input.canonicalUrl ?? input.sourceUrl ?? null,
        },
        source,
        observedAt
      );
      return {
        body: classified.body,
        originalSnippet: classified.originalSnippet ?? '',
        publisher: classified.publisher ?? null,
        canonicalUrl: classified.canonicalUrl ?? null,
        provenance: {
          ...classified.articleProvenance!,
          redirectChain: error.redirectChain ?? [input.originalUrl, error.url],
          policyBlock: { code: error.code, url: error.url },
        },
        accessMode: classified.accessMode,
        accessRestrictionReason: classified.accessRestrictionReason,
        restrictionPolicyUrl: classified.restrictionPolicyUrl,
        aggregateUrl: classified.aggregateUrl,
        aggregateProvenance: classified.aggregateProvenance,
        unresolvedAggregateLink: classified.unresolvedAggregateLink,
        observedAt: classified.observedAt,
      };
    }
    return fallback();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function enrichDraft(
  draft: DraftItem,
  deps: { httpClient: HttpClient },
  source?: SourceConfig,
  observedAt?: string
): Promise<ArticleEnrichmentResult> {
  if (
    isRestrictedPublisher(
      draft.publisher ?? source?.name,
      draft.canonicalUrl ??
        draft.sourceUrl ??
        draft.originalUrl ??
        draft.uris?.[0]
    ) ||
    isRestrictedPublisher(source?.name, source?.url) ||
    isRestrictedPublisher(null, source?.aggregateUrl) ||
    source?.accessMode === 'snippet-only'
  ) {
    const classified = classifyArticleAccess(draft, source, observedAt);
    return Promise.resolve({
      body: classified.body,
      originalSnippet: classified.originalSnippet ?? '',
      publisher: classified.publisher ?? null,
      canonicalUrl: classified.canonicalUrl ?? null,
      provenance: classified.articleProvenance!,
      accessMode: classified.accessMode,
      accessRestrictionReason: classified.accessRestrictionReason,
      restrictionPolicyUrl: classified.restrictionPolicyUrl,
      aggregateUrl: classified.aggregateUrl,
      aggregateProvenance: classified.aggregateProvenance,
      unresolvedAggregateLink: classified.unresolvedAggregateLink,
      observedAt: classified.observedAt,
    });
  }
  return enrichDiscoveredArticle(
    {
      title: draft.title,
      snippet: draft.originalSnippet ?? draft.body,
      publisher: draft.publisher,
      originalUrl: draft.originalUrl ?? draft.uris?.[0] ?? '',
      ...(draft.canonicalUrl ? { canonicalUrl: draft.canonicalUrl } : {}),
      ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
      ...(draft.publisherHome ? { publisherHome: draft.publisherHome } : {}),
    },
    deps,
    source,
    observedAt
  ).then((result) => ({
    ...result,
    // Fetch observation is provenance for an otherwise undated article; it
    // is not promoted to an editorial publication/event date.
    ...(observedAt ? { observedAt } : {}),
  }));
}
