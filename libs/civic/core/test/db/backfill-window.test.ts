import { createTestDataSource } from './helpers/postgres.js';
import { backfillSince, dailyPeriod } from '../../src/calendar.js';
import { extractAgenda, gather, parseAll } from '../../src/pipeline.js';
import { registerAdapter } from '../../src/registry.js';
import { DataSource } from 'typeorm';
import {
  AgendaItemSchema,
  FetchAttemptSchema,
  FetchLedgerSchema,
  RawDocumentSchema,
  RawDocumentVersionSchema,
  CivicItemSchema,
  FOUNDATION_SCHEMAS,
} from '../../src/schema.js';
import type {
  DraftItem,
  FetchResult,
  LocalityConfig,
  SourceAdapter,
  SourceConfig,
} from '../../src/types.js';

const source: SourceConfig = {
  sourceKey: 'window-fixture',
  ownerSlug: 'adel-ga',
  coverage: 'mentions',
  adapter: 'window-fixture',
  name: 'Window fixture',
  url: 'https://example.test/window',
  kind: 'news',
  coverageCapabilities: {
    dateQuery: { parameter: 'from', format: 'YYYY-MM-DD' },
    pagination: { mode: 'page', maxPages: 2 },
  },
};

const locality: LocalityConfig = {
  slug: 'adel-ga',
  name: 'Adel',
  state: 'GA',
  timezone: 'America/New_York',
  lat: 0,
  lon: 0,
  topics: [],
  cadence: ['daily'],
  kind: 'town',
  parents: [],
  edition: true,
  sources: [source],
};

test('derives DST-safe daily and 30-day local-calendar windows', () => {
  const period = dailyPeriod(
    new Date('2026-03-10T03:30:00.000Z'),
    'America/New_York'
  );
  expect(period).toStrictEqual({ start: '2026-03-08', end: '2026-03-09' });
  expect(backfillSince(period.end, 30)).toBe('2026-02-07');
});

test('gather passes one context range per source and records observed coverage', async () => {
  let calls = 0;
  const adapter: SourceAdapter = {
    name: source.adapter,
    async fetch(received, context): Promise<FetchResult[]> {
      calls += 1;
      expect(context.coverageRange).toStrictEqual({
        requestedStart: '2026-08-10',
        requestedEnd: '2026-09-09',
      });
      expect(received.sourceKey).toBe(source.sourceKey);
      return [
        {
          kind: 'fetched',
          status: 200,
          url: received.url,
          requestUrl: received.url,
          contentType: 'application/json',
          fetchedAt: '2026-09-09T12:00:00.000Z',
          payload: {
            kind: 'text',
            body: JSON.stringify({
              observedDate: '2026-08-10',
              title: 'Observed item',
            }),
          },
        },
      ];
    },
    async parse(): Promise<DraftItem[]> {
      return [];
    },
  };
  registerAdapter(adapter);
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  try {
    const result = await gather(ds, locality, {
      coverageRange: {
        requestedStart: '2026-08-10',
        requestedEnd: '2026-09-09',
      },
    });
    expect(calls).toBe(1);
    expect(result.sourceOutcomes[0]?.outcome).toBe('records');
    expect(result.sourceOutcomes[0]?.coverageRange).toStrictEqual({
      requestedStart: '2026-08-10',
      requestedEnd: '2026-09-09',
      observedStart: '2026-08-10',
      observedEnd: '2026-08-11',
      missingDays: Array.from({ length: 29 }, (_, i) =>
        new Date(Date.UTC(2026, 7, 11 + i)).toISOString().slice(0, 10)
      ),
      reason: 'partial-range',
    });
    expect(
      result.coverageRanges[source.sourceKey]?.requestedStart
    ).toStrictEqual('2026-08-10');
    const ledger = await ds
      .getRepository(FetchLedgerSchema)
      .findOneBy({ sourceId: source.sourceKey });
    expect(ledger?.observedStart).toBe('2026-08-10');
    expect(ledger?.coverageRange).toBeTruthy();
  } finally {
    await ds.destroy();
  }
});

