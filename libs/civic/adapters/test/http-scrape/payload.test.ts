import { httpScrapeAdapter } from '../../src/http-scrape/index.js';

const source = {
  sourceKey: 'http-test',
  ownerSlug: 'town-a',
  coverage: 'mentions' as const,
  adapter: 'http-scrape',
  name: 'Town page',
  url: 'https://example.test',
  kind: 'news' as const,
};

describe('http scrape payload contract', () => {
  it('parses link payloads without a legacy raw body', async () => {
    const [item] = await httpScrapeAdapter.parse(
      {
        url: 'https://example.test/minutes.pdf',
        contentType: 'text/html-link',
        payload: {
          kind: 'text',
          body: JSON.stringify({ anchorText: 'September minutes' }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.title).toBe('September minutes');
  });

  it('extracts page text without navigation, footers, or link lists', async () => {
    const html =
      '<html><head><title>Public notice</title></head><body><nav><a href="/">Home</a> <a href="/departments">Departments</a></nav><main><h1>Public notice</h1><p>The planning commission will hold a public hearing on the rezoning request at 6 p.m. on October 5 at City Hall.</p><ul class="quick-links"><li><a href="/pay">Pay a bill</a></li><li><a href="/jobs">Jobs</a></li></ul></main><footer>Copyright 2026 City</footer></body></html>';
    const [item] = await httpScrapeAdapter.parse(
      {
        url: 'https://example.test/notice',
        contentType: 'text/html',
        payload: { kind: 'text', body: html },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.title).toBe('Public notice');
    expect(item.body).toMatch(/planning commission will hold a public hearing/);
    expect(item.body).not.toMatch(/Departments|Pay a bill|Jobs|Copyright/);
  });
});
