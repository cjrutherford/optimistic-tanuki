import {
  civicClerkAdapter,
  parseCivicClerkList,
} from '../../src/civicclerk/index.js';

const PAGE = `<html><body><ul class="meetings">
<li>Sep 2, 2026 Regular Meeting <a href="/web/agendas/42.pdf">Agenda Packet</a></li>
<li>Aug 19, 2026 <a href="/web/minutes/41.pdf">Minutes</a></li>
<li><a href="/home">Home</a></li>
</ul></body></html>`;

describe('parseCivicClerkList', () => {
  it('extracts agenda/minutes links with context', () => {
    const links = parseCivicClerkList(
      PAGE,
      'https://demo.civicclerk.com/web/meetings'
    );
    expect(links.length).toBe(2);
    expect(links[0].context.includes('Sep 2, 2026')).toBeTruthy();
    expect(
      links.every((l) => l.url.startsWith('https://demo.civicclerk.com/'))
    ).toBeTruthy();
  });

  it('parses the emitted text payload contract', async () => {
    const source = {
      sourceKey: 'x',
      ownerSlug: 'town-a',
      coverage: 'mentions' as const,
      adapter: 'civicclerk',
      name: 'CivicClerk',
      url: 'https://demo.civicclerk.com',
      kind: 'meeting' as const,
    };
    const [item] = await civicClerkAdapter.parse(
      {
        url: 'https://demo.civicclerk.com/web/agendas/42.pdf',
        contentType: 'application/civicclerk-link+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            title: 'Agenda Packet',
            url: 'https://demo.civicclerk.com/web/agendas/42.pdf',
            context: 'Sep 2, 2026 Regular Meeting',
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.title).toBe('Agenda Packet');
  });
});

describe('the CivicClerk API', () => {
  const source = {
    sourceKey: 'escambia-civicclerk',
    ownerSlug: 'escambia-county-fl',
    coverage: 'mentions' as const,
    adapter: 'civicclerk',
    name: 'Escambia County meetings',
    url: 'https://escambiacofl.portal.civicclerk.com/',
    kind: 'meeting' as const,
  };

  it('names the tenant of a hosted portal, whichever address it is given by', async () => {
    const { civicClerkTenant } = await import('../../src/civicclerk/index.js');
    expect(civicClerkTenant('https://escambiacofl.civicclerk.com')).toBe(
      'escambiacofl'
    );
    expect(
      civicClerkTenant('https://escambiacofl.portal.civicclerk.com/event/1')
    ).toBe('escambiacofl');
    expect(civicClerkTenant('https://www.civicclerk.com/')).toBe(null);
    expect(civicClerkTenant('https://example.gov/agendas')).toBe(null);
  });

  it('reads each published agenda and minutes as text, and leaves the packets', async () => {
    const requested: string[] = [];
    const events = {
      value: [
        {
          id: 3024,
          eventName: 'First Budget Public Hearing',
          startDateTime: '2026-09-08T17:01:00Z',
          categoryName: 'Budget Workshops',
          publishedFiles: [
            { fileId: 5207, type: 'Agenda', name: 'Summary Agenda' },
            { fileId: 5208, type: 'Agenda Packet', name: 'Detail Agenda' },
            { fileId: 5301, type: 'Minutes', name: 'Minutes' },
          ],
        },
      ],
    };
    const httpClient = {
      fetch: async (url: string) => {
        requested.push(url);
        if (url.includes('/v1/Events?'))
          return new Response(JSON.stringify(events), {
            status: 200,
            headers: {
              'content-type': 'application/json; odata.metadata=minimal',
            },
          });
        return new Response(
          `AGENDA First Budget Public Hearing September 8, 2026 ${
            url.includes('5301')
              ? 'MINUTES The Board adopted the tentative budget.'
              : '1. Public Hearing for the Tentative Budget'
          }`,
          { status: 200, headers: { 'content-type': 'text/plain' } }
        );
      },
    };
    const results = await civicClerkAdapter.fetch(source, {
      locality: {} as never,
      httpClient: httpClient as never,
    });
    expect(results.length).toBe(2);
    expect(
      requested.every((url) =>
        url.startsWith('https://escambiacofl.api.civicclerk.com/v1/')
      )
    ).toBeTruthy();
    expect(!requested.some((url) => url.includes('5208'))).toBeTruthy();
    const items = await Promise.all(
      results.map((result) =>
        result.kind === 'fetched'
          ? civicClerkAdapter.parse(
              {
                url: result.url,
                contentType: result.contentType,
                payload: result.payload!,
                fetchedAt: result.fetchedAt,
              },
              source
            )
          : Promise.resolve([])
      )
    );
    expect(
      items.flat().map((item) => [item.title, item.eventDate, item.uris?.[0]])
    ).toStrictEqual([
      [
        'First Budget Public Hearing Agenda 2026-09-08',
        '2026-09-08',
        'https://escambiacofl.portal.civicclerk.com/event/3024/files/agenda/5207',
      ],
      [
        'First Budget Public Hearing Minutes 2026-09-08',
        '2026-09-08',
        'https://escambiacofl.portal.civicclerk.com/event/3024/files/minutes/5301',
      ],
    ]);
  });

  it("follows the API's pages to the most recent records", async () => {
    const page = (ids: number[], next?: string) => ({
      value: ids.map((id) => ({
        id,
        eventName: `Meeting ${id}`,
        startDateTime: `2026-09-${String(id).padStart(2, '0')}T09:00:00Z`,
        publishedFiles: [{ fileId: 100 + id, type: 'Agenda', name: 'Agenda' }],
      })),
      ...(next ? { '@odata.nextLink': next } : {}),
    });
    const httpClient = {
      fetch: async (url: string) => {
        if (url.includes('/v1/Events?$filter'))
          return new Response(
            JSON.stringify(
              page(
                [1, 2],
                'https://escambiacofl.api.civicclerk.com/v1/Events?$skip=2'
              )
            ),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        if (url.includes('$skip=2'))
          return new Response(JSON.stringify(page([20, 21])), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        return new Response('AGENDA text', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
      },
    };
    const results = await civicClerkAdapter.fetch(
      { ...source, config: { maxDocs: 2 } } as never,
      { locality: {} as never, httpClient: httpClient as never }
    );
    expect(results.map((result) => result.url)).toStrictEqual([
      'https://escambiacofl.portal.civicclerk.com/event/21/files/agenda/121',
      'https://escambiacofl.portal.civicclerk.com/event/20/files/agenda/120',
    ]);
  });
});
