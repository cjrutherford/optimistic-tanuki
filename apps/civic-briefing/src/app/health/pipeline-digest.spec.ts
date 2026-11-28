import type { PipelineHealthReport } from '@optimistic-tanuki/models';
import { failureCause } from './failure-cause';
import {
  buildDigest,
  digestSchedule,
  type DigestInput,
  localClock,
  renderDigest,
} from './pipeline-digest';

const report = (): PipelineHealthReport => ({
  configured: true,
  checkedAt: '2026-11-28T12:00:00.000Z',
  towns: [
    { slug: 'adel-ga', name: 'Adel', lastRun: null, problems: [] },
    {
      slug: 'tifton-ga',
      name: 'Tifton',
      lastRun: null,
      problems: [
        {
          sourceId: 'tifton-agendas',
          adapter: 'civicplus',
          status: 'failing',
          stalenessDays: null,
          consecutiveFailures: 5,
          lastSuccessAt: null,
        },
        {
          sourceId: 'tifton-news',
          adapter: 'rss',
          status: 'stale',
          stalenessDays: 4,
          consecutiveFailures: 0,
          lastSuccessAt: null,
        },
      ],
    },
    { slug: 'quitman-ga', name: 'Quitman', lastRun: null, problems: [] },
    {
      slug: 'sparks-ga',
      name: 'Sparks',
      lastRun: null,
      problems: [],
      noSources: true,
      requestCount: 3,
    },
  ],
});

const unavailable =
  'Strict brief failed after 2 model attempt(s): Ollama request unavailable: connect ECONNREFUSED 192.168.1.180:11434';
const roleRule =
  'Invalid story output: story claims has no valid entries; claim-grounding/unsupported-named-institutional-role: story claim 1 contains role(s)';

const call = (
  overrides: Partial<DigestInput['generations'][number]>
): DigestInput['generations'][number] => ({
  operation: 'story',
  model: 'qwen3.5:4b-q8_0',
  status: 'successful',
  error: null,
  latencyMs: 5000,
  generatedAt: '2026-11-28T10:15:00.000Z',
  ...overrides,
});

const input = (overrides: Partial<DigestInput> = {}): DigestInput => ({
  since: '2026-11-27T12:00:00.000Z',
  until: '2026-11-28T12:00:00.000Z',
  report: report(),
  runs: [
    { localitySlug: 'adel-ga', status: 'partial_success', error: null },
    { localitySlug: 'tifton-ga', status: 'failed', error: unavailable },
    {
      localitySlug: 'tifton-ga',
      status: 'failed',
      error: unavailable.replace('180', '181'),
    },
  ],
  generations: [
    call({}),
    call({ status: 'failed', error: roleRule }),
    call({
      status: 'failed',
      error: 'Ollama request unavailable: [object Object]',
    }),
  ],
  alerts: { opened: 2, resolved: 1 },
  ...overrides,
});

describe('failureCause', () => {
  it('folds the same outage on different runs into one cause', () => {
    expect(failureCause(unavailable).key).toBe('model-unavailable');
    expect(failureCause('Ollama request timeout after 300000ms').key).toBe(
      'model-timeout'
    );
  });

  it('names the grounding rule that rejected an output', () => {
    expect(failureCause(roleRule)).toMatchObject({
      key: 'grounding:unsupported-named-institutional-role',
      kind: 'grounding',
    });
  });

  it('strips run-specific paths and numbers from pipeline faults', () => {
    expect(
      failureCause('publication lock busy: /usr/src/app/data/publication.lock')
        .key
    ).toBe(failureCause('publication lock busy: /srv/other.lock').key);
    expect(failureCause(null).key).toBe('unknown');
  });
});

