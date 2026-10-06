import { createHash } from 'node:crypto';
import { normalizedAddress } from './locality-registry.js';
import {
  parseRobots,
  robotsAllows,
  type PublisherRobots,
} from './publisher-resolver.js';
import { getAdapter } from './registry.js';
import {
  findRestrictedPublisher,
  restrictedPublisherDomains,
} from './restricted-publishers.js';
import { STATE_NAMES, type OfficialSite } from './directories.js';
import type {
  BlobRef,
  BlobStore,
  HttpClient,
  LocalityConfig,
  SourceConfig,
} from './types.js';

/**
 * The sourcing engine: finding a town's sources without a person typing them.
 *
 * It starts where a person would — the town's own website, its county's, its
 * school district's, the sources already configured, and a web search when a
 * search service is configured — and follows links a short way, looking for
 * the things this pipeline knows how to read: agenda centres, meeting
 * platforms, school-board sites, feeds.
 *
 * Nothing is adopted on appearance. Every candidate is fetched and parsed by
 * the adapter that would read it daily, and adopted only if that produces
 * dated items from the last six months. Fixed rules refuse the rest, with
 * reasons: a site whose robots.txt disallows us, a publisher on the
 * restricted list (those are configured by hand, snippet-only), a feed that
 * never mentions the town, anything already configured. Each decision is
 * returned with its evidence so it can be logged and reviewed.
 *
 * The crawl is polite by construction: one robots.txt per origin, honoured
 * including AI-crawler groups; a page budget per town; same-site links only;
 * everything through the outbound policy the pipeline already uses.
 */

export const DISCOVERY_HISTORY_DAYS = 180;
const USER_AGENT = 'civic-pipeline/0.1 (civic intelligence POC)';
/** Pages the crawl may read per town. Enough to reach a site's boards through its menus. */
const DEFAULT_PAGE_BUDGET = 150;
const MAX_DEPTH = 2;
const TRIAL_DOCUMENTS = 6;
const DAY_MS = 86_400_000;
/** The places a town's sources come from: itself and the local governments containing it. */
const LOCAL_KINDS = new Set([
  'town',
  'city',
  'village',
  'county',
  'school-district',
]);
/** Adapters that read a public body's own systems, whose sites are that body's. */
const OFFICIAL_ADAPTERS = new Set([
  'document',
  'http-scrape',
  'legistar',
  'granicus',
  'civicclerk',
  'apptegy',
  'open-data',
]);

/** A web search, when one is configured. It only supplies starting points; adoption is decided the same way. */
export interface SearchProvider {
  name: string;
  search(query: string): Promise<{ url: string; title: string }[]>;
}

export interface SourcingInput {
  /** The edition being sourced. */
  locality: LocalityConfig;
  /**
   * The governments around it whose sources a town's edition also reads: the
   * places containing it, and those inside it (a city within a town). Only
   * local governments are crawled; a state or region is not the town's record.
   */
  ancestors: readonly LocalityConfig[];
  /** Every source already configured anywhere, so nothing is adopted twice. */
  existing: readonly SourceConfig[];
  httpClient: HttpClient;
  search?: SearchProvider | null;
  /** Official websites the directories list for the town and the governments around it (see directories.ts). */
  officialSites?: readonly OfficialSite[];
  /** Every .gov domain with its government and state, to tell a namesake elsewhere from the town. */
  governmentDomains?: ReadonlyMap<
    string,
    { organization: string; state: string }
  >;
  now?: Date;
  pageBudget?: number;
}

export interface Candidate {
  source: SourceConfig;
  /** Whether it is on a place's own site — listed by a directory, or behind a configured source — rather than found only through search. */
  official: boolean;
  /** Which locality the source belongs to: the town, or the county whose site it came from. */
  ownerSlug: string;
  /** How it was found: `crawl <page>` or `search "<query>"`. */
  via: string;
}

export interface SourcingDecision extends Candidate {
  adopted: boolean;
  reasons: string[];
  evidence: string[];
}

interface Seed {
  url: string;
  ownerSlug: string;
  /** Whether the seed is the place's own website, so what is found there covers the whole place. */
  official: boolean;
  via: string;
}