test('parseAll credits only raw documents returned by the current gather', async () => {
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  let calls = 0;
  registerAdapter({
    name: 'current-only-fixture',
    async fetch(received): Promise<FetchResult[]> {
      calls += 1;
      return [
        {
          kind: 'fetched',
          status: 200,
          url: `${received.url}/${calls}`,
          requestUrl: received.url,
          contentType: 'application/json',
          fetchedAt: `2026-09-0${calls}T12:00:00.000Z`,
          payload: {
            kind: 'text',
            body: JSON.stringify({
              observedDate: `2026-09-0${calls}`,
              title: `current-${calls}`,
            }),
          },
        },
      ];
    },
    async parse(raw): Promise<DraftItem[]> {
      const payload = JSON.parse(
        raw.payload.kind === 'text' ? raw.payload.body : '{}'
      ) as { title: string };
      return [
        {
          kind: 'news',
          title: payload.title,
          body: 'Current gathered evidence.',
          publishedAt: raw.fetchedAt,
          topics: ['general'],
        },
      ];
    },
  });
  try {
    const oldVersion = await ds.getRepository(RawDocumentVersionSchema).save({
      sourceId: source.sourceKey,
      url: 'https://example.test/window/old',
      checksum: 'old',
      payloadKind: 'text',
      body: JSON.stringify({
        observedDate: '2026-08-01',
        title: 'historical',
      }),
      contentType: 'application/json',
      fetchedAt: '2026-08-01T12:00:00.000Z',
    });
    await ds.getRepository(RawDocumentSchema).save({
      sourceId: source.sourceKey,
      urlHash: 'old',
      url: 'https://example.test/window/old',
      contentType: 'application/json',
      fetchedAt: '2026-08-01T12:00:00.000Z',
      activeVersionId: oldVersion.id,
    });
    const gathered = await gather(
      ds,
      {
        ...locality,
        sources: [{ ...source, adapter: 'current-only-fixture' }],
      },
      {
        coverageRange: {
          requestedStart: '2026-09-01',
          requestedEnd: '2026-09-10',
        },
      }
    );
    const parsed = await parseAll(
      ds,
      {
        ...locality,
        sources: [{ ...source, adapter: 'current-only-fixture' }],
      },
      {
        currentRawDocumentIds: gathered.currentRawDocumentIds,
        successfulSourceOutcomes: gathered.sourceOutcomes,
      }
    );
    expect(parsed.inserted).toBe(1);
    expect(await ds.getRepository(CivicItemSchema).count()).toBe(1);
    expect(
      (await ds.getRepository(CivicItemSchema).findOneByOrFail({})).title
    ).toBe('current-1');
  } finally {
    await ds.destroy();
  }
});

test('coverage persistence is scoped to the current fetch attempt', async () => {
  let calls = 0;
  registerAdapter({
    name: 'coverage-rerun-fixture',
    async fetch(received): Promise<FetchResult[]> {
      calls += 1;
      const day = calls === 1 ? '2026-08-10' : '2026-09-08';
      return [
        {
          kind: 'fetched',
          status: 200,
          url: received.url,
          requestUrl: received.url,
          contentType: 'application/json',
          fetchedAt: `2026-09-1${calls}T12:00:00.000Z`,
          payload: {
            kind: 'text',
            body: JSON.stringify({ observedDate: day, title: `run-${calls}` }),
          },
        },
      ];
    },
    async parse(): Promise<DraftItem[]> {
      return [];
    },
  });
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  try {
    const configured = {
      ...locality,
      sources: [{ ...source, adapter: 'coverage-rerun-fixture' }],
    };
    await gather(ds, configured, {
      coverageRange: {
        requestedStart: '2026-08-10',
        requestedEnd: '2026-08-20',
      },
    });
    await gather(ds, configured, {
      coverageRange: {
        requestedStart: '2026-09-01',
        requestedEnd: '2026-09-10',
      },
    });
    const attempts = await ds
      .getRepository(FetchAttemptSchema)
      .find({ order: { id: 'ASC' } });
    expect(attempts.length).toBe(2);
    expect(JSON.parse(attempts[0]!.coverageRange ?? '{}').requestedStart).toBe(
      '2026-08-10'
    );
    expect(JSON.parse(attempts[1]!.coverageRange ?? '{}').requestedStart).toBe(
      '2026-09-01'
    );
    const ledger = await ds
      .getRepository(FetchLedgerSchema)
      .findOneBy({ sourceId: source.sourceKey });
    expect(JSON.parse(ledger?.coverageRange ?? '{}').requestedStart).toBe(
      '2026-09-01'
    );
  } finally {
    await ds.destroy();
  }
});