describe('buildDigest', () => {
  it('counts towns, runs and model calls over the window', () => {
    const digest = buildDigest(input());
    expect(digest.towns).toEqual({
      ran: 2,
      succeeded: 1,
      failedOnly: 1,
    });
    expect(digest.runs).toMatchObject({ total: 3, partial: 1, failed: 2 });
    expect(digest.calls).toEqual({ total: 3, successful: 1, unavailable: 1 });
  });

  it('groups failed runs by cause rather than by run', () => {
    const [cause] = buildDigest(input()).runFailures;
    expect(cause).toMatchObject({
      key: 'model-unavailable',
      count: 2,
      towns: ['Tifton'],
    });
  });

  it('keeps unreachable calls out of the rejection reasons', () => {
    const { rejections } = buildDigest(input());
    expect(rejections.map((r) => [r.key, r.count])).toEqual([
      ['grounding:unsupported-named-institutional-role', 1],
    ]);
  });

  it('calls an hour of unreachable calls an outage and says what to check', () => {
    const generations = Array.from({ length: 6 }, () =>
      call({ status: 'failed', error: unavailable })
    );
    const digest = buildDigest(input({ generations }));
    expect(digest.outageHours).toBe(1);
    expect(digest.verdict).toBe('outage');
    expect(digest.improvements[0]).toMatch(/unreachable.*Ollama/);
  });

  it('flags a model that rarely passes and readers asking for a town without sources', () => {
    const generations = [
      ...Array.from({ length: 4 }, () =>
        call({ model: 'qwen2.5:7b-instruct' })
      ),
      ...Array.from({ length: 21 }, () =>
        call({
          model: 'qwen2.5:7b-instruct',
          status: 'failed',
          error: roleRule,
        })
      ),
    ];
    const { improvements } = buildDigest(input({ generations }));
    expect(improvements.join('\n')).toContain(
      'qwen2.5:7b-instruct passed only 16% of story calls (4 of 25)'
    );
    expect(improvements.join('\n')).toContain('Sparks (3)');
  });

  it('is idle, not healthy, when nothing ran', () => {
    expect(buildDigest(input({ runs: [], generations: [] })).verdict).toBe(
      'idle'
    );
  });
});

describe('renderDigest', () => {
  it('writes the three sections in text and HTML, escaping town data', () => {
    const digest = buildDigest(input());
    digest.runFailures[0].towns = ['<Tifton>'];
    const { subject, text, html } = renderDigest(digest, '2026-11-28');
    expect(subject).toBe(
      'Daylight daily digest 2026-11-28: Degraded · 1/2 towns published · 2 failed runs'
    );
    for (const section of ['WHAT WORKED', "WHAT DIDN'T", 'WHAT TO IMPROVE'])
      expect(text).toContain(section);
    expect(text).toContain('2 × model service unreachable (<Tifton>)');
    expect(text).toContain('tifton-agendas (civicplus) failing, 5 attempts');
    expect(html).toContain('&lt;Tifton&gt;');
    expect(html).not.toContain('<Tifton>');
  });
});

describe('failing sources in the digest', () => {
  it('lists one line per town, not one per source', () => {
    const base = report();
    const tifton = base.towns[1];
    tifton.problems = Array.from({ length: 3 }, (_, i) => ({
      ...tifton.problems[0],
      sourceId: `tifton-doc-${i}`,
      consecutiveFailures: i + 2,
    }));
    const { text } = renderDigest(
      buildDigest(input({ report: base })),
      '2026-11-28'
    );
    expect(text).toContain(
      'Tifton: 3 sources failing (civicplus), up to 4 attempts in a row'
    );
    expect(text).not.toContain('tifton-doc-0');
  });

  it('measures latency over answered calls only', () => {
    const generations = [
      call({ latencyMs: 40_000 }),
      call({ status: 'failed', error: unavailable, latencyMs: 9 }),
    ];
    expect(buildDigest(input({ generations })).models[0].p95LatencyMs).toBe(
      40_000
    );
  });
});

describe('digest schedule', () => {
  it('falls back to the alert addresses and a 07:00 Eastern send', () => {
    expect(
      digestSchedule({ DAYLIGHT_ALERT_EMAIL: 'a@example.com, b@example.com' })
    ).toEqual({
      at: '07:00',
      timeZone: 'America/New_York',
      recipients: ['a@example.com', 'b@example.com'],
    });
    expect(
      digestSchedule({
        DAYLIGHT_ALERT_EMAIL: 'a@example.com',
        DAYLIGHT_DIGEST_EMAIL: 'd@example.com',
        DAYLIGHT_DIGEST_AT: '6:30',
      })
    ).toMatchObject({ at: '07:00', recipients: ['d@example.com'] });
  });

  it('reads the local date and time in the digest timezone', () => {
    expect(
      localClock(new Date('2026-11-28T04:30:00.000Z'), 'America/New_York')
    ).toEqual({ date: '2026-11-27', time: '23:30' });
  });
});
