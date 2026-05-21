import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { JustRemoteDiscoveryProvider } from './justremote-discovery.provider';

describe('JustRemoteDiscoveryProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('falls back to embedded html job data when the rss endpoint returns an app shell', async () => {
    const topic = {
      id: 'topic-1',
      name: 'Customer Success',
      description: 'Customer success roles',
      keywords: ['customer success'],
      excludedTerms: [],
      discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources: [LeadDiscoverySource.JUST_REMOTE],
      enabled: true,
      lastRun: undefined,
      leadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeadTopic;

    global.fetch = jest.fn().mockResolvedValue({
      text: async () => `
        <html>
          <script id="__PRELOADED_STATE__" type="application/json">
            {"jobsState":{"entity":{"jobs":[{"title":"Customer Success Manager","company_name":"Outreach","href":"remote-customer-service-jobs/customer-success-manager-outreach","remote_type":"Fully Remote","location_restrictions":["United States"],"raw_date":"2026-03-26T11:00:00.620Z"}]}}}
          </script>
        </html>
      `,
    }) as typeof fetch;

    const provider = new JustRemoteDiscoveryProvider();
    const result = await provider.search(topic);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].lead.name).toBe('Customer Success Manager');
    expect(result.candidates[0].lead.company).toBe('Outreach');
    expect(result.candidates[0].lead.originalPostingUrl).toBe(
      'https://justremote.co/remote-customer-service-jobs/customer-success-manager-outreach'
    );
  });
});