test('agenda fallback uses the locality date across DST boundaries', async () => {
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  try {
    await ds.getRepository(CivicItemSchema).save({
      sourceId: source.sourceKey,
      localitySlug: locality.slug,
      scopeSlug: locality.slug,
      scopeKind: 'town',
      kind: 'meeting',
      title: 'Council packet without a title date',
      body: '1. Bridge project approved after public discussion and a recorded vote.',
      eventDate: '2026-03-09T00:30:00.000Z',
      topics: JSON.stringify(['bridge']),
      uris: JSON.stringify(['https://example.test/agenda']),
      hash: 'dst-agenda',
      createdAt: '2026-03-09T01:00:00.000Z',
    });
    await extractAgenda(
      ds,
      locality.slug,
      undefined,
      { start: '2026-03-08', end: '2026-03-09' },
      locality.timezone
    );
    const agenda = await ds
      .getRepository(AgendaItemSchema)
      .findOneByOrFail({ localitySlug: locality.slug });
    expect(agenda.meetingDate).toBe('2026-03-08');
  } finally {
    await ds.destroy();
  }
});

test('agenda extraction keeps distinct repeated ordinals in one section idempotently', async () => {
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  try {
    // Production migrations enforce this identity even though a fixture data
    // source may otherwise omit migration-created indexes.
    await ds.query(
      'CREATE UNIQUE INDEX IDX_agenda_items_identity ON agenda_items ("itemId", section, ordinal)'
    );
    const body = [
      'REGULAR AGENDA: 1. Approve the bridge construction schedule after public review and a recorded vote.',
      '1. Amend the bridge construction schedule after public review and a recorded vote.',
      '2. Authorize the drainage study after public review and a recorded vote.',
    ].join(' ');
    const item = await ds.getRepository(CivicItemSchema).save({
      sourceId: source.sourceKey,
      localitySlug: locality.slug,
      scopeSlug: locality.slug,
      scopeKind: 'town',
      kind: 'meeting',
      title: 'Council packet 09/12/2026',
      body,
      eventDate: '2026-09-12',
      topics: JSON.stringify(['bridge']),
      uris: JSON.stringify(['https://example.test/agenda']),
      hash: 'repeated-ordinal',
      createdAt: '2026-09-12T01:00:00.000Z',
    });
    const first = await extractAgenda(
      ds,
      locality.slug,
      undefined,
      { start: '2026-09-12', end: '2026-09-13' },
      locality.timezone
    );
    expect(first.items >= 3).toBeTruthy();
    const rows = await ds
      .getRepository(AgendaItemSchema)
      .find({ where: { itemId: item.id } as any, order: { id: 'ASC' } });
    expect(
      new Set(rows.map((row) => `${row.section}\u0000${row.ordinal}`)).size
    ).toBe(rows.length);
    expect(
      rows.filter((row) => row.section === 'REGULAR AGENDA').length >= 2
    ).toBeTruthy();
    const second = await extractAgenda(
      ds,
      locality.slug,
      undefined,
      { start: '2026-09-12', end: '2026-09-13' },
      locality.timezone
    );
    expect(second.items).toBe(0);
    expect(
      await ds
        .getRepository(AgendaItemSchema)
        .count({ where: { itemId: item.id } as any })
    ).toBe(rows.length);
  } finally {
    await ds.destroy();
  }
});

test('agenda extraction rolls back all rows when a later row insert fails', async () => {
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  try {
    await ds.query(
      'CREATE UNIQUE INDEX IDX_agenda_items_identity ON agenda_items ("itemId", section, ordinal)'
    );
    await ds.query(
      "CREATE FUNCTION agenda_test_fail_second() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected agenda insert failure'; END; $$"
    );
    await ds.query(
      'CREATE TRIGGER agenda_test_fail_second BEFORE INSERT ON agenda_items FOR EACH ROW WHEN (NEW.ordinal = 2) EXECUTE FUNCTION agenda_test_fail_second()'
    );
    const item = await ds.getRepository(CivicItemSchema).save({
      sourceId: source.sourceKey,
      localitySlug: locality.slug,
      scopeSlug: locality.slug,
      scopeKind: 'town',
      kind: 'meeting',
      title: 'Council packet 09/12/2026',
      body: 'REGULAR AGENDA: 1. Approve the bridge construction schedule after public review and a recorded vote. 2. Authorize the drainage study after public review and a recorded vote.',
      eventDate: '2026-09-12',
      topics: JSON.stringify(['bridge']),
      uris: JSON.stringify(['https://example.test/agenda']),
      hash: 'atomic-agenda',
      createdAt: '2026-09-12T01:00:00.000Z',
    });
    await expect(
      (() =>
        extractAgenda(
          ds,
          locality.slug,
          undefined,
          { start: '2026-09-12', end: '2026-09-13' },
          locality.timezone
        ))()
    ).rejects.toThrow(/injected agenda insert failure/);
    expect(
      await ds
        .getRepository(AgendaItemSchema)
        .count({ where: { itemId: item.id } as any })
    ).toBe(0);
  } finally {
    await ds.destroy();
  }
});

