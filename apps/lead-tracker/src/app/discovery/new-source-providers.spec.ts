import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadDiscoverySource } from '@optimistic-tanuki/models/leads-contracts';
import { ArbeitnowDiscoveryProvider } from './arbeitnow-discovery.provider';
import { RemotiveDiscoveryProvider } from './remotive-discovery.provider';
import { TheMuseDiscoveryProvider } from './the-muse-discovery.provider';
import { HackerNewsDiscoveryProvider } from './hacker-news-discovery.provider';

const buildTopic = (source: LeadDiscoverySource): LeadTopic =>
  ({
    id: `topic-${source}`,
    name: 'React',
    description: 'React roles',
    keywords: ['react'],
    excludedTerms: ['wordpress'],
    discoveryIntent: 'job-openings',
    sources: [source],
    enabled: true,
    leadCount: 0,
  } as unknown as LeadTopic);

const jsonResponse = (payload: unknown) =>
  ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  } as unknown as Response);

describe('newly added discovery providers', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Arbeitnow', () => {
    it('maps a matching job and honours excluded terms', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          data: [
            {
              slug: 'react-dev-1',
              title: 'React Developer',
              company_name: 'Acme',
              description: 'We need React skills',
              url: 'https://www.arbeitnow.com/jobs/react-dev-1',
              tags: [],
            },
            {
              slug: 'wp-dev-1',
              title: 'WordPress Developer',
              company_name: 'Other',
              description: 'React and wordpress',
              url: 'https://www.arbeitnow.com/jobs/wp-dev-1',
              tags: [],
            },
          ],
        })
      ) as unknown as typeof fetch;

      const result = await new ArbeitnowDiscoveryProvider().search(
        buildTopic(LeadDiscoverySource.ARBEITNOW)
      );

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].lead.company).toBe('Acme');
      expect(result.candidates[0].lead.originalPostingUrl).toContain(
        'arbeitnow.com'
      );
      expect(result.warnings.join(' ')).toContain('Excluded 1');
    });
  });

  describe('Remotive', () => {
    it('narrows the request with the topic keyword', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ jobs: [] }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await new RemotiveDiscoveryProvider().search(
        buildTopic(LeadDiscoverySource.REMOTIVE)
      );

      // The board is large; searching server-side beats pulling everything.
      expect(fetchMock.mock.calls[0][0]).toContain('search=react');
      expect(result.queries[0]).toContain('search=react');
    });

    it('maps a matching job', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse({
          jobs: [
            {
              id: 1,
              title: 'Senior React Engineer',
              company_name: 'Globex',
              url: 'https://remotive.com/remote-jobs/1',
              description: 'React work',
              tags: ['react'],
              candidate_required_location: 'USA',
            },
          ],
        })
      ) as unknown as typeof fetch;

      const result = await new RemotiveDiscoveryProvider().search(
        buildTopic(LeadDiscoverySource.REMOTIVE)
      );

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].lead.company).toBe('Globex');
      expect(result.candidates[0].lead.notes).toContain('USA');
    });
  });

  describe('The Muse', () => {
    it('reads the nested company and landing page refs', async () => {
      // Second page comes back empty so paging stops; returning the same page
      // twice would double-count every result.
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            results: [
              {
                id: 5,
                name: 'React Engineer',
                contents: '<p>React role</p>',
                company: { name: 'Initech' },
                refs: {
                  landing_page: 'https://www.themuse.com/jobs/initech/x',
                },
                locations: [{ name: 'Remote' }],
                levels: [{ name: 'Mid Level' }],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({ results: [] })
        ) as unknown as typeof fetch;

      const result = await new TheMuseDiscoveryProvider().search(
        buildTopic(LeadDiscoverySource.THE_MUSE)
      );

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].lead.company).toBe('Initech');
      expect(result.candidates[0].lead.originalPostingUrl).toContain(
        'themuse.com'
      );
      expect(result.candidates[0].lead.notes).toContain('Remote');
    });
  });

  describe('Hacker News', () => {
    it('resolves the monthly thread before reading its comments', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            hits: [{ objectID: '111', title: 'Ask HN: Who is hiring?' }],
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            hits: [
              {
                objectID: '222',
                author: 'someone',
                comment_text: 'Acme Corp | React Engineer | Remote | full-time',
              },
            ],
          })
        );
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await new HackerNewsDiscoveryProvider().search(
        buildTopic(LeadDiscoverySource.HACKER_NEWS)
      );

      // Searching HN comments at large would return arbitrary discussion.
      expect(fetchMock.mock.calls[1][0]).toContain('story_111');
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].lead.company).toBe('Acme Corp');
      expect(result.candidates[0].lead.name).toBe('React Engineer');
      expect(result.candidates[0].lead.originalPostingUrl).toContain(
        'item?id=222'
      );
    });

    it('warns rather than guessing when no hiring thread is found', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          jsonResponse({ hits: [{ objectID: '9', title: 'Something else' }] })
        ) as unknown as typeof fetch;

      const result = await new HackerNewsDiscoveryProvider().search(
        buildTopic(LeadDiscoverySource.HACKER_NEWS)
      );

      expect(result.candidates).toHaveLength(0);
      expect(result.warnings.join(' ')).toContain('Who is hiring');
    });
  });
});
