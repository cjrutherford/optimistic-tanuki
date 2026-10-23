import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = '/home/cjrutherford/workspace/optimistic-tanuki';
const outputPath = process.env.N03_METADATA_PATH || '';
const marker = 'private-n03-otts-v1';
const appNames = [
  'authentication',
  'profile',
  'permissions',
  'social',
  'forum',
  'assets',
  'videos',
  'workspace',
  'app-configurator',
  'chat-collector',
  'classifieds',
];

function loadRegisteredOptions(app: string): DataSourceOptions {
  const appRoot = resolve(root, 'apps', app);
  const req = createRequire(resolve(appRoot, 'package.json'));
  if (app === 'app-configurator') {
    const configPath = req.resolve('./src/config');
    const fixtureDatabase = {
      host: '127.0.0.1',
      port: 15563,
      username: 'postgres',
      password: 'postgres',
      database: 'ot_' + app.replace(/-/g, '_'),
      name: 'ot_' + app.replace(/-/g, '_'),
    };
    req.cache[configPath] = {
      id: configPath,
      filename: configPath,
      loaded: true,
      exports: {
        __esModule: true,
        default: () => ({ database: fixtureDatabase }),
      },
      children: [],
      paths: [],
    } as NodeModule;
    const registration = req('./src/app/loadDatabase');
    return registration.default();
  }
  const registration = req('./src/app/loadDatabase');
  const database = {
    host: '127.0.0.1',
    port: 15563,
    username: 'postgres',
    password: 'postgres',
    database: 'ot_' + app.replace(/-/g, '_'),
    name: 'ot_' + app.replace(/-/g, '_'),
  };
  const config = {
    get: (key: string) => (key === 'database' ? database : undefined),
  };
  const fn = registration.default || registration.loadDatabase || registration;
  return fn(config);
}

