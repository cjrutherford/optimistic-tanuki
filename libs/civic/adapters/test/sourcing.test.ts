import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  discoverSources,
  loadLocalityRegistry,
  type HttpClient,
  type HttpRequestInit,
  type HttpResponse,
  type LocalityConfig,
} from '@optimistic-tanuki/civic-core';
import { registerAllAdapters } from '../src/index.js';

/** A small web, entirely in memory: pages by address, and every request recorded. */
function fakeWeb(
  pages: Record<string, { body: string; type?: string; status?: number }>
): HttpClient & { requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    async fetch(input: string, _init?: HttpRequestInit): Promise<HttpResponse> {
      requested.push(input);
      const page = pages[input];
      const status = page?.status ?? (page ? 200 : 404);
      return new Response(page?.body ?? 'not found', {
        status,
        headers: { 'content-type': page?.type ?? 'text/html' },
      }) as unknown as HttpResponse;
    },
  };
}

const today = new Date('2026-09-22T12:00:00Z');
const town: LocalityConfig = {
  slug: 'riverton-ga',
  name: 'Riverton',
  state: 'GA',
  timezone: 'America/New_York',
  lat: 31,
  lon: -83,
  kind: 'town',
  parents: [],
  edition: true,
  topics: [],
  cadence: ['daily'],
  sources: [],
  websites: ['https://riverton.example.gov/'],
};