export async function discoverSources(input: SourcingInput): Promise<{
  decisions: SourcingDecision[];
  searched: string | null;
  pagesRead: number;
}> {
  const now = input.now ?? new Date();
  const seeds = await seedsFor(input);
  const crawl = await crawlFrom(
    seeds,
    input.httpClient,
    input.pageBudget ?? DEFAULT_PAGE_BUDGET
  );
  // A site the directories or configured sources mark as a place's own is
  // its own however the crawl reached it, search included.
  const officialHosts = new Set(
    seeds.filter((seed) => seed.official).map((seed) => hostOf(seed.url))
  );
  for (const candidate of crawl.candidates)
    if (officialHosts.has(hostOf(candidate.source.url)))
      candidate.official = true;
  const homepages = new Map<string, string | null>();
  const known = new Set(
    input.existing.flatMap((source) => [
      source.sourceKey,
      normalizedAddress(source.url),
    ])
  );
  const decisions: SourcingDecision[] = [];
  const seen = new Set<string>();
  for (const candidate of crawl.candidates) {
    const address = normalizedAddress(candidate.source.url);
    if (seen.has(address)) continue;
    seen.add(address);
    if (known.has(address) || known.has(candidate.source.sourceKey)) continue; // already configured: not a decision worth logging
    const decision = await judge(
      candidate,
      {
        ...input,
        existing: [
          ...input.existing,
          ...decisions
            .filter((made) => made.adopted)
            .map((made) => made.source),
        ],
      },
      now,
      crawl.robots,
      homepages
    );
    decisions.push(decision);
  }
  return {
    decisions,
    searched: input.search ? input.search.name : null,
    pagesRead: crawl.pagesRead,
  };
}

/** Where to start: what the directories list, the places' own sites, the origins of sources they already have, and search results. */
async function seedsFor(input: SourcingInput): Promise<Seed[]> {
  const seeds: Seed[] = [];
  // A town is sourced with the local governments above it — its county —
  // but not the state or the nation, whose sites are not the town's record.
  for (const place of [
    input.locality,
    ...input.ancestors.filter((ancestor) => LOCAL_KINDS.has(ancestor.kind)),
  ]) {
    for (const site of place.websites ?? [])
      seeds.push({
        url: site,
        ownerSlug: place.slug,
        official: true,
        via: `the website of ${place.name}`,
      });
    for (const source of place.sources) {
      // Only a body's own meeting and document systems mark its website. A
      // feed is a publisher's, and its site is the publisher's, not the town's.
      if (
        !OFFICIAL_ADAPTERS.has(source.adapter) ||
        source.accessMode === 'snippet-only'
      )
        continue;
      try {
        seeds.push({
          url: new URL(source.url).origin,
          ownerSlug: place.slug,
          official: true,
          via: `the site behind ${source.name}`,
        });
      } catch {
        /* unreadable address */
      }
    }
  }
  // What the official directories list comes first: it is the place's own address, written down.
  for (const site of input.officialSites ?? [])
    seeds.unshift({
      url: site.url,
      ownerSlug: site.ownerSlug,
      official: true,
      via: site.via,
    });
  if (input.search) {
    const county = input.ancestors.find((place) => place.kind === 'county');
    const queries = [
      `${input.locality.name} ${input.locality.state} city council agenda minutes`,
      `${input.locality.name} ${input.locality.state} board of education meetings`,
      `${input.locality.name} ${input.locality.state} local news`,
      ...(county
        ? [
            `${county.name} ${input.locality.state} board of commissioners agenda`,
          ]
        : []),
    ];
    for (const query of queries) {
      try {
        for (const result of (await input.search.search(query)).slice(0, 8)) {
          seeds.push({
            url: result.url,
            ownerSlug: input.locality.slug,
            official: false,
            via: `search "${query}"`,
          });
        }
      } catch {
        // A failed search leaves the crawl from official sites standing.
      }
    }
  }
  const unique = new Map<string, Seed>();
  for (const seed of seeds)
    if (!unique.has(normalizedAddress(seed.url)))
      unique.set(normalizedAddress(seed.url), seed);
  return [...unique.values()];
}

interface Crawl {
  candidates: Candidate[];
  robots: Map<string, PublisherRobots | null>;
  pagesRead: number;
}