function registeredOptions(app: string): DataSourceOptions {
  const fixture: Record<string, string> = {
    POSTGRES_DB: 'ot_' + app.replace(/-/g, '_'),
    DATABASE_NAME: 'ot_' + app.replace(/-/g, '_'),
    POSTGRES_HOST: '127.0.0.1',
    DATABASE_HOST: '127.0.0.1',
    POSTGRES_PORT: '15563',
    DATABASE_PORT: '15563',
    POSTGRES_USER: 'postgres',
    DATABASE_USER: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    DATABASE_PASSWORD: 'postgres',
  };
  const previous = Object.fromEntries(
    Object.keys(fixture).map((name) => [name, process.env[name]])
  );
  try {
    for (const [name, value] of Object.entries(fixture))
      process.env[name] = value;
    return loadRegisteredOptions(app);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

export async function collectN03Metadata() {
  if (process.env.N03_PRIVATE_MARKER !== marker)
    throw new Error('PRIVATE_N03_WORKER_REQUIRED');
  if (
    !outputPath ||
    !resolve(outputPath).startsWith(
      `${resolve(
        root,
        '.runtime-artifacts/account-rights/finish-sequence/search-stores/runtime'
      )}/`
    )
  )
    throw new Error('N03_METADATA_PATH_OUTSIDE_RUNTIME');
  const owners = [];
  for (const app of appNames) {
    const options: any = registeredOptions(app);
    const entities = (options.entities || []).filter(
      (e: any) => typeof e === 'function' || typeof e === 'object'
    );
    const source = new DataSource({
      ...options,
      entities,
      synchronize: false,
      migrationsRun: false,
    });
    await (source as any).buildMetadatas();
    const tables = source.entityMetadatas.map((m: any) => ({
      name: m.tableName,
      columns: m.columns.map((c: any) => ({
        name: c.databaseName,
        type: typeof c.type === 'function' ? c.type.name : c.type,
        isPrimary: c.isPrimary,
        isGenerated: c.isGenerated,
      })),
      indices: m.indices.map((i: any) => ({
        name: i.name,
        columns: i.columns.map((c: any) => c.databaseName),
        unique: i.isUnique,
      })),
    }));
    for (const m of source.entityMetadatas)
      if (
        m.junctionEntityMetadata &&
        !tables.some((t: any) => t.name === m.junctionEntityMetadata.tableName)
      ) {
        const j = m.junctionEntityMetadata;
        tables.push({
          name: j.tableName,
          columns: j.columns.map((c: any) => ({
            name: c.databaseName,
            type: typeof c.type === 'function' ? c.type.name : c.type,
            isPrimary: c.isPrimary,
            isGenerated: c.isGenerated,
          })),
          indices: j.indices.map((i: any) => ({
            name: i.name,
            columns: i.columns.map((c: any) => c.databaseName),
            unique: i.isUnique,
          })),
        });
      }
    owners.push({
      owner: app,
      database: options.database,
      entities: source.entityMetadatas.map((m: any) => m.name),
      tables,
      migrationTableName: (options as any).migrationsTableName || 'migrations',
      migrationBookkeeping: {
        id: 'integer',
        timestamp: 'bigint',
        name: 'varchar',
      },
    });
  }
  return {
    configurationBoundary:
      'synthetic database configuration and scoped environment overrides; app-configurator config module require.cache entry replaced in isolated metadata process',
    owners,
  };
}

async function runHistoryProof() {
  const reportPath = process.env.N03_HISTORY_REPORT_PATH || '';
  if (
    process.env.N03_PRIVATE_MARKER !== marker ||
    process.env.E2E_DB_PORT !== '15563' ||
    !resolve(reportPath).startsWith(
      `${resolve(
        root,
        '.runtime-artifacts/account-rights/finish-sequence/search-stores/runtime'
      )}/`
    )
  )
    throw new Error('PRIVATE_N03_HISTORY_REQUIRED');
  const {
    SearchService,
  } = require('../../../social/src/app/services/search.service');
  const { randomUUID } = require('node:crypto');
  const assert = require('node:assert/strict');
  let social = new DataSource({
    ...registeredOptions('social'),
    synchronize: false,
    migrationsRun: false,
    applicationName: 'n03-history-source',
  } as any);
  const profile = new DataSource({
    ...registeredOptions('profile'),
    synchronize: false,
    migrationsRun: false,
  });
  const profiles = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const owner = randomUUID(),
    counterpart = randomUUID();
  const publicId = randomUUID(),
    privateId = randomUUID();
  const tag = randomUUID().replace(/-/g, '');
  const query = 'n03-' + tag;
  const fn = 'n03_' + tag;
  const trigger = 'n03_trigger_' + tag;
  let blockedReads = false,
    readEntered: (() => void) | undefined,
    releaseRead: (() => void) | undefined;
  let writeLock: any, indexReader: any;
  const pending: Promise<unknown>[] = [];
  const report: any = {
    result: 'RUNNING',
    stages: {},
    controlledBoundaries: [
      'synthetic database configuration',
      'trusted owned-profile set selected from real Profile rows; no authenticated deletion API',
      'community-read scheduler barrier and private SQL failure/lock triggers',
    ],
    cleanup: {},
  };
  const waitFor = async (test: () => Promise<boolean>) => {
    const end = Date.now() + 5000;
    while (!(await test())) {
      if (Date.now() > end) throw new Error('N03_BARRIER_TIMEOUT');
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const makeService = () => {
    const repo = social.getRepository('Community');
    const communityProxy = new Proxy(repo, {
      get(target, key) {
        if (key === 'find')
          return async (options: any) => {
            const rows = await target.find(options);
            if (blockedReads) {
              blockedReads = false;
              readEntered?.();
              await new Promise<void>((r) => (releaseRead = r));
            }
            return rows;
          };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    return new SearchService(
      social.getRepository('SearchHistory'),
      social.getRepository('Post'),
      communityProxy,
      null,
      null,
      null
    );
  };
  const ownCount = async () =>
    Number(
      (
        await social.query(
          'SELECT count(*)::int AS count FROM search_history WHERE LOWER("profileId")=ANY($1::text[])',
          [[profiles[0], profiles[2]]]
        )
      )[0].count
    );
  const indexedRows = async (profileId: string, q: string) => {
    indexReader ||= social.createQueryRunner();
    if (!indexReader.isReleased) await indexReader.connect();
    await indexReader.query('SET enable_seqscan=off');
    const plan = await indexReader.query(
      'EXPLAIN (FORMAT JSON) SELECT id FROM search_history WHERE "profileId"=$1 AND query=$2',
      [profileId, q]
    );
    assert.ok(
      JSON.stringify(plan).includes('IDX_53debe423b26554a3df7349128'),
      'Search-history profile/query index must serve the independent read'
    );
    return indexReader.query(
      'SELECT id FROM search_history WHERE "profileId"=$1 AND query=$2',
      [profileId, q]
    );
  };
  let failure: unknown;
  try {
    await social.initialize();
    await profile.initialize();
    await profile.query(
      `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'client-interface','N03 OT','','','','','','',''),($3,$4,'client-interface','N03 counterpart','','','','','','',''),($5,$2,'local-hub','N03 TS','','','','','','','')`,
      [profiles[0], owner, profiles[1], counterpart, profiles[2]]
    );
    await profile.query(
      `INSERT INTO profile (id,"userId","appScope","profileName","profilePic","coverPic",bio,location,occupation,interests,skills) VALUES ($1,$2,'n03-excluded-app','N03 scope-negative','','','','','','','')`,
      [profiles[3], owner]
    );
    const owned = (
      await profile.query(
        `SELECT id FROM profile WHERE "userId"=$1 AND "appScope" IN ('client-interface','local-hub') ORDER BY id`,
        [owner]
      )
    ).map((r: any) => r.id);
    assert.deepEqual([...owned].sort(), [profiles[0], profiles[2]].sort());
    const communities = social.getRepository('Community');
    await communities.save([
      {
        id: publicId,
        name: query + '-public',
        description: query,
        ownerId: owner,
        ownerProfileId: profiles[0],
        appScope: 'client-interface',
        isPrivate: false,
      },
      {
        id: privateId,
        name: query + '-private',
        description: query,
        ownerId: counterpart,
        ownerProfileId: profiles[1],
        appScope: 'local-hub',
        isPrivate: true,
      },
    ]);
    let service = makeService();
    for (const id of profiles) {
      const result = await service.search(query, { type: 'communities' }, id);
      assert.deepEqual(
        result.communities.map((r: any) => r.id),
        [publicId]
      );
    }
    assert.ok(
      !(await service.getSuggestedCommunities(1000)).some(
        (r: any) => r.id === privateId
      )
    );
    const foreignBefore = JSON.stringify(
      await service.getSearchHistory(profiles[1], 100)
    );
    const outsideBefore = JSON.stringify(
      await service.getSearchHistory(profiles[3], 100)
    );
    await social.getRepository('SearchHistory').save({
      profileId: profiles[0].toUpperCase(),
      query: query + '-legacy',
      searchType: 'communities',
      resultCount: 1,
    });
    assert.equal(await ownCount(), 3);
    assert.equal((await indexedRows(profiles[1], query)).length, 1);
    await assert.rejects(
      service.clearSearchHistoryForProfiles([profiles[0], '*'])
    );
    assert.equal(await ownCount(), 3);
    await service.clearSearchHistoryForProfiles([
      ...owned,
      owned[0].toUpperCase(),
    ]);
    assert.equal(await ownCount(), 0);
    for (const id of owned)
      assert.deepEqual(await service.getSearchHistory(id, 100), []);
    assert.equal(
      JSON.stringify(await service.getSearchHistory(profiles[1], 100)),
      foreignBefore
    );
    assert.equal(
      JSON.stringify(await service.getSearchHistory(profiles[3], 100)),
      outsideBefore
    );
    assert.equal((await indexedRows(profiles[0], query)).length, 0);
    assert.equal((await indexedRows(profiles[1], query)).length, 1);
    report.stages.primaryHistoryAttributionAndNativeIndexCleanup = true;
    report.stages.publicCommunityDiscoveryExcludesPrivate = true;
    blockedReads = true;
    const entered = new Promise<void>((r) => (readEntered = r));
    const old = service.search(
      query + '-old',
      { type: 'communities' },
      profiles[0]
    );
    pending.push(old);
    void old.catch(() => undefined);
    await entered;
    await service.clearSearchHistoryForProfiles(owned);
    releaseRead?.();
    await old;
    assert.equal(await ownCount(), 0);
    report.stages.lateSearchCannotRecreateClearedHistory = true;
    writeLock = social.createQueryRunner();
    await writeLock.connect();
    await writeLock.query('SELECT pg_advisory_lock(730303)');
    await social.query(
      `CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.query='${query}-blocked' THEN PERFORM pg_advisory_xact_lock(730303); END IF; RETURN NEW; END $$`
    );
    await social.query(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON search_history FOR EACH ROW EXECUTE FUNCTION "${fn}"()`
    );
    const writing = service.search(
      query + '-blocked',
      { type: 'communities' },
      profiles[0]
    );
    pending.push(writing);
    void writing.catch(() => undefined);
    await waitFor(
      async () =>
        Number(
          (
            await social.query(
              "SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name='n03-history-source' AND wait_event_type='Lock' AND query LIKE 'INSERT INTO%search_history%'"
            )
          )[0].count
        ) > 0
    );
    let cleared = false;
    const clearing = service.clearSearchHistoryForProfiles(owned).then(() => {
      cleared = true;
    });
    pending.push(clearing);
    void clearing.catch(() => undefined);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(cleared, false);
    await writeLock.query('SELECT pg_advisory_unlock(730303)');
    await writeLock.release();
    writeLock = undefined;
    await Promise.all([writing, clearing]);
    assert.equal(await ownCount(), 0);
    await social.query(`DROP TRIGGER "${trigger}" ON search_history`);
    await social.query(`DROP FUNCTION "${fn}"()`);
    report.stages.activeSqlWriteDrainedBeforeCleanupAck = true;
    await service.search(
      query + '-failure',
      { type: 'communities' },
      profiles[2]
    );
    await social.query(
      `CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.query='${query}-failure' THEN RAISE EXCEPTION 'N03_DELETE_FAULT'; END IF; RETURN OLD; END $$`
    );
    await social.query(
      `CREATE TRIGGER "${trigger}" BEFORE DELETE ON search_history FOR EACH ROW EXECUTE FUNCTION "${fn}"()`
    );
    await assert.rejects(
      service.clearSearchHistoryForProfiles(owned),
      /N03_DELETE_FAULT/
    );
    assert.equal(await ownCount(), 1);
    await social.query(`DROP TRIGGER "${trigger}" ON search_history`);
    await social.query(`DROP FUNCTION "${fn}"()`);
    await service.clearSearchHistoryForProfiles(owned);
    assert.equal(await ownCount(), 0);
    report.stages.cleanupSqlFailureVisibleAndRetryable = true;
    await indexReader.query('RESET enable_seqscan');
    await indexReader.release();
    indexReader = undefined;
    await social.destroy();
    social = new DataSource({
      ...registeredOptions('social'),
      synchronize: false,
      migrationsRun: false,
      applicationName: 'n03-history-source',
    } as any);
    await social.initialize();
    service = makeService();
    assert.equal(await ownCount(), 0);
    assert.equal(
      JSON.stringify(await service.getSearchHistory(profiles[1], 100)),
      foreignBefore
    );
    assert.equal(
      JSON.stringify(await service.getSearchHistory(profiles[3], 100)),
      outsideBefore
    );
    await service.search(query + '-new', { type: 'communities' }, profiles[2]);
    assert.equal(await ownCount(), 1);
    await service.clearSearchHistoryForProfiles(owned);
    assert.equal(await ownCount(), 0);
    report.stages.restartReadbackAndNewIndependentSearch = true;
    report.result = 'PASS';
  } catch (error) {
    failure = error;
    report.result = 'FAIL';
    report.error = String(error);
  } finally {
    releaseRead?.();
    if (writeLock) {
      await writeLock
        .query('SELECT pg_advisory_unlock(730303)')
        .catch(() => undefined);
      await writeLock.release();
    }
    await Promise.allSettled(pending);
    if (social.isInitialized) {
      await social.query(
        `DROP TRIGGER IF EXISTS "${trigger}" ON search_history`
      );
      await social.query(`DROP FUNCTION IF EXISTS "${fn}"()`);
      await social.query(
        'DELETE FROM search_history WHERE LOWER("profileId")=ANY($1::text[])',
        [profiles.map((id: string) => id.toLowerCase())]
      );
      await social.query('DELETE FROM community WHERE id=ANY($1::uuid[])', [
        [publicId, privateId],
      ]);
      report.cleanup.fixtureHistoryRows = Number(
        (
          await social.query(
            'SELECT count(*)::int AS count FROM search_history WHERE LOWER("profileId")=ANY($1::text[])',
            [profiles]
          )
        )[0].count
      );
    }
    if (profile.isInitialized)
      await profile.query('DELETE FROM profile WHERE id=ANY($1::uuid[])', [
        profiles,
      ]);
    if (indexReader && !indexReader.isReleased) {
      await indexReader.query('RESET enable_seqscan');
      await indexReader.release();
    }
    if (social.isInitialized) await social.destroy();
    if (profile.isInitialized) await profile.destroy();
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  if (failure) throw failure;
  return report;
}

if (require.main === module) {
  const mode = process.env.N03_WORKER_MODE || 'metadata';
  if (mode === 'history') {
    void runHistoryProof()
      .then(() => console.log('N03 history source proof PASS'))
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  } else if (mode === 'metadata') {
    void collectN03Metadata()
      .then((result) => {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
        console.log(
          JSON.stringify({
            owners: result.owners.length,
            tables: result.owners.reduce((n, o) => n + o.tables.length, 0),
          })
        );
      })
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  } else throw new Error('N03_UNKNOWN_WORKER_MODE');
}
