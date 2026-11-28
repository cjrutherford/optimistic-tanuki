import {
  LlmGenerationSchema,
  type LocalityConfig,
  PipelineRunSchema,
} from '@optimistic-tanuki/civic-core';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import type { PipelineHealthReport } from '@optimistic-tanuki/models';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { SourceRequestSchema } from '../registry/source-request.schema';
import { SourcingDecisionSchema } from '../schedule/sourcing-decision.schema';
import { BRIEFING_SCHEMAS } from '../schemas';
import { DaylightAlertSchema } from './daylight-alert.schema';
import {
  alertRecipients,
  PipelineAlerts,
  pipelineProblems,
  pipelineReport,
} from './pipeline-health';
import { DigestSender } from './pipeline-digest';
import { loadTrend } from './pipeline-trend';

const town = (slug: string, name: string) =>
  ({
    slug,
    name,
    state: 'GA',
    timezone: 'America/New_York',
    lat: 31,
    lon: -83,
    sources: [],
  } as unknown as LocalityConfig);

/** A report with one failed run in Adel and one failing source in Tifton. */
const troubled = (): PipelineHealthReport => ({
  configured: true,
  checkedAt: '2026-10-04T12:00:00.000Z',
  towns: [
    {
      slug: 'adel-ga',
      name: 'Adel',
      lastRun: {
        runId: 7,
        status: 'failed',
        cadence: 'daily',
        startedAt: '2026-10-04T06:00:00.000Z',
        completedAt: '2026-10-04T06:03:00.000Z',
        currentStage: 'briefing',
        error: 'model timed out',
      },
      problems: [],
    },
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
          consecutiveFailures: 4,
          lastSuccessAt: null,
        },
      ],
    },
  ],
});

