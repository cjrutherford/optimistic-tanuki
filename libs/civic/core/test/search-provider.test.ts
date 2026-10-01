import {
  searchProviderFromEnvironment,
  searxngSearch,
} from '../src/search-provider.js';

describe('search providers', () => {
  it('asks SearXNG for JSON and keeps only web addresses', async () => {
    let asked = '';
    const provider = searxngSearch('http://127.0.0.1:8980/', async (input) => {
      asked = String(input);
      return new Response(
        JSON.stringify({
          results: [
            {
              url: 'https://tiftonga.gov/AgendaCenter',
              title: 'Agenda Center',
            },
            { url: 'javascript:alert(1)', title: 'no' },
            { title: 'no address' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    const results = await provider.search('Tifton GA city council agenda');
    expect(asked).toMatch(/^http:\/\/127\.0\.0\.1:8980\/search\?q=Tifton\+GA/u);
    expect(asked).toMatch(/format=json/u);
    expect(results).toStrictEqual([
      { url: 'https://tiftonga.gov/AgendaCenter', title: 'Agenda Center' },
    ]);
  });

  it('reports a failed search rather than returning nothing quietly', async () => {
    const provider = searxngSearch(
      'http://127.0.0.1:8980',
      async () => new Response('busy', { status: 429 })
    );
    await expect((() => provider.search('x'))()).rejects.toThrow(/HTTP 429/u);
  });

  it('is chosen from the environment, and is off when nothing is configured', () => {
    expect(searchProviderFromEnvironment({})).toBe(null);
    expect(
      searchProviderFromEnvironment({ SEARCH_URL: 'http://127.0.0.1:8980' })
        ?.name
    ).toBe('searxng');
    expect(() =>
      searchProviderFromEnvironment({ SEARCH_PROVIDER: 'searxng' })
    ).toThrow(/needs SEARCH_URL/u);
    expect(() =>
      searchProviderFromEnvironment({ SEARCH_PROVIDER: 'brave' })
    ).toThrow(/needs SEARCH_API_KEY/u);
    expect(() =>
      searchProviderFromEnvironment({ SEARCH_PROVIDER: 'google' })
    ).toThrow(/not supported/u);
  });
});