/** Breadth-first from the seeds, same site only, two links deep, within a page budget. */
async function crawlFrom(
  seeds: readonly Seed[],
  httpClient: HttpClient,
  budget: number
): Promise<Crawl> {
  const robots = new Map<string, PublisherRobots | null>();
  const candidates: Candidate[] = [];
  const visited = new Set<string>();
  const queue: { url: string; depth: number; seed: Seed }[] = seeds.map(
    (seed) => ({ url: seed.url, depth: 0, seed })
  );
  let pagesRead = 0;
  while (queue.length && pagesRead < budget) {
    const { url, depth, seed } = queue.shift()!;
    const key = normalizedAddress(url);
    if (visited.has(key)) continue;
    visited.add(key);
    // A directory may list a site as http:// or under the wrong www; the
    // outbound policy will not follow a redirect to another origin, so the
    // likely addresses are tried in turn, each checked against its own robots.txt.
    let page: Page | null = null;
    for (const address of depth === 0 ? addressesToTry(url) : [url]) {
      if (!(await allowed(address, httpClient, robots))) break;
      page = await fetchPage(address, httpClient);
      if (page) break;
    }
    if (!page) continue;
    pagesRead += 1;
    candidates.push(...candidatesOn(page, seed));
    if (depth >= MAX_DEPTH) continue;
    for (const link of promisingLinks(page)) {
      // The site the page came from: a listed domain may redirect to the
      // government's new one (cityofadel.us to cityofadelga.gov).
      if (!sameSite(link, page.url)) continue;
      // Meeting records first: an agenda centre's boards before a news page,
      // so the budget is spent where the records are.
      const entry = { url: link, depth: depth + 1, seed };
      if (MEETING_LINK.test(link)) {
        const at = queue.findIndex(
          (queued) =>
            !MEETING_LINK.test(queued.url) && queued.depth >= entry.depth
        );
        if (at < 0) queue.push(entry);
        else queue.splice(at, 0, entry);
      } else queue.push(entry);
    }
  }
  return { candidates, robots, pagesRead };
}

interface Page {
  url: string;
  html: string;
  title: string;
  links: string[];
}

async function fetchPage(
  url: string,
  httpClient: HttpClient
): Promise<Page | null> {
  try {
    // Town sites are often served from their CMS vendor's host (Tift County's
    // from cms5.revize.com); a public redirect is followed, as the document
    // adapter already does, while private addresses and restricted publishers
    // are still refused by the policy.
    const response = await httpClient.fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(20_000),
      policy: {
        allowPublicCrossOriginRedirects: true,
        deniedRegistrableDomains: restrictedPublisherDomains(),
      },
    });
    if (!response.ok) return null;
    if (!/html/iu.test(response.headers.get('content-type') ?? '')) return null;
    const html = await response.text();
    const finalUrl = response.url || url;
    const links = [
      ...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/giu),
    ]
      .map((match) => absolute(match[1]!, finalUrl))
      .filter((link): link is string => link !== null);
    const title = decodeEntities(
      html.match(/<title[^>]*>([^<]*)<\/title>/iu)?.[1] ?? ''
    )
      .replace(/\s+/gu, ' ')
      .trim();
    return { url: finalUrl, html, title, links };
  } catch {
    return null;
  }
}

/** The forms a listed address may really live at: https first, with and without www, then as written. */
function addressesToTry(url: string): string[] {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const other = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const path = `${parsed.pathname}${parsed.search}`;
    return [
      ...new Set([`https://${host}${path}`, `https://${other}${path}`, url]),
    ];
  } catch {
    return [url];
  }
}

/** Whether robots.txt lets this pipeline read the page. One robots.txt per origin; unreadable means allowed, as the standard says. */
async function allowed(
  url: string,
  httpClient: HttpClient,
  cache: Map<string, PublisherRobots | null>
): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!cache.has(parsed.origin)) {
    const robotsUrl = `${parsed.origin}/robots.txt`;
    try {
      const response = await httpClient.fetch(robotsUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10_000),
        policy: {
          allowPublicCrossOriginRedirects: true,
          deniedRegistrableDomains: restrictedPublisherDomains(),
        },
      });
      cache.set(
        parsed.origin,
        response.ok ? parseRobots(await response.text(), robotsUrl) : null
      );
    } catch {
      cache.set(parsed.origin, null);
    }
  }
  const robots = cache.get(parsed.origin);
  return robots
    ? robotsAllows(robots, `${parsed.pathname}${parsed.search}`)
    : true;
}

/** Links worth following toward a source: meetings, agendas, boards, news. */
const MEETING_LINK = /agenda|minute|meeting|council|commission|board/iu;

function promisingLinks(page: Page): string[] {
  return page.links.filter((link) =>
    /agenda|minute|meeting|council|commission|board|government|departments?|news|notice|calendar|document/iu.test(
      link
    )
  );
}

