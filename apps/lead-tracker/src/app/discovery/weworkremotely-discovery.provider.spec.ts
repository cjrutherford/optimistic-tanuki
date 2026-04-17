import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { WeWorkRemotelyDiscoveryProvider } from './weworkremotely-discovery.provider';

describe('WeWorkRemotelyDiscoveryProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('skips stale RSS items and only keeps recent matching jobs', async () => {
    const topic = {
      id: 'topic-1',
      name: 'React',
      description: 'React jobs',
      keywords: ['react'],
      excludedTerms: [],
      discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources: [LeadDiscoverySource.WE_WORK_REMOTELY],
      enabled: true,
      lastRun: undefined,
      leadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeadTopic;

    global.fetch = jest.fn().mockResolvedValue({
      text: async () => `
        <rss><channel>
          <item>
            <title>Old Co: Senior React Engineer</title>
            <description>Legacy React work.</description>
            <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
            <link>https://weworkremotely.com/old</link>
          </item>
          <item>
            <title>New Co: Senior React Engineer</title>
            <description>Current React role.</description>
            <pubDate>${new Date().toUTCString()}</pubDate>
            <link>https://weworkremotely.com/new</link>
          </item>
        </channel></rss>
      `,
    }) as typeof fetch;

    const provider = new WeWorkRemotelyDiscoveryProvider();
    const result = await provider.search(topic);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].lead.originalPostingUrl).toBe(
      'https://weworkremotely.com/new'
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Skipped 1 stale We Work Remotely feed item'),
      ])
    );
  });
});