const rss = (items: { title: string; date: string; body: string }[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Riverton news</title>${items
    .map(
      (item) =>
        `<item><title>${
          item.title
        }</title><link>https://riverton.example.gov/news/${encodeURIComponent(
          item.title
        )}</link><pubDate>${new Date(
          item.date
        ).toUTCString()}</pubDate><description>${
          item.body
        }</description></item>`
    )
    .join('')}</channel></rss>`;

beforeAll(() => registerAllAdapters());

describe('the sourcing engine', () => {
  it("finds a feed on the town's own site and adopts it once a trial read finds recent items", async () => {
    const web = fakeWeb({
      'https://riverton.example.gov/robots.txt': {
        body: 'User-agent: *\nAllow: /',
        type: 'text/plain',
      },
      'https://riverton.example.gov/': {
        body: '<html><head><title>City of Riverton</title><link rel="alternate" type="application/rss+xml" href="/feed/"></head><body></body></html>',
      },
      'https://riverton.example.gov/feed/': {
        body: rss([
          {
            title: 'Council sets hearing on paving',
            date: '2026-09-15',
            body: 'The Riverton council set a hearing.',
          },
        ]),
        type: 'application/rss+xml',
      },
    });
    const { decisions } = await discoverSources({
      locality: town,
      ancestors: [],
      existing: [],
      httpClient: web,
      now: today,
    });
    expect(decisions.length).toBe(1);
    expect(decisions[0]!.adopted).toBe(true);
    expect(decisions[0]!.source.adapter).toBe('rss');
    expect(decisions[0]!.source.coverage).toBe('all');
    expect(decisions[0]!.evidence[0]!).toMatch(
      /Council sets hearing on paving/u
    );
  });

  it('refuses a feed with nothing from the last six months, and says so', async () => {
    const web = fakeWeb({
      'https://riverton.example.gov/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"></head></html>',
      },
      'https://riverton.example.gov/feed/': {
        body: rss([
          {
            title: 'Old news',
            date: '2025-01-10',
            body: 'Riverton, long ago.',
          },
        ]),
        type: 'application/rss+xml',
      },
    });
    const { decisions } = await discoverSources({
      locality: town,
      ancestors: [],
      existing: [],
      httpClient: web,
      now: today,
    });
    expect(decisions[0]!.adopted).toBe(false);
    expect(decisions[0]!.reasons[0]!).toMatch(
      /none dated in the last six months/u
    );
  });

  it('does not read what robots.txt disallows, or follow it', async () => {
    const web = fakeWeb({
      'https://riverton.example.gov/robots.txt': {
        body: 'User-agent: *\nDisallow: /',
        type: 'text/plain',
      },
      'https://riverton.example.gov/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"></head></html>',
      },
    });
    const { decisions, pagesRead } = await discoverSources({
      locality: town,
      ancestors: [],
      existing: [],
      httpClient: web,
      now: today,
    });
    expect(pagesRead).toBe(0);
    expect(decisions).toStrictEqual([]);
    expect(
      !web.requested.includes('https://riverton.example.gov/')
    ).toBeTruthy();
  });

  it('honours rules written for AI crawlers', async () => {
    const web = fakeWeb({
      'https://riverton.example.gov/robots.txt': {
        body: 'User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /',
        type: 'text/plain',
      },
      'https://riverton.example.gov/': { body: '<html></html>' },
    });
    const { pagesRead } = await discoverSources({
      locality: town,
      ancestors: [],
      existing: [],
      httpClient: web,
      now: today,
    });
    expect(pagesRead).toBe(0);
  });

  it('skips what is already configured, and a comments feed', async () => {
    const web = fakeWeb({
      'https://riverton.example.gov/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"><link rel="alternate" type="application/rss+xml" href="/comments/feed/"></head></html>',
      },
    });
    const existing = [
      {
        sourceKey: 'riverton-news',
        ownerSlug: 'riverton-ga',
        coverage: 'all',
        adapter: 'rss',
        name: 'Riverton',
        url: 'https://riverton.example.gov/feed',
        kind: 'news',
      },
    ] as LocalityConfig['sources'];
    const { decisions } = await discoverSources({
      locality: town,
      ancestors: [],
      existing,
      httpClient: web,
      now: today,
    });
    expect(decisions).toStrictEqual([]);
  });

  it('requires a feed found by search to be about the town', async () => {
    const web = fakeWeb({
      'https://elsewhere.example.com/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"></head><body>News from across Georgia</body></html>',
      },
      'https://elsewhere.example.com/feed/': {
        body: rss([
          {
            title: 'Springfield budget',
            date: '2026-09-10',
            body: 'Springfield passed a budget.',
          },
        ]),
        type: 'application/rss+xml',
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        { url: 'https://elsewhere.example.com/', title: 'Elsewhere' },
      ],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing: [],
      httpClient: web,
      search,
      now: today,
    });
    const feed = decisions.find(
      (decision) =>
        decision.source.url === 'https://elsewhere.example.com/feed/'
    );
    expect(feed?.adopted).toBe(false);
    expect(feed!.reasons[0]!).toMatch(/mention Riverton/u);
  });

  it("does not treat a publisher's site as the town's, or adopt its sections as new sources", async () => {
    const state: LocalityConfig = {
      ...town,
      slug: 'georgia',
      name: 'Georgia',
      kind: 'state',
      websites: [],
      sources: [
        {
          sourceKey: 'ga-recorder',
          ownerSlug: 'georgia',
          coverage: 'mentions',
          adapter: 'rss',
          name: 'Georgia Recorder',
          url: 'https://georgiarecorder.example.com/feed/',
          kind: 'legislation',
          desk: 'government',
        },
      ] as LocalityConfig['sources'],
    };
    const web = fakeWeb({
      'https://georgiarecorder.example.com/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/category/politics/feed/"></head></html>',
      },
      'https://riverton.example.gov/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"><link rel="alternate" type="application/rss+xml" href="/category/council/feed/"><link rel="alternate" type="application/rss+xml" href="/author/clerk/feed/"></head></html>',
      },
      'https://riverton.example.gov/feed/': {
        body: rss([
          {
            title: 'Council sets hearing',
            date: '2026-09-15',
            body: 'Riverton.',
          },
        ]),
        type: 'application/rss+xml',
      },
      'https://riverton.example.gov/category/council/feed/': {
        body: rss([
          {
            title: 'Council sets hearing',
            date: '2026-09-15',
            body: 'Riverton.',
          },
        ]),
        type: 'application/rss+xml',
      },
    });
    const { decisions } = await discoverSources({
      locality: town,
      ancestors: [state],
      existing: state.sources,
      httpClient: web,
      now: today,
    });
    expect(
      !web.requested.includes('https://georgiarecorder.example.com/')
    ).toBeTruthy();
    expect(
      !decisions.some((decision) => decision.source.url.includes('/author/'))
    ).toBeTruthy();
    const adopted = decisions.filter((decision) => decision.adopted);
    expect(adopted.length).toBe(1);
    const section = decisions.find((decision) =>
      decision.source.url.includes('/category/')
    );
    expect(section!.reasons[0]!).toMatch(/already read through/u);
  });

  it("reads a town's own news feed even where its agendas are already configured", async () => {
    const withAgendas = {
      ...town,
      sources: [
        {
          sourceKey: 'riverton-agendas',
          ownerSlug: 'riverton-ga',
          coverage: 'all',
          adapter: 'document',
          name: 'Riverton agendas',
          url: 'https://riverton.example.gov/AgendaCenter/City-Council-3',
          kind: 'meeting',
          config: {
            indexUrl:
              'https://riverton.example.gov/AgendaCenter/City-Council-3',
          },
        },
      ] as LocalityConfig['sources'],
    };
    const web = fakeWeb({
      'https://riverton.example.gov/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"></head></html>',
      },
      'https://riverton.example.gov/feed/': {
        body: rss([
          {
            title: 'Water main work on Love Ave',
            date: '2026-09-18',
            body: 'Riverton public works.',
          },
        ]),
        type: 'application/rss+xml',
      },
    });
    const { decisions } = await discoverSources({
      locality: withAgendas,
      ancestors: [],
      existing: withAgendas.sources,
      httpClient: web,
      now: today,
    });
    expect(
      decisions.find((decision) => decision.source.adapter === 'rss')?.adopted
    ).toBe(true);
  });

  it("starts from what the official directories list, as the town's own site", async () => {
    const web = fakeWeb({
      'https://rivertonga.gov/': {
        body: '<html><head><title>City of Riverton</title><link rel="alternate" type="application/rss+xml" href="/feed/"></head></html>',
      },
      'https://rivertonga.gov/feed/': {
        body: rss([
          {
            title: 'Boil water notice lifted',
            date: '2026-09-19',
            body: 'Riverton utilities.',
          },
        ]),
        type: 'application/rss+xml',
      },
    });
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing: [],
      httpClient: web,
      now: today,
      officialSites: [
        {
          url: 'https://rivertonga.gov/',
          ownerSlug: 'riverton-ga',
          via: 'the .gov list (City of Riverton, GA)',
        },
      ],
    });
    expect(decisions[0]?.adopted).toBe(true);
    expect(decisions[0]!.source.coverage).toBe('all');
    expect(decisions[0]!.via).toMatch(/the \.gov list/u);
  });

  it('reaches a listed http:// site at its https address', async () => {
    const web = fakeWeb({
      'https://rivertonga.gov/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"></head></html>',
      },
      'https://rivertonga.gov/feed/': {
        body: rss([
          {
            title: 'Council agenda posted',
            date: '2026-09-20',
            body: 'Riverton.',
          },
        ]),
        type: 'application/rss+xml',
      },
    });
    const { pagesRead, decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing: [],
      httpClient: web,
      now: today,
      officialSites: [
        {
          url: 'http://rivertonga.gov',
          ownerSlug: 'riverton-ga',
          via: 'Wikidata',
        },
      ],
    });
    expect(pagesRead).toBe(1);
    expect(decisions[0]?.adopted).toBe(true);
  });

  it('refuses the same site under another domain', async () => {
    const agendaIndex = (host: string) =>
      `<html><title>Agenda Center</title>${[
        'Agenda/_0914-1',
        'Agenda/_0921-2',
        'Minutes/_0907-3',
        'Agenda/_0831-4',
      ]
        .map(
          (file) =>
            `<a href="https://${host}/AgendaCenter/ViewFile/${file}">x</a>`
        )
        .join('')}</html>`;
    const web = fakeWeb({
      'https://rivertonga.gov/': {
        body: '<html><a href="/AgendaCenter">Agendas</a></html>',
      },
      'https://rivertonga.gov/AgendaCenter': {
        body: agendaIndex('rivertonga.gov'),
      },
      'https://riverton.example.net/AgendaCenter': {
        body: agendaIndex('riverton.example.net'),
      },
    });
    const existing = [
      {
        sourceKey: 'riverton-agendas',
        ownerSlug: 'riverton-ga',
        coverage: 'all',
        adapter: 'document',
        name: 'Riverton agenda center',
        url: 'https://riverton.example.net/AgendaCenter',
        kind: 'meeting',
        config: { indexUrl: 'https://riverton.example.net/AgendaCenter' },
      },
    ] as LocalityConfig['sources'];
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing,
      httpClient: web,
      now: today,
      officialSites: [
        {
          url: 'https://rivertonga.gov/',
          ownerSlug: 'riverton-ga',
          via: 'the .gov list',
        },
      ],
    });
    const twin = decisions.find(
      (decision) =>
        decision.source.url === 'https://rivertonga.gov/AgendaCenter'
    );
    expect(twin?.adopted).toBe(false);
    expect(twin!.reasons[0]!).toMatch(
      /same site as Riverton agenda center under another domain/u
    );
  });

  it("takes meeting records found by search only from a government's own system", async () => {
    const pdfs = (host: string) =>
      `<html><title>Riverton meetings</title>${[
        'agenda-0914.pdf',
        'minutes-0907.pdf',
        'agenda-0831.pdf',
        'packet-0914.pdf',
      ]
        .map((file) => `<a href="https://${host}/files/${file}">x</a>`)
        .join('')}</html>`;
    const web = fakeWeb({
      'https://meetings-aggregator.example.com/': {
        body: '<html>Meeting records for towns in Georgia</html>',
      },
      'https://meetings-aggregator.example.com/riverton': {
        body: pdfs('meetings-aggregator.example.com'),
      },
      'https://downtownriverton.example.com/': {
        body: '<html>Downtown Development Authority, Riverton, GA</html>',
      },
      'https://downtownriverton.example.com/AgendaCenter/Board-2': {
        body: '<html><a href="/AgendaCenter">All</a></html>',
      },
      'https://downtownriverton.example.com/AgendaCenter': {
        body: '<html><a href="/AgendaCenter/ViewFile/Agenda/_09142026-1">Agenda 09/14/2026</a></html>',
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        {
          url: 'https://meetings-aggregator.example.com/riverton',
          title: 'Riverton meetings',
        },
        {
          url: 'https://downtownriverton.example.com/AgendaCenter/Board-2',
          title: 'DDA',
        },
      ],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing: [],
      httpClient: web,
      search,
      now: today,
    });
    const republished = decisions.find((decision) =>
      decision.source.url.includes('meetings-aggregator')
    );
    expect(republished?.adopted).toBe(false);
    expect(republished!.reasons[0]!).toMatch(/not a government's own system/u);
    const agendaCenter = decisions.find(
      (decision) =>
        decision.source.url ===
        'https://downtownriverton.example.com/AgendaCenter'
    );
    expect(agendaCenter).toBeTruthy();
    expect(agendaCenter!.reasons[0]!).not.toMatch(
      /not a government's own system/u
    );
  });

  it('refuses a namesake the .gov list places in another state', async () => {
    const web = fakeWeb({
      'https://rivertonmn.gov/': {
        body: '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"></head><body>Riverton, Minnesota</body></html>',
      },
      'https://rivertonmn.gov/feed/': {
        body: rss([
          {
            title: 'Riverton crack sealing begins',
            date: '2026-09-10',
            body: 'Riverton public works.',
          },
        ]),
        type: 'application/rss+xml',
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        { url: 'https://rivertonmn.gov/', title: 'City of Riverton' },
      ],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing: [],
      httpClient: web,
      search,
      now: today,
      governmentDomains: new Map([
        ['rivertonmn.gov', { organization: 'City of Riverton', state: 'MN' }],
      ]),
    });
    expect(decisions[0]?.adopted).toBe(false);
    expect(decisions[0]!.reasons[0]!).toMatch(
      /places rivertonmn\.gov with City of Riverton, MN — another Riverton/u
    );
  });

  it('refuses a namesake whose own home page is in another state', async () => {
    const web = fakeWeb({
      'https://riverton.legistar.com/Calendar.aspx': {
        body: '<html>Metropolitan Council</html>',
      },
      'https://riverton.legistar.com/': {
        body: '<html>Riverton - Davidson County, Tennessee</html>',
      },
      'https://search-landing.example.com/': {
        body: '<html><a href="https://riverton.legistar.com/Calendar.aspx">council</a> Tennessee</html>',
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        { url: 'https://search-landing.example.com/', title: 'x' },
      ],
    };
    const county: LocalityConfig = {
      ...town,
      slug: 'river-county-ga',
      name: 'River County',
      kind: 'county',
      websites: [],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [county],
      existing: [],
      httpClient: web,
      search,
      now: today,
    });
    const legistar = decisions.find(
      (decision) => decision.source.adapter === 'legistar'
    );
    expect(legistar?.adopted).toBe(false);
    expect(legistar!.reasons[0]!).toMatch(
      /does not say it is in River County or Georgia; it may be another Riverton/u
    );
  });

  it('takes a meeting-platform tenant named for the county and state, whose home page is only script', async () => {
    const web = fakeWeb({
      'https://rivercoga.civicclerk.com/': {
        body: '<html><div id="root"></div><script src="/app.js"></script></html>',
      },
      'https://search-landing.example.com/': {
        body: '<html><a href="https://rivercoga.civicclerk.com/">meetings</a></html>',
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        { url: 'https://search-landing.example.com/', title: 'x' },
      ],
    };
    const county: LocalityConfig = {
      ...town,
      slug: 'river-county-ga',
      name: 'River County',
      kind: 'county',
      websites: [],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [county],
      existing: [],
      httpClient: web,
      search,
      now: today,
    });
    const portal = decisions.find(
      (decision) => decision.source.adapter === 'civicclerk'
    );
    expect(portal).toBeTruthy();
    expect(portal!.reasons[0] ?? '').not.toMatch(
      /may be another|does not say it is in/u
    );
  });

  it("treats the town's own site as its own even when search found the page", async () => {
    const pdfs = ['agenda-0914.pdf', 'minutes-0907.pdf', 'agenda-0831.pdf']
      .map((file) => `<a href="https://rivertonga.gov/files/${file}">x</a>`)
      .join('');
    const web = fakeWeb({
      'https://rivertonga.gov/': { body: '<html>City of Riverton</html>' },
      'https://rivertonga.gov/2026-minutes/': {
        body: `<html><title>2026 minutes</title>${pdfs}</html>`,
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        { url: 'https://rivertonga.gov/2026-minutes/', title: '2026 minutes' },
      ],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing: [],
      httpClient: web,
      search,
      now: today,
      officialSites: [
        {
          url: 'https://rivertonga.gov/',
          ownerSlug: 'riverton-ga',
          via: 'Wikidata',
        },
      ],
    });
    const minutes = decisions.find(
      (decision) =>
        decision.source.url === 'https://rivertonga.gov/2026-minutes/'
    );
    expect(minutes).toBeTruthy();
    expect(minutes!.official).toBe(true);
    expect(minutes!.reasons[0]!).not.toMatch(
      /not a government's own system|does not say it is in/u
    );
  });

  it("does not take a namesake county's site on its name alone", async () => {
    const web = fakeWeb({
      'https://rivercountymi.example.org/': {
        body: '<html><a href="/AgendaCenter">Agendas</a> Welcome to River County</html>',
      },
      'https://rivercountymi.example.org/AgendaCenter': {
        body: '<html><a href="/AgendaCenter/ViewFile/Agenda/_09142026-1">Agenda 09/14/2026</a></html>',
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        { url: 'https://rivercountymi.example.org/', title: 'River County' },
      ],
    };
    const county: LocalityConfig = {
      ...town,
      slug: 'river-county-ga',
      name: 'River County',
      kind: 'county',
      websites: [],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [county],
      existing: [],
      httpClient: web,
      search,
      now: today,
    });
    expect(decisions.length > 0).toBeTruthy();
    expect(
      decisions.every(
        (decision) =>
          !decision.adopted &&
          /may be another Riverton/u.test(decision.reasons[0]!)
      )
    ).toBeTruthy();
  });

  it("refuses a board's page inside an agenda centre already read", async () => {
    const web = fakeWeb({
      'https://rivertonga.gov/': {
        body: '<html><a href="/AgendaCenter/Mayor-and-Council-19">Council</a></html>',
      },
    });
    const existing = [
      {
        sourceKey: 'riverton-agendas',
        ownerSlug: 'riverton-ga',
        coverage: 'all',
        adapter: 'document',
        name: 'Riverton agenda center',
        url: 'https://www.rivertonga.gov/AgendaCenter',
        kind: 'meeting',
        config: { indexUrl: 'https://www.rivertonga.gov/AgendaCenter' },
      },
    ] as LocalityConfig['sources'];
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing,
      httpClient: web,
      now: today,
      officialSites: [
        {
          url: 'https://rivertonga.gov/',
          ownerSlug: 'riverton-ga',
          via: 'the .gov list',
        },
      ],
    });
    expect(decisions[0]?.adopted).toBe(false);
    expect(decisions[0]!.reasons[0]!).toMatch(
      /part of Riverton agenda center/u
    );
  });

  it("takes an agenda centre's other boards one at a time, not the whole centre around a board already read", async () => {
    const board = (name: string) =>
      `<html><a href="/AgendaCenter/ViewFile/Agenda/_09142026-${name.length}">Agenda 09/14/2026</a></html>`;
    const web = fakeWeb({
      'https://rivertonga.gov/': {
        body: '<html><a href="/AgendaCenter">Agendas</a></html>',
      },
      'https://rivertonga.gov/AgendaCenter': {
        body: '<html><a href="/AgendaCenter/City-Council-3">Council</a><a href="/AgendaCenter/Planning-Commission-5">Planning</a></html>',
      },
      'https://rivertonga.gov/AgendaCenter/Planning-Commission-5': {
        body: board('planning'),
      },
      'https://rivertonga.gov/AgendaCenter/ViewFile/Agenda/_09142026-8': {
        body: '%PDF-1.4 agenda',
        type: 'application/pdf',
      },
    });
    const existing = [
      {
        sourceKey: 'riverton-council',
        ownerSlug: 'riverton-ga',
        coverage: 'all',
        adapter: 'document',
        name: 'Riverton council agendas',
        url: 'https://rivertonga.gov/AgendaCenter/City-Council-3',
        kind: 'meeting',
        config: {
          indexUrl: 'https://rivertonga.gov/AgendaCenter/City-Council-3',
        },
      },
    ] as LocalityConfig['sources'];
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing,
      httpClient: web,
      now: today,
      officialSites: [
        {
          url: 'https://rivertonga.gov/',
          ownerSlug: 'riverton-ga',
          via: 'the .gov list',
        },
      ],
    });
    const whole = decisions.find(
      (decision) =>
        decision.source.url === 'https://rivertonga.gov/AgendaCenter'
    );
    expect(whole?.adopted).toBe(false);
    expect(whole!.reasons[0]!).toMatch(/contains Riverton council agendas/u);
    expect(
      decisions.some(
        (decision) =>
          decision.source.url ===
          'https://rivertonga.gov/AgendaCenter/Planning-Commission-5'
      )
    ).toBeTruthy();
  });

  it('sees a whole agenda centre on one domain around a board already read on another', async () => {
    const files = (host: string, names: string[]) =>
      names
        .map(
          (name) =>
            `<a href="https://${host}/AgendaCenter/ViewFile/Agenda/${name}">x</a>`
        )
        .join('');
    const council = ['_0914-1', '_0907-2', '_0831-3', '_0824-4'];
    const web = fakeWeb({
      'https://rivertonga.gov/': {
        body: '<html><a href="/AgendaCenter">Agendas</a></html>',
      },
      'https://rivertonga.gov/AgendaCenter': {
        body: `<html>${files('rivertonga.gov', [
          ...council,
          '_0915-p1',
          '_0901-p2',
        ])}</html>`,
      },
      'https://riverton.example.net/AgendaCenter/City-Council-3': {
        body: `<html>${files('riverton.example.net', council)}</html>`,
      },
    });
    const existing = [
      {
        sourceKey: 'riverton-council',
        ownerSlug: 'riverton-ga',
        coverage: 'all',
        adapter: 'document',
        name: 'Riverton council agendas',
        url: 'https://riverton.example.net/AgendaCenter/City-Council-3',
        kind: 'meeting',
        config: {
          indexUrl: 'https://riverton.example.net/AgendaCenter/City-Council-3',
        },
      },
    ] as LocalityConfig['sources'];
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing,
      httpClient: web,
      now: today,
      officialSites: [
        {
          url: 'https://rivertonga.gov/',
          ownerSlug: 'riverton-ga',
          via: 'the .gov list',
        },
      ],
    });
    const whole = decisions.find(
      (decision) =>
        decision.source.url === 'https://rivertonga.gov/AgendaCenter'
    );
    expect(whole?.adopted).toBe(false);
    expect(whole!.reasons[0]!).toMatch(/contains Riverton council agendas/u);
  });

  it("takes a school district's own site found by search, named for the town, as its own", async () => {
    const pdfs = ['agenda-0914.pdf', 'minutes-0907.pdf', 'agenda-0831.pdf']
      .map(
        (file) =>
          `<a href="https://www.rivertonschools.example.org/files/${file}">x</a>`
      )
      .join('');
    const web = fakeWeb({
      'https://www.rivertonschools.example.org/': {
        body: '<html>Riverton Public Schools, Riverton, GA</html>',
      },
      'https://www.rivertonschools.example.org/board/meetings': {
        body: `<html><title>Board meetings</title>${pdfs}</html>`,
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        {
          url: 'https://www.rivertonschools.example.org/board/meetings',
          title: 'Board meetings',
        },
      ],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing: [],
      httpClient: web,
      search,
      now: today,
    });
    const board = decisions.find(
      (decision) =>
        decision.source.url ===
        'https://www.rivertonschools.example.org/board/meetings'
    );
    expect(board).toBeTruthy();
    expect(board!.reasons[0]!).not.toMatch(/not a government's own system/u);
  });

  it("takes a county school district's site named for the county's bare name as its own", async () => {
    const pdfs = ['agenda-0914.pdf', 'minutes-0907.pdf', 'agenda-0831.pdf']
      .map(
        (file) =>
          `<a href="https://www.riverschools.example.org/files/${file}">x</a>`
      )
      .join('');
    const web = fakeWeb({
      'https://www.riverschools.example.org/': {
        body: '<html>River County School District, Georgia</html>',
      },
      'https://www.riverschools.example.org/board/meetings': {
        body: `<html><title>Board meetings</title>${pdfs}</html>`,
      },
    });
    const search = {
      name: 'test',
      search: async () => [
        {
          url: 'https://www.riverschools.example.org/board/meetings',
          title: 'Board meetings',
        },
      ],
    };
    const county: LocalityConfig = {
      ...town,
      slug: 'river-county-ga',
      name: 'River County',
      kind: 'county',
      websites: [],
    };
    const { decisions } = await discoverSources({
      locality: { ...town, name: 'Ferryport', websites: [] },
      ancestors: [county],
      existing: [],
      httpClient: web,
      search,
      now: today,
    });
    const board = decisions.find(
      (decision) =>
        decision.source.url ===
        'https://www.riverschools.example.org/board/meetings'
    );
    expect(board).toBeTruthy();
    expect(board!.reasons[0] ?? '').not.toMatch(
      /not a government's own system/u
    );
  });

  it('proposes each board of an agenda centre that shows them all on one page', async () => {
    const centre =
      '<html><h2 aria-controls="category-panel-3">City Council</h2><h2 aria-controls="category-panel-8">Planning &amp; Zoning Commission</h2></html>';
    const web = fakeWeb({
      'https://rivertonga.gov/': {
        body: '<html><a href="/AgendaCenter">Agendas</a></html>',
      },
      'https://rivertonga.gov/AgendaCenter': { body: centre },
    });
    const existing = [
      {
        sourceKey: 'riverton-council',
        ownerSlug: 'riverton-ga',
        coverage: 'all',
        adapter: 'document',
        name: 'Riverton council agendas',
        url: 'https://rivertonga.gov/AgendaCenter/City-Council-3',
        kind: 'meeting',
        config: {
          indexUrl: 'https://rivertonga.gov/AgendaCenter/City-Council-3',
        },
      },
    ] as LocalityConfig['sources'];
    const { decisions } = await discoverSources({
      locality: { ...town, websites: [] },
      ancestors: [],
      existing,
      httpClient: web,
      now: today,
      officialSites: [
        {
          url: 'https://rivertonga.gov/',
          ownerSlug: 'riverton-ga',
          via: 'the .gov list',
        },
      ],
    });
    const urls = decisions.map((decision) => decision.source.url);
    expect(
      urls.includes(
        'https://rivertonga.gov/AgendaCenter/Planning-Zoning-Commission-8'
      )
    ).toBeTruthy();
    expect(
      !urls.includes('https://rivertonga.gov/AgendaCenter/City-Council-3')
    ).toBeTruthy();
    expect(
      decisions.find((decision) => decision.source.url.endsWith('-8'))!.source
        .name
    ).toBe('Planning & Zoning Commission (rivertonga.gov)');
  });

  it('proposes an agenda centre as a document source', async () => {
    const web = fakeWeb({
      'https://riverton.example.gov/': {
        body: '<html><a href="/AgendaCenter/City-Council-3">Agendas</a></html>',
      },
      'https://riverton.example.gov/AgendaCenter/City-Council-3': {
        body: '<html><a href="/AgendaCenter/ViewFile/Agenda/_09142026-1">Agenda 09/14/2026</a></html>',
      },
    });
    const { decisions } = await discoverSources({
      locality: town,
      ancestors: [],
      existing: [],
      httpClient: web,
      now: today,
    });
    const agendas = decisions.find(
      (decision) => decision.source.adapter === 'document'
    );
    expect(agendas).toBeTruthy();
    expect((agendas!.source.config as { indexUrl: string }).indexUrl).toBe(
      'https://riverton.example.gov/AgendaCenter/City-Council-3'
    );
  });
});

describe('adopted sources in the registry', () => {
  it('merges what the engine adopted beside the hand-written sources, validated the same way', () => {
    const root = mkdtempSync(join(tmpdir(), 'sources-'));
    try {
      mkdirSync(join(root, 'localities'));
      mkdirSync(join(root, 'discovered'));
      writeFileSync(
        join(root, 'localities', 'riverton.yaml'),
        'slug: riverton-ga\nname: Riverton\nstate: GA\ntimezone: America/New_York\nlat: 31\nlon: -83\nkind: town\nparents: []\nedition: true\ncadence: [daily]\ntopics: []\n' +
          'sources:\n  - { sourceKey: riverton-news, adapter: rss, name: Riverton, url: "https://riverton.example.gov/feed/", kind: news }\n'
      );
      writeFileSync(
        join(root, 'discovered', 'riverton-ga.json'),
        JSON.stringify({
          localitySlug: 'riverton-ga',
          sources: [
            {
              source: {
                sourceKey: 'riverton-agendas',
                adapter: 'document',
                name: 'Agendas',
                url: 'https://riverton.example.gov/AgendaCenter/City-Council-3',
                kind: 'meeting',
                config: {
                  indexUrl:
                    'https://riverton.example.gov/AgendaCenter/City-Council-3',
                },
              },
              discoveredAt: '2026-09-22T00:00:00Z',
              via: 'test',
              evidence: [],
            },
            {
              source: {
                sourceKey: 'riverton-dup',
                adapter: 'rss',
                name: 'Same feed',
                url: 'https://www.riverton.example.gov/feed',
                kind: 'news',
              },
              discoveredAt: '2026-09-22T00:00:00Z',
              via: 'test',
              evidence: [],
            },
          ],
        })
      );
      const without = loadLocalityRegistry(join(root, 'localities'), undefined);
      expect(
        without.get('riverton-ga').sources.map((source) => source.sourceKey)
      ).toStrictEqual(['riverton-news']);
      const merged = loadLocalityRegistry(
        join(root, 'localities'),
        join(root, 'discovered')
      );
      expect(
        merged.get('riverton-ga').sources.map((source) => source.sourceKey)
      ).toStrictEqual(['riverton-news', 'riverton-agendas']);

      writeFileSync(
        join(root, 'discovered', 'riverton-ga.json'),
        JSON.stringify({
          localitySlug: 'riverton-ga',
          sources: [
            {
              source: {
                sourceKey: 'bad',
                adapter: 'rss',
                name: 'Bad',
                url: 'not a url',
                kind: 'news',
              },
              discoveredAt: '',
              via: '',
              evidence: [],
            },
          ],
        })
      );
      expect(() =>
        loadLocalityRegistry(join(root, 'localities'), join(root, 'discovered'))
      ).toThrow(/url/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
