import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  GreenhouseDiscoveryProvider,
  LeverDiscoveryProvider,
} from './aspirational-ats.provider';
import { candidateTokens } from './ats-board.util';

const topicWith = (companies: unknown[]): LeadTopic =>
  ({
    id: 'topic-ats',
    name: 'React',
    keywords: ['react'],
    excludedTerms: ['wordpress'],
    discoveryIntent: 'job-openings',
    aspirationalCompanies: companies,
    enabled: true,
    leadCount: 0,
  } as unknown as LeadTopic);

const jsonOk = (payload: unknown) =>
  ({ ok: true, status: 200, json: async () => payload } as unknown as Response);

describe('aspirational ATS providers', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('says what to do rather than failing when no companies are named', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await new GreenhouseDiscoveryProvider().search(
      topicWith([])
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.warnings.join(' ')).toContain('Add at least one');
  });

  it('only queries boards belonging to its own ATS', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonOk({ jobs: [] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await new GreenhouseDiscoveryProvider().search(
      topicWith([
        { provider: 'greenhouse', token: 'figma', label: 'Figma' },
        { provider: 'lever', token: 'leverdemo', label: 'Lever Demo' },
      ])
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('greenhouse');
  });

  it('maps a Greenhouse opening to a lead', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonOk({
        jobs: [
          {
            id: 1,
            title: 'Senior React Engineer',
            absolute_url: 'https://boards.greenhouse.io/figma/jobs/1',
            location: { name: 'Remote' },
          },
        ],
      })
    ) as unknown as typeof fetch;

    const result = await new GreenhouseDiscoveryProvider().search(
      topicWith([{ provider: 'greenhouse', token: 'figma', label: 'Figma' }])
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].lead.company).toBe('Figma');
    expect(result.candidates[0].lead.notes).toContain('Dream-company opening');
  });

  it('maps a Lever opening to a lead', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonOk([
        {
          id: 'abc',
          text: 'React Engineer',
          hostedUrl: 'https://jobs.lever.co/leverdemo/abc',
          categories: { location: 'Remote' },
        },
      ])
    ) as unknown as typeof fetch;

    const result = await new LeverDiscoveryProvider().search(
      topicWith([
        { provider: 'lever', token: 'leverdemo', label: 'Lever Demo' },
      ])
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].lead.originalPostingUrl).toContain('lever.co');
  });

  it('reports a board that has disappeared instead of silently finding nothing', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    global.fetch = global.fetch as unknown as typeof fetch;

    const result = await new GreenhouseDiscoveryProvider().search(
      topicWith([{ provider: 'greenhouse', token: 'gone', label: 'Gone Inc' }])
    );

    expect(result.warnings.join(' ')).toContain('no longer has a Greenhouse');
  });

  it('frames a quiet board as normal, not as a failure', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonOk({ jobs: [] })) as unknown as typeof fetch;

    const result = await new GreenhouseDiscoveryProvider().search(
      topicWith([{ provider: 'greenhouse', token: 'figma', label: 'Figma' }])
    );

    expect(result.candidates).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('long shots');
  });
});

describe('candidateTokens', () => {
  it('offers the conventional token forms for a company name', () => {
    expect(candidateTokens('Clean Harbors')).toEqual(
      expect.arrayContaining(['cleanharbors', 'clean-harbors', 'clean'])
    );
  });

  it('drops legal suffixes and punctuation', () => {
    expect(candidateTokens('Acme & Sons, Inc.')).toEqual(
      expect.arrayContaining(['acmeandsons'])
    );
  });
});
