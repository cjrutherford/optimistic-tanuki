import { createTestDataSource, createTestSchema } from './helpers/postgres.js';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  ALL_SCHEMAS,
  CanonicalStorySchema,
  EditionItemSchema,
  FoundationSourceSchema,
  FetchAttemptSchema,
  FetchLedgerSchema,
  RawDocumentSchema,
  RawDocumentVersionSchema,
} from '../../src/schema.js';
import {
  acquireLedgerKeyLock,
  findLedgerForUpdate,
  nextFetchState,
  persistFetchResult,
  readFetchLedger,
  type FetchLedgerState,
} from '../../src/fetch-ledger.js';
import { parseAll } from '../../src/pipeline.js';
import { projectItems } from '../../src/edition.js';
import { registerAdapter } from '../../src/registry.js';
import {
  createLocalityRegistry,
  loadLocalityRegistry,
} from '../../src/locality-registry.js';
import type { LocalityConfig } from '../../src/types.js';
import type { FetchResult } from '../../src/types.js';

const source = {
  id: 'source-a',
  sourceKey: 'source-a',
  ownerSlug: 'town-a',
  coverage: 'mentions',
  adapter: 'fake',
  name: 'Fake',
  url: 'https://example.test',
  kind: 'news',
  enabled: true,
};

function fetched(body: string): FetchResult {
  return {
    kind: 'fetched',
    status: 200,
    url: 'https://example.test/story',
    requestUrl: 'https://example.test/feed',
    contentType: 'text/plain',
    fetchedAt: '2026-09-12T12:00:00.000Z',
    payload: { kind: 'text', body },
  };
}