function candidatesOn(page: Page, seed: Seed): Candidate[] {
  const found: Candidate[] = [];
  const html = page.html;
  const owner = seed.ownerSlug;
  const add = (
    source: Omit<
      SourceConfig,
      | 'sourceKey'
      | 'ownerSlug'
      | 'coverage'
      | 'accessMode'
      | 'aggregateDiscovery'
    > & { coverage?: SourceConfig['coverage'] }
  ) => {
    found.push({
      official: seed.official,
      ownerSlug: owner,
      via: seed.official
        ? `crawl of ${seed.via} (${page.url})`
        : `${seed.via} → ${page.url}`,
      source: {
        ...source,
        sourceKey: sourceKeyFor(owner, source.adapter, source.url),
        ownerSlug: owner,
        coverage: source.coverage ?? (seed.official ? 'all' : 'mentions'),
        accessMode: 'full',
        aggregateDiscovery: false,
      } as SourceConfig,
    });
  };
  // Feeds the page announces.
  for (const match of html.matchAll(
    /<link\b[^>]*type\s*=\s*["']application\/(?:rss|atom)\+xml["'][^>]*>/giu
  )) {
    const href = match[0].match(/href\s*=\s*["']([^"']+)["']/iu)?.[1];
    const url = href ? absolute(href, page.url) : null;
    // WordPress also announces comment, author and tag feeds; none is the town's record.
    if (!url || /comments\/feed|\/comments\b|\/author\/|\/tag\//iu.test(url))
      continue;
    add({
      adapter: 'rss',
      name: page.title || new URL(url).hostname,
      url,
      kind: 'news',
      desk: seed.official ? 'government' : 'local-reporting',
    });
  }
  // CivicPlus agenda centres: an index of dated agendas and minutes.
  for (const link of page.links) {
    if (/\/AgendaCenter\/?$|\/AgendaCenter\/[^/?#]+-\d+\/?$/iu.test(link)) {
      add({
        adapter: 'document',
        name: `${page.title || 'Agenda center'}`.slice(0, 120),
        url: link,
        kind: 'meeting',
        desk: 'government',
        config: {
          indexUrl: link,
          linkPattern: 'ViewFile/(Agenda|Minutes|Packet)/',
        },
      });
    }
  }
  // A CivicPlus agenda centre that shows every board on one page, in
  // collapsible sections, links to no board's own page — but each section is
  // headed with the board's name and number, and /AgendaCenter/<Name>-<n>
  // is that board's index. Each is proposed on its own, so a centre around a
  // board already read still yields its other boards.
  if (/\/AgendaCenter\/?$/iu.test(new URL(page.url).pathname)) {
    for (const match of html.matchAll(
      /aria-controls\s*=\s*["']category-panel-(\d+)["'][^>]*>\s*([^<]+)/giu
    )) {
      const board = decodeEntities(match[2]!).replace(/\s+/gu, ' ').trim();
      const slug = board
        .replace(/[^A-Za-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '');
      const url = new URL(
        `/AgendaCenter/${slug}-${match[1]}`,
        page.url
      ).toString();
      add({
        adapter: 'document',
        name: `${board} (${new URL(page.url).hostname.replace(
          /^www\./u,
          ''
        )})`.slice(0, 120),
        url,
        kind: 'meeting',
        desk: 'government',
        config: {
          indexUrl: url,
          linkPattern: 'ViewFile/(Agenda|Minutes|Packet)/',
        },
      });
    }
  }
  // Hosted meeting platforms.
  for (const link of page.links) {
    const legistar = link.match(/^https?:\/\/([a-z0-9-]+)\.legistar\.com/iu);
    if (legistar)
      add({
        adapter: 'legistar',
        name: `${legistar[1]} Legistar`,
        url: `https://${legistar[1]}.legistar.com/Calendar.aspx`,
        kind: 'meeting',
        desk: 'government',
        config: { client: legistar[1]! },
      });
    if (/\.civicclerk\.com/iu.test(link))
      add({
        adapter: 'civicclerk',
        name: new URL(link).hostname,
        url: new URL(link).origin,
        kind: 'meeting',
        desk: 'government',
      });
    if (/granicus\.com\/ViewPublisher|\.granicus\.com/iu.test(link))
      add({
        adapter: 'granicus',
        name: new URL(link).hostname,
        url: link,
        kind: 'meeting',
        desk: 'government',
      });
  }
  // A school district's own site on Apptegy (Thrillshare).
  if (/thrillshare|apptegy/iu.test(html)) {
    add({
      adapter: 'apptegy',
      name: page.title || new URL(page.url).hostname,
      url: page.url,
      kind: 'meeting',
      desk: 'schools',
      config: { minLength: 40 },
    });
  }
  // A plain page that lists agendas and minutes as files.
  const documents = page.links.filter(
    (link) => /\.pdf(\?|$)/iu.test(link) && /agenda|minute|packet/iu.test(link)
  );
  if (documents.length >= 3 && !/AgendaCenter/iu.test(page.url)) {
    add({
      adapter: 'document',
      name: page.title || new URL(page.url).hostname,
      url: page.url,
      kind: 'meeting',
      desk: /school|boe|k12|education/iu.test(page.url)
        ? 'schools'
        : 'government',
      config: {
        indexUrl: page.url,
        linkPattern: '[Aa]genda.*\\.pdf|[Mm]inute.*\\.pdf|[Pp]acket.*\\.pdf',
      },
    });
  }
  return found;
}

/**
 * The fixed rules, then the trial. A candidate is adopted only when the
 * adapter that would read it daily reads it now and finds recent, dated items.
 */
async function judge(
  candidate: Candidate,
  input: SourcingInput,
  now: Date,
  robots: Map<string, PublisherRobots | null>,
  homepages: Map<string, string | null> = new Map()
): Promise<SourcingDecision> {
  const refuse = (...reasons: string[]): SourcingDecision => ({
    ...candidate,
    adopted: false,
    reasons,
    evidence: [],
  });
  // One of each platform per site. A second feed from a site already read
  // through a feed is a section of it — the same stories under another
  // heading — and a second entry into the same school or meeting platform
  // reads the same records again. A document index is the exception: one
  // site's agenda centre can hold several boards, each its own index.
  if (candidate.source.adapter !== 'document') {
    const host = hostOf(candidate.source.url);
    const already = input.existing.find(
      (source) =>
        source.adapter === candidate.source.adapter &&
        hostOf(source.url) === host
    );
    if (already)
      return refuse(
        `${host} is already read through ${
          already.name
        }; this is another view of the same ${
          candidate.source.adapter === 'rss' ? 'publisher' : 'platform'
        }.`
      );
  }
  // What search finds may be a namesake: Madison, Minnesota for Madison,
  // Florida; Nashville, Tennessee for Nashville, Georgia. It has to show it
  // is in this town's state or county before anything else is considered.
  if (!candidate.official) {
    const elsewhere = await elsewhereThan(
      candidate.source.url,
      input,
      homepages
    );
    if (elsewhere) return refuse(elsewhere);
  }
  // A meeting record comes from the body that keeps it. From a search, a
  // feed may be anyone's, but agendas and minutes are adopted only from a
  // government's own systems — never from a site that republishes them.
  if (
    !candidate.official &&
    candidate.source.kind === 'meeting' &&
    !governmentSystem(candidate.source) &&
    !namedForPlace(candidate.source.url, input)
  ) {
    return refuse(
      `Found by search on ${hostOf(
        candidate.source.url
      )}, which is not a government's own system; meeting records are read from the body that keeps them.`
    );
  }
  // A board's page inside an agenda centre already read is part of it.
  if (candidate.source.adapter === 'document') {
    const address = normalizedAddress(candidate.source.url);
    const covering = input.existing.find(
      (source) =>
        source.adapter === 'document' &&
        address.startsWith(`${normalizedAddress(source.url)}/`)
    );
    if (covering)
      return refuse(`It is part of ${covering.name}, which is already read.`);
    // And the other way round: a whole agenda centre around a board already
    // read would read that board again. Its other boards are proposed one by one.
    const inside = input.existing.find(
      (source) =>
        source.adapter === 'document' &&
        normalizedAddress(source.url).startsWith(`${address}/`)
    );
    if (inside)
      return refuse(
        `It contains ${inside.name}, which is already read; its other boards are taken one at a time.`
      );
  }
  const alias = await sameSiteElsewhere(
    candidate.source,
    input.existing,
    input.httpClient
  );
  if (alias)
    return refuse(
      `It is the same site as ${alias.name} under another domain (${hostOf(
        candidate.source.url
      )} and ${hostOf(alias.url)} serve the same pages).`
    );
  if (candidate.source.adapter === 'document') {
    const overlap = await overlapsExisting(
      candidate.source,
      input.existing,
      input.httpClient
    );
    if (overlap) return refuse(overlap);
  }
  const restricted = findRestrictedPublisher(
    candidate.source.name,
    candidate.source.url
  );
  if (restricted) {
    return refuse(
      `${
        restricted.names[0] ?? 'This publisher'
      } restricts how its work may be used, so it is only read snippet-only through a source configured by hand.`
    );
  }
  if (!(await allowed(candidate.source.url, input.httpClient, robots))) {
    return refuse('Its robots.txt does not allow this pipeline to read it.');
  }
  let adapter;
  try {
    adapter = getAdapter(candidate.source.adapter);
  } catch {
    return refuse(
      `No adapter named ${candidate.source.adapter} is registered.`
    );
  }
  const since = new Date(now.getTime() - DISCOVERY_HISTORY_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const until = now.toISOString().slice(0, 10);
  let items: { title: string; date: string | null; text: string }[] = [];
  try {
    const blobStore = memoryBlobStore();
    const fetched = await adapter.fetch(candidate.source, {
      locality: input.locality,
      httpClient: input.httpClient,
      blobStore,
      coverageRange: { requestedStart: since, requestedEnd: until },
      signal: AbortSignal.timeout(90_000),
    });
    const documents = fetched
      .filter((result) => result.kind === 'fetched')
      .slice(0, TRIAL_DOCUMENTS);
    if (!documents.length) {
      const failure = fetched.find((result) => result.kind === 'failed');
      return refuse(
        failure && failure.kind === 'failed'
          ? `A trial read failed: ${failure.error.message}`
          : 'A trial read found nothing to parse.'
      );
    }
    for (const document of documents) {
      if (document.kind !== 'fetched') continue;
      const drafts = await adapter.parse(
        {
          url: document.url,
          contentType: document.contentType,
          payload: document.payload,
          fetchedAt: document.fetchedAt,
        },
        candidate.source,
        { blobStore }
      );
      items.push(
        ...drafts.map((draft) => ({
          title: draft.title,
          date: dayOf(draft.eventDate ?? draft.publishedAt),
          text: `${draft.title}\n${draft.body}`,
        }))
      );
    }
  } catch (error) {
    return refuse(
      `A trial read failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  items = items.filter((item) => item.title.trim());
  const recent = items.filter(
    (item) => item.date && item.date >= since && item.date <= until
  );
  if (!items.length) return refuse('A trial read parsed no items.');
  if (!recent.length)
    return refuse(
      `A trial read found ${items.length} item(s), none dated in the last six months.`
    );
  // A feed found by search, not on the town's own site, has to be about the town.
  if (candidate.source.coverage === 'mentions') {
    const names = [input.locality.name, ...(input.locality.aliases ?? [])].map(
      (name) => name.toLowerCase()
    );
    if (
      !recent.some((item) =>
        names.some((name) => item.text.toLowerCase().includes(name))
      )
    ) {
      return refuse(`None of its recent items mention ${input.locality.name}.`);
    }
  }
  return {
    ...candidate,
    adopted: true,
    reasons: [
      `A trial read found ${recent.length} dated item(s) from the last six months.`,
    ],
    evidence: recent
      .slice(0, 3)
      .map((item) => `${item.date} — ${item.title.slice(0, 100)}`),
  };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#0?39;|&apos;/gu, "'")
    .replace(/&#(\d+);/gu, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/giu, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

/** A draft's date as YYYY-MM-DD, whatever form the source wrote it in (ISO, RFC 822). */
function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/u.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

function sourceKeyFor(owner: string, adapter: string, url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./u, '');
    } catch {
      return 'source';
    }
  })();
  const label =
    host
      .split('.')
      .slice(0, -1)
      .join('-')
      .replace(/[^a-z0-9-]/gu, '')
      .slice(0, 30) || 'source';
  const tag = createHash('sha256')
    .update(normalizedAddress(url))
    .digest('hex')
    .slice(0, 6);
  return `${owner}-${label}-${adapter}-${tag}`.slice(0, 80);
}

function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(href.replace(/&amp;/gu, '&'), base);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Why a site found by search is not in this town's place, or null when it is.
 * A .gov domain the directory places in another state is refused on that
 * alone. Otherwise the site's own home page has to name the town's state or
 * one of its counties — "Tift County", "Georgia", "Tifton, GA".
 */
async function elsewhereThan(
  url: string,
  input: SourcingInput,
  homepages: Map<string, string | null>
): Promise<string | null> {
  const host = hostOf(url);
  if (platformTenantForPlace(host, input)) return null;
  const registered = input.governmentDomains?.get(host);
  if (registered && registered.state !== input.locality.state) {
    return `The .gov list places ${host} with ${registered.organization}, ${registered.state} — another ${input.locality.name}.`;
  }
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return 'Its address cannot be read.';
  }
  if (!homepages.has(origin)) {
    let text: string | null = null;
    for (const address of addressesToTry(`${origin}/`)) {
      const page = await fetchPage(address, input.httpClient);
      if (page) {
        text = page.html
          .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/giu, ' ')
          .replace(/<[^>]+>/gu, ' ')
          .replace(/\s+/gu, ' ');
        break;
      }
    }
    homepages.set(origin, text);
  }
  const text = homepages.get(origin);
  if (!text)
    return `Its home page could not be read to confirm it is in ${input.locality.name}, ${input.locality.state}.`;
  const state = STATE_NAMES[input.locality.state] ?? input.locality.state;
  const counties = [...input.ancestors, input.locality]
    .filter((place) => place.kind === 'county')
    .map((place) => place.name);
  const mentions = (phrase: string) =>
    new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'iu').test(text);
  // The state settles it. A county name alone does not — Berrien and Madison
  // counties are in several states — unless the town is named beside it.
  if (
    mentions(state) ||
    new RegExp(`,\\s*${input.locality.state}\\b`, 'u').test(text)
  )
    return null;
  if (counties.some(mentions) && mentions(input.locality.name)) return null;
  return `Its home page does not say it is in ${[...counties, state].join(
    ' or '
  )}; it may be another ${input.locality.name}.`;
}

/** Hosted meeting platforms, where each government is a tenant named in the subdomain. */
const MEETING_PLATFORM_HOSTS =
  /\.(?:civicclerk|legistar|granicus|primegov|novusagenda|iqm2|municodemeetings|boarddocs)\.com$/u;

/** A place's name as it appears in an address: "escambia" for Escambia County. */
function bareName(place: LocalityConfig): string {
  return place.name
    .toLowerCase()
    .replace(
      /\b(?:city|town|village|county|parish) of\b|\b(?:county|parish)\b/gu,
      ''
    )
    .replace(/[^a-z0-9]/gu, '');
}

/**
 * A meeting platform's tenant named for this place and state —
 * escambiacofl.civicclerk.com. Such portals are script-built, so their home
 * page says nothing to read; the tenant name is the government's own label.
 * It must carry the state as well, so riverton.legistar.com is not taken for
 * Riverton, Georgia on its name alone.
 */
function platformTenantForPlace(host: string, input: SourcingInput): boolean {
  if (!MEETING_PLATFORM_HOSTS.test(host)) return false;
  const tenant = host.split('.')[0] ?? '';
  const state = input.locality.state.toLowerCase();
  return (
    tenant.endsWith(state) &&
    [
      input.locality,
      ...input.ancestors.filter((place) => LOCAL_KINDS.has(place.kind)),
    ]
      .map(bareName)
      .some((name) => name.length >= 4 && tenant.includes(name))
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Whether a source is a public body's own system: an agenda centre (CivicPlus
 * sells only to governments), a hosted meeting platform, or a site on a
 * government or school domain.
 */
function governmentSystem(source: SourceConfig): boolean {
  // Apptegy (Thrillshare) is sold to school districts, as CivicPlus is to governments.
  if (
    ['legistar', 'granicus', 'civicclerk', 'apptegy'].includes(source.adapter)
  )
    return true;
  if (/\/AgendaCenter(\/|$)/iu.test(source.url)) return true;
  const host = hostOf(source.url);
  return /\.gov$|\.us$|\.k12\.[a-z]{2}\.us$|\.mil$/u.test(host);
}

/**
 * Whether a site's own name says it is this place's body: the town's or a
 * county's name together with what kind of body — grotonschools.org,
 * tiftcountyschools.org, cityofmadisonfl.com. A site that republishes
 * meeting records for many towns is named for itself, not for the town.
 */
function namedForPlace(url: string, input: SourcingInput): boolean {
  const host = hostOf(url).replace(/[^a-z0-9.]/gu, '');
  // A county's schools go by its bare name — escambiaschools.org — as well as
  // its full one; the kind-of-body word below still has to be there.
  const places = [
    input.locality,
    ...input.ancestors.filter((place) => LOCAL_KINDS.has(place.kind)),
  ]
    .flatMap((place) => [
      place.name
        .toLowerCase()
        .replace(/\b(city|town|village) of\b/gu, '')
        .replace(/[^a-z0-9]/gu, ''),
      bareName(place),
    ])
    .filter((name) => name.length >= 4);
  const label = host.split('.').slice(0, -1).join('');
  return (
    places.some((name) => label.includes(name)) &&
    /schools?|boe|k12|board|city|town|county|village|gov/u.test(label)
  );
}

/**
 * Whether a candidate is an existing source under another domain. Towns often
 * answer on two names — tifton.net and tiftonga.gov are one CivicPlus site —
 * and adopting both reads every agenda twice. When an existing source has the
 * same path on another host, the two pages' links are compared by path; if
 * nearly all of them agree, it is one site.
 */
async function sameSiteElsewhere(
  candidate: SourceConfig,
  existing: readonly SourceConfig[],
  httpClient: HttpClient
): Promise<SourceConfig | null> {
  const path = pathOf(candidate.url);
  const twins = existing.filter(
    (source) =>
      hostOf(source.url) !== hostOf(candidate.url) &&
      pathOf(source.url) === path
  );
  if (!twins.length) return null;
  const mine = await fetchPage(candidate.url, httpClient);
  if (!mine) return null;
  const paths = (page: Page) =>
    new Set(page.links.map(pathOf).filter((linkPath) => linkPath.length > 1));
  const ours = paths(mine);
  for (const twin of twins) {
    const theirs = await fetchPage(twin.url, httpClient);
    if (!theirs) continue;
    const other = paths(theirs);
    const shared = [...ours].filter((linkPath) => other.has(linkPath)).length;
    const union = new Set([...ours, ...other]).size;
    if (union > 0 && shared / union >= 0.8) return twin;
  }
  return null;
}

/**
 * Whether a document index reads records another index already reads, judged
 * by what the pages link to rather than by their addresses. A town can put
 * one agenda centre on two domains, and a whole centre contains each board's
 * page: tiftonga.gov/AgendaCenter holds the council's index that
 * tifton.net/AgendaCenter/City-Council-3 already reads. The agenda and
 * minutes files each page lists are compared by path; when most of one's
 * files are the other's, they are the same records.
 */
async function overlapsExisting(
  candidate: SourceConfig,
  existing: readonly SourceConfig[],
  httpClient: HttpClient
): Promise<string | null> {
  const others = existing.filter(
    (source) =>
      source.adapter === 'document' &&
      normalizedAddress(source.url) !== normalizedAddress(candidate.url)
  );
  if (!others.length) return null;
  const records = (page: Page) =>
    new Set(
      page.links
        .filter((link) => /ViewFile|\.pdf(\?|$)/iu.test(link))
        .map(pathOf)
    );
  const mine = await fetchPage(candidate.url, httpClient);
  if (!mine) return null;
  const ours = records(mine);
  if (ours.size < 2) return null;
  for (const other of others) {
    const page = await fetchPage(other.url, httpClient);
    if (!page) continue;
    const theirs = records(page);
    if (theirs.size < 2) continue;
    const shared = [...ours].filter((path) => theirs.has(path)).length;
    const ofTheirs = shared / theirs.size;
    const ofOurs = shared / ours.size;
    if (ofTheirs >= 0.8 && ofOurs >= 0.8)
      return `It lists the same records as ${other.name}, which is already read.`;
    if (ofTheirs >= 0.8)
      return `It contains ${other.name}, which is already read; its other boards are taken one at a time.`;
    if (ofOurs >= 0.8)
      return `It is part of ${other.name}, which is already read.`;
  }
  return null;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/u, '').toLowerCase() || '/';
  } catch {
    return url;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, '').toLowerCase();
  } catch {
    return url;
  }
}

function sameSite(link: string, base: string): boolean {
  try {
    const a = new URL(link).hostname.replace(/^www\./u, '');
    const b = new URL(base).hostname.replace(/^www\./u, '');
    return a === b;
  } catch {
    return false;
  }
}

/** Blobs for a trial read, kept only as long as the trial. */
function memoryBlobStore(): BlobStore {
  const blobs = new Map<string, Uint8Array>();
  return {
    async put(input: Uint8Array, contentType: string): Promise<BlobRef> {
      const sha256 = createHash('sha256').update(input).digest('hex');
      blobs.set(sha256, input);
      return {
        store: 'trial',
        key: sha256,
        sha256,
        bytes: input.byteLength,
        contentType,
      };
    },
    async get(ref: BlobRef): Promise<Uint8Array> {
      const blob = blobs.get(ref.sha256);
      if (!blob) throw new Error('blob not found');
      return blob;
    },
    async has(ref: BlobRef): Promise<boolean> {
      return blobs.has(ref.sha256);
    },
  };
}
