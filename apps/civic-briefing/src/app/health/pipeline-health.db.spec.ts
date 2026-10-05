import {
  type LocalityConfig,
  PipelineRunSchema,
} from '@optimistic-tanuki/civic-core';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import type { PipelineHealthReport } from '@optimistic-tanuki/models';
import { DataSource } from 'typeorm';
import { BRIEFING_SCHEMAS } from '../schemas';
import { DaylightAlertSchema } from './daylight-alert.schema';
import {
  alertRecipients,
  PipelineAlerts,
  pipelineProblems,
  pipelineReport,
} from './pipeline-health';

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

  it('names each problem with a key, so it is told once', () => {
    expect(
      pipelineProblems(troubled()).map((problem) => [problem.key, problem.kind])
    ).toEqual([
      ['run:7', 'run-failed'],
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

  it('reads the operator addresses from DAYLIGHT_ALERT_EMAIL', () => {
    expect(alertRecipients(' a@example.com, ,b@example.com ')).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
    expect(alertRecipients(undefined)).toEqual([]);
  });
});