describe('fetch ledger and immutable document versions', () => {
  it('persists canonical county scope and durable identity fields from a county-owned draft', async () => {
    registerAdapter({
      name: 'scope-fixture',
      async fetch() {
        return [];
      },
      async parse() {
        return [
          {
            kind: 'news',
            title: 'County road case',
            body: 'County road update',
            uris: ['https://example.test/case'],
            externalId: 'CASE-42',
            entity: 'Road',
            action: 'Repair',
            jurisdictionSlug: 'cook-county-ga',
          },
        ];
      },
    });
    const ds = await createTestDataSource([
      ...ALL_SCHEMAS,
      FoundationSourceSchema,
      FetchLedgerSchema,
      FetchAttemptSchema,
      RawDocumentVersionSchema,
    ]);
    try {
      const registry = loadLocalityRegistry(
        join(__dirname, '..', 'fixtures', 'localities-snapshot')
      );
      const locality: LocalityConfig = {
        slug: 'adel-ga',
        name: 'Adel',
        state: 'GA',
        timezone: 'America/New_York',
        lat: 31,
        lon: -83,
        topics: [],
        cadence: ['daily'],
        kind: 'town',
        parents: ['cook-county-ga'],
        edition: true,
        sources: [
          {
            sourceKey: 'cook-news-discover',
            ownerSlug: 'cook-county-ga',
            coverage: 'mentions',
            adapter: 'scope-fixture',
            name: 'Scope',
            url: 'https://example.test/feed',
            kind: 'news',
          },
        ],
      };
      await ds.getRepository(FoundationSourceSchema).save({
        id: 'cook-news-discover',
        sourceKey: 'cook-news-discover',
        ownerSlug: 'cook-county-ga',
        coverage: 'mentions',
        adapter: 'scope-fixture',
        name: 'Scope',
        url: 'https://example.test/feed',
        kind: 'news',
        enabled: true,
        config: null,
      });
      const version = await ds.getRepository(RawDocumentVersionSchema).save({
        sourceId: 'cook-news-discover',
        url: 'https://example.test/case',
        checksum: 'scope',
        payloadKind: 'text',
        body: 'fixture',
        contentType: 'text/plain',
        fetchedAt: '2026-09-12T00:00:00.000Z',
      });
      await ds.getRepository(RawDocumentSchema).save({
        sourceId: 'cook-news-discover',
        urlHash: 'scope',
        url: 'https://example.test/case',
        contentType: 'text/plain',
        body: null,
        checksum: 'scope',
        fetchedAt: '2026-09-12T00:00:00.000Z',
        activeVersionId: version.id,
      });
      const parsed = await parseAll(ds, locality, { registry });
      expect(parsed.inserted).toBe(1);
      const row = (
        await ds.query(
          'SELECT "scopeSlug","scopeKind","jurisdictionSlug","externalId",entity,action FROM civic_items'
        )
      )[0] as Record<string, string>;
      expect(row).toStrictEqual({
        scopeSlug: 'cook-county-ga',
        scopeKind: 'county',
        jurisdictionSlug: 'cook-county-ga',
        externalId: 'CASE-42',
        entity: 'Road',
        action: 'Repair',
      });
      await projectItems(ds, 'adel-ga', registry);
      const sharedCountySibling = createLocalityRegistry([
        ...registry.all(),
        {
          ...registry.get('adel-ga'),
          slug: 'cook-sibling-ga',
          name: 'Cook Sibling',
          parents: ['cook-county-ga'],
          sources: [],
        },
      ]);
      await projectItems(ds, 'cook-sibling-ga', sharedCountySibling);
      const story = await ds.getRepository(CanonicalStorySchema).findOneBy({});
      expect(await ds.getRepository(CanonicalStorySchema).count()).toBe(1);
      expect(story?.scopeSlug).toBe('cook-county-ga');
      expect(await ds.getRepository(EditionItemSchema).count()).toBe(2);
    } finally {
      await ds.destroy();
    }
  });
  it('computes changed, unchanged, not-modified, and failed state transitions', () => {
    const first = nextFetchState(undefined, fetched('one'));
    expect(first.outcome).toBe('changed');
    const unchanged = nextFetchState(first.ledger, fetched('one'));
    expect(unchanged.outcome).toBe('unchanged');
    const notModified = nextFetchState(unchanged.ledger, {
      ...fetched('one'),
      kind: 'not_modified',
      status: 304,
      payload: undefined,
    } as FetchResult);
    expect(notModified.outcome).toBe('not-modified');
    const failed = nextFetchState(notModified.ledger, {
      kind: 'failed',
      status: null,
      url: 'https://example.test/story',
      requestUrl: 'https://example.test/feed',
      contentType: 'text/plain',
      fetchedAt: '2026-09-12T12:00:00.000Z',
      error: { kind: 'timeout', message: 'timed out', retryable: true },
    });
    expect(failed.outcome).toBe('failed');
    expect(failed.ledger.consecutiveFailures).toBe(1);
  });

  it('persists immutable versions and leaves the active pointer on 304/failure', async () => {
    const ds = await createTestDataSource([
      ...ALL_SCHEMAS,
      FoundationSourceSchema,
      FetchLedgerSchema,
      FetchAttemptSchema,
      RawDocumentVersionSchema,
    ]);
    try {
      await ds.getRepository(FoundationSourceSchema).save(source);
      await persistFetchResult(ds, source.id, fetched('one'));
      await persistFetchResult(ds, source.id, fetched('one'));
      const v1 = await ds.getRepository(RawDocumentVersionSchema).find();
      expect(v1.length).toBe(1);
      expect((await ds.getRepository(RawDocumentSchema).find())[0]?.body).toBe(
        null
      );
      await persistFetchResult(ds, source.id, {
        ...fetched('two'),
        fetchedAt: '2026-09-12T13:00:00.000Z',
      });
      const versions = await ds
        .getRepository(RawDocumentVersionSchema)
        .find({ order: { id: 'ASC' } });
      expect(versions.length).toBe(2);
      expect(versions[0]?.body).toBe('one');
      expect(versions[1]?.body).toBe('two');
      const before = await ds
        .getRepository(RawDocumentSchema)
        .findOneBy({ sourceId: source.id, url: fetched('two').url });
      expect(before?.body).toBe(null);
      await persistFetchResult(ds, source.id, {
        kind: 'not_modified',
        status: 304,
        url: 'https://example.test/story',
        requestUrl: 'https://example.test/feed',
        contentType: 'text/plain',
        fetchedAt: '2026-09-12T14:00:00.000Z',
      });
      await persistFetchResult(ds, source.id, {
        kind: 'failed',
        status: null,
        url: 'https://example.test/story',
        requestUrl: 'https://example.test/feed',
        contentType: 'text/plain',
        fetchedAt: '2026-09-12T15:00:00.000Z',
        error: { kind: 'timeout', message: 'timed out', retryable: true },
      });
      const after = await ds
        .getRepository(RawDocumentSchema)
        .findOneBy({ sourceId: source.id, url: fetched('two').url });
      expect(after?.activeVersionId).toBe(before?.activeVersionId);
      expect(await ds.getRepository(FetchAttemptSchema).count()).toBe(5);
      expect(
        (
          await ds
            .getRepository(FetchLedgerSchema)
            .findOneBy({ sourceId: source.id, url: fetched('two').url })
        )?.consecutiveFailures
      ).toBe(1);
      await persistFetchResult(ds, source.id, {
        ...fetched('two'),
        fetchedAt: '2026-09-12T16:00:00.000Z',
        etag: 'etag-2',
        lastModified: 'yesterday',
      });
      expect(
        await readFetchLedger(ds, source.id, fetched('two').url)
      ).toStrictEqual({ etag: 'etag-2', lastModified: 'yesterday' });
    } finally {
      await ds.destroy();
    }
  });

  it('canonicalizes URL variants and remains idempotent under concurrent persistence', async () => {
    const ds = await createTestDataSource([
      ...ALL_SCHEMAS,
      FoundationSourceSchema,
      FetchLedgerSchema,
      FetchAttemptSchema,
      RawDocumentVersionSchema,
    ]);
    try {
      const canonicalSource = { ...source, url: 'https://example.test/story/' };
      await ds.getRepository(FoundationSourceSchema).save(canonicalSource);
      const first = fetched('one');
      const variant = { ...first, url: 'https://EXAMPLE.TEST/story/' };
      await Promise.all([
        persistFetchResult(ds, source.id, first),
        persistFetchResult(ds, source.id, variant),
      ]);
      expect(await ds.getRepository(RawDocumentSchema).count()).toBe(1);
      expect(await ds.getRepository(RawDocumentVersionSchema).count()).toBe(1);
      expect(await ds.getRepository(FetchLedgerSchema).count()).toBe(1);
      expect(await ds.getRepository(FetchAttemptSchema).count()).toBe(2);
      expect((await ds.getRepository(RawDocumentSchema).find())[0]?.url).toBe(
        'https://example.test/story'
      );
    } finally {
      await ds.destroy();
    }
  });

  it('rolls back attempt, ledger, version, and pointer together on a transaction failure', async () => {
    const ds = await createTestDataSource([
      ...ALL_SCHEMAS,
      FoundationSourceSchema,
      FetchLedgerSchema,
      FetchAttemptSchema,
      RawDocumentVersionSchema,
    ]);
    try {
      await ds.getRepository(FoundationSourceSchema).save(source);
      await ds.query(
        "CREATE FUNCTION fail_fetch_attempts() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ledger transaction failure'; END; $$"
      );
      await ds.query(
        'CREATE TRIGGER fail_fetch_attempts BEFORE INSERT ON fetch_attempts FOR EACH ROW EXECUTE FUNCTION fail_fetch_attempts()'
      );
      await expect(
        (() => persistFetchResult(ds, source.id, fetched('rollback')))()
      ).rejects.toThrow(/ledger transaction failure|transaction/i);
      expect(await ds.getRepository(FetchAttemptSchema).count()).toBe(0);
      expect(await ds.getRepository(FetchLedgerSchema).count()).toBe(0);
      expect(await ds.getRepository(RawDocumentVersionSchema).count()).toBe(0);
      expect(await ds.getRepository(RawDocumentSchema).count()).toBe(0);
    } finally {
      await ds.destroy();
    }
  });

  it('does not let an older failure regress a newer success across two database connections', async () => {
    const { url } = await createTestSchema();
    const options = {
      type: 'postgres' as const,
      url,
      entities: [
        ...ALL_SCHEMAS,
        FoundationSourceSchema,
        FetchLedgerSchema,
        FetchAttemptSchema,
        RawDocumentVersionSchema,
      ],
      synchronize: true,
    };
    const first = new DataSource(options);
    await first.initialize();
    const second = new DataSource({ ...options, synchronize: false });
    await second.initialize();
    try {
      await first.getRepository(FoundationSourceSchema).save(source);
      await persistFetchResult(first, source.id, {
        ...fetched('new'),
        fetchedAt: '2026-09-12T12:00:00.000Z',
        etag: 'new-etag',
      });
      const staleOutcome = await persistFetchResult(second, source.id, {
        kind: 'failed',
        status: null,
        url: 'https://example.test/story',
        requestUrl: 'https://example.test/feed',
        contentType: 'text/plain',
        fetchedAt: '2026-09-12T11:00:00.000Z',
        error: { kind: 'timeout', message: 'late failure', retryable: true },
      });
      expect(staleOutcome).toBe('ignored-stale');
      const ledger = await first
        .getRepository(FetchLedgerSchema)
        .findOneBy({ sourceId: source.id, url: 'https://example.test/story' });
      expect(ledger?.lastSuccessAt).toBe('2026-09-12T12:00:00.000Z');
      expect(ledger?.lastAttemptAt).toBe('2026-09-12T12:00:00.000Z');
      expect(ledger?.etag).toBe('new-etag');
      expect(ledger?.consecutiveFailures).toBe(0);
      const staleFetchedOutcome = await persistFetchResult(first, source.id, {
        ...fetched('old body'),
        fetchedAt: '2026-09-12T11:00:00.000Z',
      });
      expect(staleFetchedOutcome).toBe('ignored-stale');
      const currentOutcome = await persistFetchResult(second, source.id, {
        ...fetched('new'),
        fetchedAt: '2026-09-12T13:00:00.000Z',
      });
      expect(currentOutcome).toBe('unchanged');
      const afterStaleFetch = await first
        .getRepository(FetchLedgerSchema)
        .findOneBy({ sourceId: source.id, url: 'https://example.test/story' });
      expect(afterStaleFetch?.lastChecksum).toBe(
        createHash('sha256').update('new').digest('hex')
      );
    } finally {
      await first.destroy();
      await second.destroy();
    }
  });

  it('acquires a PostgreSQL advisory key lock before looking up the ledger row', async () => {
    const calls: string[] = [];
    const fakeRepository = {
      findOne: async () => {
        calls.push('lookup');
        return null;
      },
    };
    const manager = {
      connection: { options: { type: 'postgres' } },
      query: async (sql: string) => {
        calls.push(sql);
      },
      getRepository: () => fakeRepository,
    } as never;
    await findLedgerForUpdate(
      manager,
      'source-a',
      'https://example.test/story'
    );
    expect(calls.length).toBe(2);
    expect(calls[0]!).toMatch(/pg_advisory_xact_lock/);
    expect(calls[1]).toBe('lookup');
    await acquireLedgerKeyLock(
      manager,
      'source-a',
      'https://example.test/story'
    );
    expect(calls.length).toBe(3);
  });

  it('serializes absent-row creation across two connections behind a barrier', async () => {
    const { url } = await createTestSchema();
    const options = {
      type: 'postgres' as const,
      url,
      entities: [
        ...ALL_SCHEMAS,
        FoundationSourceSchema,
        FetchLedgerSchema,
        FetchAttemptSchema,
        RawDocumentVersionSchema,
      ],
      synchronize: true,
    };
    const first = new DataSource(options);
    await first.initialize();
    const second = new DataSource({ ...options, synchronize: false });
    await second.initialize();
    try {
      await first.getRepository(FoundationSourceSchema).save(source);
      let ready = 0;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const start = async (ds: DataSource) => {
        ready += 1;
        if (ready === 2) release();
        await gate;
        return persistFetchResult(ds, source.id, fetched('same body'));
      };
      const outcomes = await Promise.all([start(first), start(second)]);
      expect([...outcomes].sort()).toStrictEqual(['changed', 'unchanged']);
      expect(await first.getRepository(FetchLedgerSchema).count()).toBe(1);
      expect(await first.getRepository(RawDocumentVersionSchema).count()).toBe(
        1
      );
      expect(await first.getRepository(RawDocumentSchema).count()).toBe(1);
      expect(await first.getRepository(FetchAttemptSchema).count()).toBe(2);
    } finally {
      await first.destroy();
      await second.destroy();
    }
  });

  it('keeps the newer body and ledger state when older and newer writes overlap', async () => {
    const { url } = await createTestSchema();
    const options = {
      type: 'postgres' as const,
      url,
      entities: [
        ...ALL_SCHEMAS,
        FoundationSourceSchema,
        FetchLedgerSchema,
        FetchAttemptSchema,
        RawDocumentVersionSchema,
      ],
      synchronize: true,
    };
    const first = new DataSource(options);
    await first.initialize();
    const second = new DataSource({ ...options, synchronize: false });
    await second.initialize();
    try {
      await first.getRepository(FoundationSourceSchema).save(source);
      let ready = 0;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const start = async (ds: DataSource, result: FetchResult) => {
        ready += 1;
        if (ready === 2) release();
        await gate;
        return persistFetchResult(ds, source.id, result);
      };
      await Promise.all([
        start(first, {
          ...fetched('older body'),
          fetchedAt: '2026-09-12T11:00:00.000Z',
        }),
        start(second, {
          ...fetched('newer body'),
          fetchedAt: '2026-09-12T12:00:00.000Z',
        }),
      ]);
      const ledger = await first
        .getRepository(FetchLedgerSchema)
        .findOneBy({ sourceId: source.id, url: 'https://example.test/story' });
      const raw = await first
        .getRepository(RawDocumentSchema)
        .findOneBy({ sourceId: source.id, url: 'https://example.test/story' });
      const versions = await first
        .getRepository(RawDocumentVersionSchema)
        .find({ order: { id: 'ASC' } });
      expect(ledger?.lastSuccessAt).toBe('2026-09-12T12:00:00.000Z');
      expect(ledger?.lastAttemptAt).toBe('2026-09-12T12:00:00.000Z');
      expect(versions.length).toBe(2);
      expect(versions.some((version) => version.body === 'newer body')).toBe(
        true
      );
      expect(raw?.body).toBe(null);
      expect(raw?.activeVersionId).toBe(
        versions.find((version) => version.body === 'newer body')?.id
      );
    } finally {
      await first.destroy();
      await second.destroy();
    }
  });

  it('does not parse a globally disabled source even when an old raw version exists', async () => {
    let parseCalls = 0;
    registerAdapter({
      name: 'disabled-test',
      async fetch() {
        return [];
      },
      async parse() {
        parseCalls += 1;
        return [{ title: 'must not appear', body: 'x', kind: 'news' }];
      },
    });
    const ds = await createTestDataSource([
      ...ALL_SCHEMAS,
      FoundationSourceSchema,
      FetchLedgerSchema,
      FetchAttemptSchema,
      RawDocumentVersionSchema,
    ]);
    try {
      const disabled = {
        sourceKey: 'disabled-source',
        ownerSlug: 'town-a',
        coverage: 'mentions' as const,
        adapter: 'disabled-test',
        name: 'Disabled',
        url: 'https://example.test/disabled',
        kind: 'news' as const,
        enabled: false,
      };
      const locality = {
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
        cadence: ['daily' as const],
        sources: [disabled],
      };
      await ds.getRepository(RawDocumentVersionSchema).save({
        sourceId: disabled.sourceKey,
        url: disabled.url,
        checksum: 'old',
        payloadKind: 'text',
        body: 'old body',
        contentType: 'text/plain',
        fetchedAt: '2026-09-11T00:00:00.000Z',
      });
      const version = await ds
        .getRepository(RawDocumentVersionSchema)
        .findOneBy({ checksum: 'old' });
      await ds.getRepository(RawDocumentSchema).save({
        sourceId: disabled.sourceKey,
        urlHash: 'old-hash',
        url: disabled.url,
        contentType: 'text/plain',
        body: null,
        checksum: 'old',
        fetchedAt: '2026-09-11T00:00:00.000Z',
        activeVersionId: version?.id,
      });
      const result = await parseAll(ds, locality);
      expect(result.parsed).toBe(0);
      expect(parseCalls).toBe(0);
    } finally {
      await ds.destroy();
    }
  });
});