describe('pipeline health and alerts (P5.2)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url: (await createTestSchema()).url,
      entities: BRIEFING_SCHEMAS,
      synchronize: true,
    });
    await ds.initialize();
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  beforeEach(async () => {
    await ds.getRepository(DaylightAlertSchema).clear();
    await ds.getRepository(PipelineRunSchema).clear();
    await ds.getRepository(LlmGenerationSchema).clear();
  });

  it('says so when there is no locality registry', async () => {
    const report = await pipelineReport(ds, null);
    expect(report.configured).toBe(false);
    expect(report.towns).toEqual([]);
  });

  it("reports each town's latest run", async () => {
    const run = (startedAt: string, status: string) => ({
      scopeSlug: 'adel-ga',
      localitySlug: 'adel-ga',
      cadence: 'daily',
      startedAt,
      completedAt: startedAt,
      status,
      ruleVersion: 'v',
      counts: '{}',
      coverageGaps: '[]',
      error: status === 'failed' ? 'model timed out' : null,
      coverageRanges: '{}',
    });
    await ds
      .getRepository(PipelineRunSchema)
      .insert([
        run('2026-10-03T06:00:00.000Z', 'succeeded'),
        run('2026-10-04T06:00:00.000Z', 'failed'),
      ] as never);
    const report = await pipelineReport(ds, [
      town('adel-ga', 'Adel'),
      town('tifton-ga', 'Tifton'),
    ]);
    expect(report.configured).toBe(true);
    expect(
      report.towns.map((t) => [t.slug, t.lastRun?.status ?? null])
    ).toEqual([
      ['adel-ga', 'failed'],
      ['tifton-ga', null],
    ]);
    expect(report.towns[0]?.lastRun?.error).toBe('model timed out');
  });

  it('reports a searched town with no sources as no-sources, with its request count, and raises no run alert', async () => {
    await ds.getRepository(SourcingDecisionSchema).insert({
      slug: 'adel-ga',
      decision: 'searched',
      localDate: '2026-10-04',
      detail: '{}',
      decidedAt: new Date(),
    });
    await ds.getRepository(SourceRequestSchema).insert([
      { id: randomUUID(), slug: 'adel-ga', userId: 'u1' },
      { id: randomUUID(), slug: 'adel-ga', userId: 'u2' },
    ]);
    await ds.getRepository(PipelineRunSchema).insert({
      scopeSlug: 'adel-ga',
      localitySlug: 'adel-ga',
      cadence: 'daily',
      startedAt: '2026-10-04T06:00:00.000Z',
      completedAt: '2026-10-04T06:00:00.000Z',
      status: 'failed',
      ruleVersion: 'v',
      counts: '{}',
      coverageGaps: '[]',
      error: 'no sources',
      coverageRanges: '{}',
    } as never);
    const none = { ancestors: () => [], descendants: () => [] };
    const report = await pipelineReport(
      ds,
      [town('adel-ga', 'Adel'), town('tifton-ga', 'Tifton')],
      new Date(),
      none
    );
    expect(report.towns[0]).toMatchObject({ noSources: true, requestCount: 2 });
    expect(report.towns[1]?.noSources).toBeUndefined();
    expect(pipelineProblems(report)).toEqual([]);
    await ds.getRepository(SourcingDecisionSchema).clear();
    await ds.getRepository(SourceRequestSchema).clear();
  });

  it('names each problem with a key, so it is told once', () => {
    expect(
      pipelineProblems(troubled()).map((problem) => [problem.key, problem.kind])
    ).toEqual([
      ['run:adel-ga:model-timeout', 'run-failed'],
      ['source:tifton-agendas:failing', 'source-failing'],
    ]);
  });

  it('emails new problems once, resolves them when they clear, and alerts again if they return', async () => {
    const sent: { to: string | string[]; text?: string }[] = [];
    const email = {
      sendEmail: jest.fn(
        async (message: { to: string | string[]; text?: string }) => {
          sent.push(message);
          return { success: true };
        }
      ),
    };
    const alerts = new PipelineAlerts(ds, email, ['ops@example.com']);

    const first = await alerts.check(troubled());
    expect(first.opened).toHaveLength(2);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toEqual(['ops@example.com']);
    expect(sent[0]?.text).toContain('Adel: the daily run started');
    expect(sent[0]?.text).toContain('tifton-agendas (civicplus) is failing');

    // The same problems again: nothing new to say.
    const again = await alerts.check(troubled());
    expect(again.opened).toEqual([]);
    expect(sent).toHaveLength(1);

    // Everything clears.
    const clear: PipelineHealthReport = {
      ...troubled(),
      towns: troubled().towns.map((t) => ({
        ...t,
        lastRun: t.lastRun ? { ...t.lastRun, status: 'succeeded' } : null,
        problems: [],
      })),
    };
    expect((await alerts.check(clear)).resolved).toBe(2);

    // The source fails again: that is a new alert.
    const back = await alerts.check(troubled());
    expect(back.opened).toHaveLength(2);
    expect(sent).toHaveLength(2);
  });

  it('records problems without emailing when no address is set', async () => {
    const email = { sendEmail: jest.fn() };
    const alerts = new PipelineAlerts(ds, email, []);
    expect((await alerts.check(troubled())).opened).toHaveLength(2);
    expect(email.sendEmail).not.toHaveBeenCalled();
    const rows = await ds.getRepository(DaylightAlertSchema).find();
    expect(rows.map((row) => row.notifiedAt)).toEqual([null, null]);
  });

  it('alerts once while a town keeps failing for the same reason', async () => {
    const email = { sendEmail: jest.fn(async () => ({ success: true })) };
    const alerts = new PipelineAlerts(ds, email, ['ops@example.com']);
    const failedRun = (runId: number, error: string): PipelineHealthReport => ({
      ...troubled(),
      towns: [
        {
          ...troubled().towns[0],
          lastRun: { ...troubled().towns[0].lastRun!, runId, error },
        },
      ],
    });
    await alerts.check(
      failedRun(7, 'Ollama request unavailable: ECONNREFUSED')
    );
    await alerts.check(
      failedRun(8, 'Ollama request unavailable: ECONNREFUSED')
    );
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    // A different cause on the next run is news.
    await alerts.check(failedRun(9, 'run lease expired'));
    expect(email.sendEmail).toHaveBeenCalledTimes(2);
  });

  it('records quiet sources for the digest without emailing them', async () => {
    const email = { sendEmail: jest.fn(async () => ({ success: true })) };
    const alerts = new PipelineAlerts(ds, email, ['ops@example.com']);
    const quiet: PipelineHealthReport = {
      ...troubled(),
      towns: [
        {
          ...troubled().towns[1],
          problems: [
            {
              ...troubled().towns[1].problems[0],
              status: 'stale',
              stalenessDays: 5,
            },
          ],
        },
      ],
    };
    expect((await alerts.check(quiet)).opened).toHaveLength(1);
    expect(email.sendEmail).not.toHaveBeenCalled();
    const [row] = await ds.getRepository(DaylightAlertSchema).find();
    expect(row).toMatchObject({ kind: 'source-stale', notifiedAt: null });
  });

  it('sends the daily digest once a day, from the configured local time', async () => {
    const sent: { subject: string; html?: string }[] = [];
    const email = {
      sendEmail: jest.fn(
        async (message: { subject: string; html?: string }) => {
          sent.push(message);
          return { success: true };
        }
      ),
    };
    await ds.getRepository(PipelineRunSchema).insert({
      scopeSlug: 'adel-ga',
      localitySlug: 'adel-ga',
      cadence: 'daily',
      startedAt: '2026-11-28T10:00:00.000Z',
      completedAt: '2026-11-28T10:05:00.000Z',
      status: 'failed',
      ruleVersion: 'v',
      counts: '{}',
      coverageGaps: '[]',
      error: 'Ollama request unavailable: connect ECONNREFUSED',
      coverageRanges: '{}',
    } as never);
    const digest = new DigestSender(ds, email, {
      at: '07:00',
      timeZone: 'America/New_York',
      recipients: ['ops@example.com'],
    });
    const report = async () => troubled();
    // 06:45 Eastern: not yet.
    expect(
      await digest.maybeSend(report, new Date('2026-11-28T11:45:00.000Z'))
    ).toBe('not-due');
    expect(
      await digest.maybeSend(report, new Date('2026-11-28T12:00:00.000Z'))
    ).toBe('sent');
    expect(
      await digest.maybeSend(report, new Date('2026-11-28T12:15:00.000Z'))
    ).toBe('already-sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toContain('Daylight daily digest 2026-11-28');
    expect(sent[0]?.html).toContain('model service unreachable');
    // The digest row is resolved, so it is never mistaken for an open problem.
    const alerts = new PipelineAlerts(ds, null, []);
    expect((await alerts.check({ ...troubled(), towns: [] })).resolved).toBe(0);
  });

  it('counts a week of runs and model calls per local day', async () => {
    const run = (startedAt: string, status: string) => ({
      scopeSlug: 'adel-ga',
      localitySlug: 'adel-ga',
      cadence: 'daily',
      startedAt,
      completedAt: startedAt,
      status,
      ruleVersion: 'v',
      counts: '{}',
      coverageGaps: '[]',
      error: null,
      coverageRanges: '{}',
    });
    await ds.getRepository(PipelineRunSchema).insert([
      run('2026-11-28T10:00:00.000Z', 'succeeded'),
      run('2026-11-28T11:00:00.000Z', 'failed'),
      // 23:30 Eastern on the 26th, though the 27th in UTC.
      run('2026-11-27T04:30:00.000Z', 'partial_success'),
      // Before the window.
      run('2026-11-01T10:00:00.000Z', 'failed'),
    ] as never);
    const call = (attempt: number, status: string, error: string | null) => ({
      runId: 1,
      localitySlug: 'adel-ga',
      operation: 'story',
      model: 'qwen3.5:4b-q8_0',
      status,
      attempt,
      promptSha256: 'p',
      inputSha256: 'i',
      outputSha256: null,
      sourceKeys: '[]',
      output: null,
      error,
      generatedAt: '2026-11-28T10:01:00.000Z',
      latencyMs: 100,
    });
    await ds
      .getRepository(LlmGenerationSchema)
      .insert([
        call(1, 'successful', null),
        call(2, 'failed', 'Ollama request unavailable: connect ECONNREFUSED'),
        call(3, 'failed', 'Ollama request timeout after 300000ms'),
        call(4, 'failed', 'claim-grounding/unsupported-number: claim 1'),
        call(5, 'failed', null),
      ] as never);

    const trend = await loadTrend(
      ds,
      new Date('2026-11-28T12:00:00.000Z'),
      7,
      'America/New_York'
    );
    expect(trend.map((d) => d.day)).toEqual([
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    ]);
    expect(trend[4]).toMatchObject({ runsPartial: 1, runsFailed: 0 });
    expect(trend[6]).toEqual({
      day: '2026-11-28',
      runsSucceeded: 1,
      runsPartial: 0,
      runsFailed: 1,
      callsSuccessful: 1,
      callsUnavailable: 2,
      callsRejected: 2,
    });
    expect(trend[0]).toMatchObject({ runsFailed: 0, callsSuccessful: 0 });
  });

  it('reads the operator addresses from DAYLIGHT_ALERT_EMAIL', () => {
    expect(alertRecipients(' a@example.com, ,b@example.com ')).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
    expect(alertRecipients(undefined)).toEqual([]);
  });
});
