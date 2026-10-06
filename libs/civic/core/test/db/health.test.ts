import { createTestDataSource } from './helpers/postgres.js';
import { healthFromLedger } from '../../src/health.js';
import { DataSource } from 'typeorm';
import {
  RawDocumentSchema,
  FetchLedgerSchema,
  FetchAttemptSchema,
  PipelineRunSchema,
  PipelineStageRunSchema,
  EditionItemSchema,
  CivicItemSchema,
  LlmGenerationSchema,
} from '../../src/schema.js';
import { localityHealth } from '../../src/health.js';
import { persistEmptyFetch } from '../../src/fetch-ledger.js';

describe('ledger-backed freshness', () => {
  it('reports the latest run, failed stage, coverage gap, and projection counts', async () => {
    const ds = await createTestDataSource([
      RawDocumentSchema,
      PipelineRunSchema,
      PipelineStageRunSchema,
      EditionItemSchema,
      CivicItemSchema,
    ]);
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'county-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-12T12:00:00.000Z',
        completedAt: '2026-09-12T12:01:00.000Z',
        status: 'partial_success',
        currentStage: 'parse',
        ruleVersion: 'county-a.v1',
        counts: '{}',
        coverageGaps: JSON.stringify([
          { sourceKey: 'source-a', stage: 'parse', reason: 'timeout' },
        ]),
        error: null,
      });
      await ds.getRepository(PipelineStageRunSchema).save({
        runId: run.id as number,
        stage: 'parse',
        startedAt: '2026-09-12T12:00:00.000Z',
        completedAt: '2026-09-12T12:01:00.000Z',
        status: 'failed',
        counts: '{}',
        coverageGaps: '[]',
        error: 'timeout',
      });
      await ds.getRepository(EditionItemSchema).save({
        localitySlug: 'town-a',
        civicItemId: 1,
        decision: 'include',
        reason: 'direct',
        ruleVersion: 'county-a.v1',
        createdAt: '2026-09-12T12:00:00.000Z',
      });
      const health = await localityHealth(ds, {
        slug: 'town-a',
        name: 'Town A',
        state: 'GA',
        timezone: 'UTC',
        lat: 1,
        lon: 1,
        kind: 'town',
        parents: [],
        edition: true,
        topics: [],
        cadence: ['daily'],
        sources: [],
      });
      expect(health.lastRun?.status).toBe('partial_success');
      expect(health.failedStage).toBe('parse');
      expect(health.coverageGaps.length).toBe(1);
      expect(health.projectionCounts.include).toBe(1);
    } finally {
      await ds.destroy();
    }
  });

  it('uses latest project-stage counts for nonzero projection health', async () => {
    const ds = await createTestDataSource([
      RawDocumentSchema,
      PipelineRunSchema,
      PipelineStageRunSchema,
      EditionItemSchema,
      CivicItemSchema,
    ]);
    try {
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'county-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-12T12:00:00.000Z',
        completedAt: '2026-09-12T12:01:00.000Z',
        status: 'partial_success',
        currentStage: null,
        ruleVersion: 'county-a.v1',
        counts: '{}',
        coverageGaps: '[]',
        error: null,
      });
      await ds.getRepository(PipelineStageRunSchema).save({
        runId: run.id as number,
        stage: 'project',
        startedAt: '2026-09-12T12:00:00.000Z',
        completedAt: '2026-09-12T12:01:00.000Z',
        status: 'partial_success',
        counts: JSON.stringify({
          included: 4,
          withheld: 2,
          uncertain: 3,
          stories: 1,
        }),
        coverageGaps: JSON.stringify([
          { sourceKey: 'source-a', reason: 'uncertain geography' },
        ]),
        error: null,
      });
      const health = await localityHealth(ds, {
        slug: 'town-a',
        name: 'Town A',
        state: 'GA',
        timezone: 'UTC',
        lat: 1,
        lon: 1,
        kind: 'town',
        parents: [],
        edition: true,
        topics: [],
        cadence: ['daily'],
        sources: [],
      });
      expect(health.projectionCounts).toStrictEqual({
        include: 4,
        withhold: 2,
        uncertain: 3,
      });
    } finally {
      await ds.destroy();
    }
  });
  it('classifies never-fetched, fresh, stale, and failing sources', () => {
    const base = {
      sourceId: 'source-a',
      adapter: 'rss',
      enabled: true,
      cadence: 'daily' as const,
    };
    expect(
      healthFromLedger({ ...base, now: '2026-09-12T12:00:00.000Z' }).status
    ).toBe('never-fetched');
    expect(
      healthFromLedger({
        ...base,
        now: '2026-09-12T12:00:00.000Z',
        lastAttemptAt: '2026-09-12T11:00:00.000Z',
        lastSuccessAt: '2026-09-12T11:00:00.000Z',
      }).status
    ).toBe('fresh');
    expect(
      healthFromLedger({
        ...base,
        now: '2026-09-12T12:00:00.000Z',
        lastAttemptAt: '2026-09-01T11:00:00.000Z',
        lastSuccessAt: '2026-09-01T11:00:00.000Z',
      }).status
    ).toBe('stale');
    expect(
      healthFromLedger({
        ...base,
        now: '2026-09-12T12:00:00.000Z',
        lastAttemptAt: '2026-09-12T11:00:00.000Z',
        consecutiveFailures: 2,
      }).status
    ).toBe('failing');
  });

  it('uses the locality timezone when evaluating cadence boundaries', () => {
    const base = {
      sourceId: 'source-a',
      adapter: 'rss',
      enabled: true,
      cadence: 'daily' as const,
      timezone: 'America/New_York',
    };
    expect(
      healthFromLedger({
        ...base,
        now: '2026-09-13T03:30:00.000Z',
        lastAttemptAt: '2026-09-12T04:30:00.000Z',
        lastSuccessAt: '2026-09-12T04:30:00.000Z',
      }).stalenessDays
    ).toBe(0);
    expect(
      healthFromLedger({
        ...base,
        now: '2026-09-13T04:30:00.000Z',
        lastAttemptAt: '2026-09-12T04:30:00.000Z',
        lastSuccessAt: '2026-09-12T04:30:00.000Z',
      }).stalenessDays
    ).toBe(1);
  });

  it('does not treat an old raw row as a successful fetch', async () => {
    const ds = await createTestDataSource([RawDocumentSchema]);
    try {
      await ds.getRepository(RawDocumentSchema).save({
        sourceId: 'source-a',
        urlHash: 'old',
        url: 'https://example.test/old',
        contentType: 'text/plain',
        body: 'old',
        checksum: 'old',
        fetchedAt: '2026-09-01T00:00:00.000Z',
      });
      const health = await localityHealth(ds, {
        slug: 'town-a',
        name: 'Town A',
        state: 'GA',
        timezone: 'UTC',
        lat: 1,
        lon: 1,
        kind: 'town',
        parents: [],
        edition: true,
        topics: [],
        cadence: ['daily'],
        sources: [
          {
            sourceKey: 'source-a',
            ownerSlug: 'town-a',
            coverage: 'mentions',
            adapter: 'rss',
            name: 'Source',
            url: 'https://example.test/old',
            kind: 'news',
          },
        ],
      });
      expect(health.sources[0]?.status).toBe('never-fetched');
      expect(health.sources[0]?.lastSuccessAt).toBe(null);
    } finally {
      await ds.destroy();
    }
  });

  it('treats an empty successful source cycle as fetched for health', async () => {
    const ds = await createTestDataSource([
      RawDocumentSchema,
      FetchLedgerSchema,
      FetchAttemptSchema,
    ]);
    try {
      // Keep the successful cycle within the freshness window as the calendar advances.
      const fetchedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await persistEmptyFetch(
        ds,
        'source-a',
        'https://example.test/empty',
        fetchedAt
      );
      const health = await localityHealth(ds, {
        slug: 'town-a',
        name: 'Town A',
        state: 'GA',
        timezone: 'UTC',
        lat: 1,
        lon: 1,
        kind: 'town',
        parents: [],
        edition: true,
        topics: [],
        cadence: ['daily'],
        sources: [
          {
            sourceKey: 'source-a',
            ownerSlug: 'town-a',
            coverage: 'mentions',
            adapter: 'rss',
            name: 'Source',
            url: 'https://example.test/empty',
            kind: 'news',
          },
        ],
      });
      expect(health.sources[0]?.status).toBe('fresh');
    } finally {
      await ds.destroy();
    }
  });

  it('surfaces failed agenda fixup diagnostics without exposing generated content', async () => {
    const ds = await createTestDataSource([LlmGenerationSchema]);
    try {
      await ds.getRepository(LlmGenerationSchema).save({
        runId: 7,
        localitySlug: 'town-a',
        operation: 'agenda_fixup',
        model: 'qwen3:8b',
        status: 'failed',
        attempt: 2,
        promptSha256: 'a'.repeat(64),
        inputSha256: 'b'.repeat(64),
        outputSha256: null,
        sourceKeys: JSON.stringify(['town-agenda']),
        output: null,
        error: 'Invalid output included PRIVATE MEETING BODY SHOULD NOT LEAK',
        generatedAt: '2026-09-13T01:02:03.000Z',
        latencyMs: 12,
      });
      const health = await localityHealth(ds, {
        slug: 'town-a',
        name: 'Town A',
        state: 'GA',
        timezone: 'UTC',
        lat: 1,
        lon: 1,
        kind: 'town',
        parents: [],
        edition: true,
        topics: [],
        cadence: ['daily'],
        sources: [],
      });
      expect(health.agendaFixupFailures).toBe(1);
      expect(health.agendaFixupDiagnostics.length).toBe(1);
      expect(health.agendaFixupDiagnostics[0]?.sourceKeys).toStrictEqual([
        'town-agenda',
      ]);
      expect(health.agendaFixupDiagnostics[0]?.errorKind).toBe(
        'invalid-output'
      );
      expect(JSON.stringify(health.agendaFixupDiagnostics)).not.toMatch(
        /PRIVATE MEETING BODY/
      );
      expect(health.notes.join('\n')).toMatch(/agenda_fixup unavailable/);
    } finally {
      await ds.destroy();
    }
  });
});