test('agenda extraction reconciles partial legacy rows without touching another item', async () => {
  const ds = await createTestDataSource(FOUNDATION_SCHEMAS);
  try {
    await ds.query(
      'CREATE UNIQUE INDEX IDX_agenda_items_identity ON agenda_items ("itemId", section, ordinal)'
    );
    const item = await ds.getRepository(CivicItemSchema).save({
      sourceId: source.sourceKey,
      localitySlug: locality.slug,
      scopeSlug: locality.slug,
      scopeKind: 'town',
      kind: 'meeting',
      title: 'Council packet 09/12/2026',
      body: 'REGULAR AGENDA: 1. Approve the bridge construction schedule after public review and a recorded vote. 2. Authorize the drainage study after public review and a recorded vote.',
      eventDate: '2026-09-12',
      topics: JSON.stringify(['bridge']),
      uris: JSON.stringify(['https://example.test/agenda']),
      hash: 'partial-agenda',
      createdAt: '2026-09-12T01:00:00.000Z',
    });
    const unrelated = await ds.getRepository(CivicItemSchema).save({
      sourceId: source.sourceKey,
      localitySlug: locality.slug,
      scopeSlug: locality.slug,
      scopeKind: 'town',
      kind: 'meeting',
      title: 'Other packet 09/12/2026',
      body: 'GENERAL: 1. Approve the unrelated public works matter after public review and a recorded vote.',
      eventDate: '2026-09-12',
      topics: JSON.stringify(['other']),
      uris: JSON.stringify(['https://example.test/other']),
      hash: 'unrelated-agenda',
      createdAt: '2026-09-12T01:00:00.000Z',
    });
    await ds.getRepository(AgendaItemSchema).save({
      itemId: item.id as number,
      localitySlug: locality.slug,
      meetingDate: '2026-09-12',
      section: 'REGULAR AGENDA',
      ordinal: 1,
      heading: 'stale partial row',
      body: 'The prior failed implementation persisted only this first row.',
      topicKey: 'topic:stale',
      procedural: false,
      createdAt: '2026-09-12T01:00:00.000Z',
    });
    const unrelatedResult = await extractAgenda(
      ds,
      locality.slug,
      undefined,
      { start: '2026-09-12', end: '2026-09-13' },
      locality.timezone
    );
    const rows = await ds
      .getRepository(AgendaItemSchema)
      .find({ where: { itemId: item.id } as any, order: { ordinal: 'ASC' } });
    expect(
      rows.map((row) => [row.section, row.ordinal, row.heading])
    ).toStrictEqual([
      [
        'REGULAR AGENDA',
        1,
        '1. Approve the bridge construction schedule after public review and a recorded vote.',
      ],
      [
        'REGULAR AGENDA',
        2,
        '2. Authorize the drainage study after public review and a recorded vote.',
      ],
    ]);
    expect(unrelatedResult.items >= 1).toBeTruthy();
    const unrelatedRows = await ds
      .getRepository(AgendaItemSchema)
      .find({ where: { itemId: unrelated.id } as any });
    expect(unrelatedRows.length).toBe(1);
    const beforeRepeat = rows.map((row) => ({ ...row }));
    await extractAgenda(
      ds,
      locality.slug,
      undefined,
      { start: '2026-09-12', end: '2026-09-13' },
      locality.timezone
    );
    expect(
      await ds
        .getRepository(AgendaItemSchema)
        .find({ where: { itemId: item.id } as any, order: { id: 'ASC' } })
    ).toStrictEqual(beforeRepeat);
  } finally {
    await ds.destroy();
  }
});
