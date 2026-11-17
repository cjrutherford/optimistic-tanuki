const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const dataSource = require('../src/data-source').default;
const {
  DIRECTORY_ACCOUNT_LIFECYCLE_INVENTORY: inventory,
  validateDirectoryDispositions,
  validateDirectoryPhysicalCatalog,
} = require('../src/account-lifecycle-dispositions');
const {
  DIRECTORY_DELETION_IDENTITIES,
  DirectoryDeletionBlockedError,
  executeDirectoryAccountDeletion,
  runDirectoryDeletion,
} = require('../src/account-lifecycle');
const {
  directoryFenceKeys,
  assertDirectoryIdentitiesUnfenced,
} = require('../src/account-lifecycle-fence');
const {
  createAccountLifecycleHandler,
} = require('../src/account-lifecycle-server');
const {
  validateDeletionGrantShape,
  DELETED_ACCOUNT_ID,
} = require('../../../libs/models/src/lib/libs/account-deletion/account-deletion.contract');
const {
  deletionIdentityKey,
} = require('../../../libs/storage/src/lib/account-deletion-write-fence');

const grant = (action, extra = {}) => ({
  contractVersion: 1,
  operationId: randomUUID(),
  accountId: randomUUID(),
  appId: 'local-hub',
  owner: 'directory',
  action,
  attempt: 1,
  leaseOwner: randomUUID(),
  expiresAt: '2026-11-16T00:00:00.000Z',
  signature: 'a'.repeat(64),
  ...extra,
});
const catalog = () => [
  ...inventory.tables.map((t) => ({
    table: t.table,
    columns: t.columns.flatMap((g) => [...g.fields]),
  })),
  { table: 'migrations', columns: ['id'] },
];
/** Records SQL and answers the catalog, fence and count queries of a deletion transaction. */
function fakeDb(counts = () => '0') {
  const sql = [];
  let operationId = null;
  const manager = {
    query: async (text, params) => {
      sql.push(text);
      if (text.includes('information_schema')) return catalog();
      if (text.startsWith('INSERT INTO account_deletion_write_fence')) {
        operationId = params[2];
        return [];
      }
      if (text.startsWith('SELECT "operationId"')) return [{ operationId }];
      if (text.startsWith('SELECT count(*)')) return [{ n: counts(text, sql) }];
      return [];
    },
  };
  return { sql, transaction: (fn) => fn(manager) };
}

test('every Directory entity column has a deletion and export disposition', async () => {
  await dataSource.buildMetadatas();
  const entities = dataSource.entityMetadatas.map((m) => ({
    name: m.name,
    tableName: m.tableName,
    columns: m.columns.map((c) => ({ databaseName: c.databaseName })),
  }));
  assert.ok(entities.length >= 27);
  assert.deepEqual(validateDirectoryDispositions(entities, inventory), []);
  // The check must catch a new column, a new table and a removed column.
  const grown = entities.map((e) =>
    e.tableName === 'directory_business_link_event'
      ? { ...e, columns: [...e.columns, { databaseName: 'actorProfileId' }] }
      : e
  );
  assert.deepEqual(validateDirectoryDispositions(grown, inventory), [
    'directory_business_link_event.actorProfileId is unclassified',
  ]);
  assert.deepEqual(
    validateDirectoryDispositions(
      [
        ...entities,
        {
          name: 'DirectoryClaim',
          tableName: 'directory_claim',
          columns: [{ databaseName: 'ownerId' }],
        },
      ],
      inventory
    ),
    ['directory_claim is unclassified']
  );
  const shrunk = entities.map((e) =>
    e.tableName === 'directory_town'
      ? { ...e, columns: e.columns.filter((c) => c.databaseName !== 'slug') }
      : e
  );
  assert.deepEqual(validateDirectoryDispositions(shrunk, inventory), [
    'directory_town.slug is not a column',
  ]);
});

test('the erase policy and the inventory name the same identity columns', () => {
  const listed = {};
  for (const table of inventory.tables)
    for (const group of table.columns)
      if (group.class === 'identity') {
        assert.equal(group.deletion, 'null-when-domain-matches');
        assert.equal(group.export, 'exclude');
        listed[table.table] = group.fields.map((field) => [
          field,
          group.domain,
        ]);
      }
  assert.deepEqual(
    listed,
    JSON.parse(JSON.stringify(DIRECTORY_DELETION_IDENTITIES))
  );
  // No identifier-shaped column may hide in a table declared to have no subject.
  const suspicious = /(owner|actor|reviewer|user|profile|account)id$/i;
  for (const table of inventory.tables)
    if (table.subject === 'none')
      for (const field of table.columns.flatMap((g) => g.fields))
        assert.ok(!suspicious.test(field), `${table.table}.${field}`);
});

test('the physical catalog check refuses unclassified tables and columns', () => {
  assert.deepEqual(validateDirectoryPhysicalCatalog(inventory, catalog()), []);
  assert.deepEqual(
    validateDirectoryPhysicalCatalog(inventory, [
      ...catalog(),
      { table: 'directory_claim', columns: ['ownerId'] },
    ]),
    ['directory_claim is unclassified']
  );
  const drifted = catalog().map((t) =>
    t.table === 'directory_boundary_decision'
      ? { ...t, columns: [...t.columns, 'reviewerAccountId'] }
      : t
  );
  assert.deepEqual(validateDirectoryPhysicalCatalog(inventory, drifted), [
    'directory_boundary_decision.reviewerAccountId is unclassified',
  ]);
  assert.deepEqual(
    validateDirectoryPhysicalCatalog(
      inventory,
      catalog().filter((t) => t.table !== 'account_deletion_write_fence')
    ),
    ['account_deletion_write_fence is missing']
  );
  assert.deepEqual(validateDirectoryPhysicalCatalog(inventory, null), [
    'invalid physical catalog',
  ]);
});

test('a write is checked against the fence under every identity kind', async () => {
  const id = randomUUID();
  assert.deepEqual(
    directoryFenceKeys([id, id.toUpperCase(), null, undefined]),
    ['account', 'profile', 'legacy-profile']
      .map((kind) => deletionIdentityKey(kind, id))
      .sort((a, b) => a.localeCompare(b))
  );
  // Identifiers no grant can name are never fenced, so they add no keys and no error.
  assert.deepEqual(
    directoryFenceKeys([
      DELETED_ACCOUNT_ID,
      '00000000-0000-0000-8000-000000000001',
      'bad',
    ]),
    []
  );
  const sql = [];
  const open = {
    query: async (text) => {
      sql.push(text);
      return [];
    },
  };
  await assertDirectoryIdentitiesUnfenced(open, [id]);
  assert.equal(
    sql.filter((text) => text.includes('pg_advisory_xact_lock')).length,
    3
  );
  assert.match(sql[3], /account_deletion_write_fence/);
  await assert.rejects(
    assertDirectoryIdentitiesUnfenced(
      { query: async (text) => (text.includes('write_fence') ? [{}] : []) },
      [id]
    ),
    /ACCOUNT_DELETION_FENCED/
  );
  const none = [];
  await assertDirectoryIdentitiesUnfenced(
    {
      query: async (text) => {
        none.push(text);
        return [];
      },
    },
    [null]
  );
  assert.deepEqual(none, []);
});

test('scope is validated before any transaction', async () => {
  const account = randomUUID(),
    operationId = randomUUID();
  const db = {
    transaction: () => {
      throw Error('must not open');
    },
  };
  for (const scope of [
    {
      operationId,
      accountId: account,
      profileIds: [account],
      legacyProfileIds: [],
    },
    {
      operationId,
      accountId: DELETED_ACCOUNT_ID,
      profileIds: [],
      legacyProfileIds: [],
    },
    {
      operationId: 'x',
      accountId: account,
      profileIds: [],
      legacyProfileIds: [],
    },
    {
      operationId,
      accountId: account,
      profileIds: ['bad'],
      legacyProfileIds: [],
    },
    {
      operationId,
      accountId: account,
      profileIds: [account.toUpperCase()],
      legacyProfileIds: [],
    },
  ])
    await assert.rejects(
      runDirectoryDeletion(db, scope, 'erase'),
      /DIRECTORY_DELETION_SCOPE_INVALID/
    );
  await assert.rejects(
    runDirectoryDeletion(
      db,
      { operationId, accountId: account, profileIds: [], legacyProfileIds: [] },
      'finalize'
    ),
    /DIRECTORY_DELETION_ACTION_INVALID/
  );
});

test('erase writes nothing when an ambiguous row exists or the catalog drifted', async () => {
  const scope = {
    operationId: randomUUID(),
    accountId: randomUUID(),
    profileIds: [randomUUID()],
    legacyProfileIds: ['legacy-key'],
  };
  const blocked = fakeDb((text) =>
    text.includes('AND NOT') ||
    text.includes('IS NOT TRUE') ||
    text.includes('<>')
      ? '1'
      : '0'
  );
  await assert.rejects(
    runDirectoryDeletion(blocked, scope, 'erase'),
    (error) =>
      error instanceof DirectoryDeletionBlockedError &&
      error.report.blocked === 12 &&
      error.report.remaining === 0
  );
  assert.equal(
    blocked.sql.filter((text) =>
      /^(UPDATE|DELETE|INSERT INTO directory)/.test(text)
    ).length,
    0
  );
  assert.deepEqual(await runDirectoryDeletion(blocked, scope, 'readback'), {
    remaining: 0,
    blocked: 12,
  });
  const drift = {
    transaction: (fn) =>
      fn({
        query: async (text) =>
          text.includes('information_schema')
            ? [...catalog(), { table: 'directory_claim', columns: ['ownerId'] }]
            : [],
      }),
  };
  await assert.rejects(
    runDirectoryDeletion(drift, scope, 'erase'),
    /DIRECTORY_DELETION_CATALOG_DRIFT/
  );
  const huge = fakeDb(() => '10001');
  await assert.rejects(
    runDirectoryDeletion(huge, scope, 'erase'),
    /DIRECTORY_DELETION_ROW_BOUND/
  );
  // A clean erase issues its writes after installing the fence, then reads back.
  const clean = fakeDb();
  assert.deepEqual(await runDirectoryDeletion(clean, scope, 'erase'), {
    remaining: 0,
    blocked: 0,
  });
  const fence = clean.sql.findIndex((text) =>
      text.startsWith('INSERT INTO account_deletion_write_fence')
    ),
    firstWrite = clean.sql.findIndex((text) => /^(UPDATE|DELETE)/.test(text));
  assert.ok(fence >= 0 && firstWrite > fence);
  assert.equal(
    clean.sql.filter((text) => text.startsWith('SELECT count(*)')).length,
    48
  );
});

test('a grant is refused unless it names Directory, its action, and an authority-confirmed scope', async () => {
  const profile = randomUUID();
  const calls = [];
  const authority = (scope) => ({
    validate: async (value, owner, action) => {
      calls.push([owner, action]);
      return {
        accountId: value.accountId,
        scope: typeof scope === 'function' ? scope() : scope,
      };
    },
  });
  const ok = { currentProfileIds: [profile], legacyProfileIds: [] };
  const deps = { db: fakeDb(), authority: authority(ok) };
  assert.deepEqual(
    await executeDirectoryAccountDeletion(deps, grant('erase'), 'erase'),
    { verified: true, remaining: 0, blocked: 0 }
  );
  assert.deepEqual(calls, [
    ['directory', 'erase'],
    ['directory', 'erase'],
    ['directory', 'erase'],
  ]);
  assert.deepEqual(
    await executeDirectoryAccountDeletion(
      { ...deps, db: fakeDb(() => '1') },
      grant('fence'),
      'fence'
    ),
    { verified: true, remaining: 12, blocked: 12 }
  );
  assert.deepEqual(
    await executeDirectoryAccountDeletion(
      { ...deps, db: fakeDb(() => '1') },
      grant('readback'),
      'readback'
    ),
    { verified: false, remaining: 12, blocked: 12 }
  );
  const refuse = (value, action, d = deps) =>
    assert.rejects(
      executeDirectoryAccountDeletion(d, value, action),
      /DIRECTORY_DELETION_GRANT_INVALID/
    );
  await refuse(grant('erase', { owner: 'social' }), 'erase');
  await refuse(grant('readback'), 'erase');
  await refuse(grant('finalize'), 'finalize');
  await refuse(grant('erase', { signature: 'short' }), 'erase');
  await refuse(grant('erase', { accountId: DELETED_ACCOUNT_ID }), 'erase');
  await refuse({ ...grant('erase'), extra: true }, 'erase');
  await refuse(null, 'erase');
  await assert.rejects(
    executeDirectoryAccountDeletion(
      { ...deps, authority: authority(null) },
      grant('erase'),
      'erase'
    ),
    /DIRECTORY_DELETION_SCOPE_INVALID/
  );
  await assert.rejects(
    executeDirectoryAccountDeletion(
      {
        ...deps,
        authority: {
          validate: async () => ({ accountId: randomUUID(), scope: ok }),
        },
      },
      grant('erase'),
      'erase'
    ),
    /DIRECTORY_DELETION_SCOPE_INVALID/
  );
  await assert.rejects(
    executeDirectoryAccountDeletion(
      {
        ...deps,
        authority: {
          validate: async () => {
            throw Error('ACCOUNT_DELETION_AUTHORITY_REPLY_INVALID');
          },
        },
      },
      grant('erase'),
      'erase'
    ),
    /AUTHORITY_REPLY_INVALID/
  );
  let n = 0;
  const moving = authority(() =>
    n++ === 0
      ? ok
      : { currentProfileIds: [profile, randomUUID()], legacyProfileIds: [] }
  );
  const db = fakeDb();
  await assert.rejects(
    executeDirectoryAccountDeletion(
      { ...deps, db, authority: moving },
      grant('erase'),
      'erase'
    ),
    /DIRECTORY_DELETION_SCOPE_CHANGED/
  );
  assert.equal(
    db.sql.filter((text) => /^(UPDATE|DELETE)/.test(text)).length,
    0
  );
});

test('the internal route authenticates the caller and reports counts only', async () => {
  const secret = 's'.repeat(32);
  assert.throws(
    () => createAccountLifecycleHandler(async () => ({}), 'short'),
    /secret/
  );
  const seen = [];
  let outcome = async () => ({ verified: true, remaining: 0, blocked: 0 });
  const handler = createAccountLifecycleHandler(async (value, action) => {
    seen.push([value, action]);
    return outcome();
  }, secret);
  const server = createServer(async (req, res) => {
    if (!(await handler(req, res))) res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const call = (path, options = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: '{"a":1}',
      ...options,
    });
  try {
    assert.equal(
      (await call('/internal/account-deletion/finalize')).status,
      404
    );
    assert.equal(
      (
        await call('/internal/account-deletion/erase', {
          headers: { authorization: 'Bearer ' + 'x'.repeat(32) },
        })
      ).status,
      401
    );
    assert.equal(
      (await call('/internal/account-deletion/erase', { headers: {} })).status,
      401
    );
    assert.equal(
      (
        await call('/internal/account-deletion/erase', {
          method: 'GET',
          body: undefined,
        })
      ).status,
      405
    );
    assert.equal(
      (await call('/internal/account-deletion/erase', { body: '{' })).status,
      400
    );
    assert.equal(
      (
        await call('/internal/account-deletion/erase', {
          body: JSON.stringify({ pad: 'x'.repeat(40000) }),
        })
      ).status,
      413
    );
    assert.deepEqual(seen, []);
    const ok = await call('/internal/account-deletion/readback');
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await ok.json(), {
      owner: 'directory',
      verified: true,
      remaining: 0,
      blocked: 0,
    });
    assert.deepEqual(seen, [[{ a: 1 }, 'readback']]);
    outcome = async () => {
      throw new DirectoryDeletionBlockedError({ remaining: 2, blocked: 1 });
    };
    const blocked = await call('/internal/account-deletion/erase');
    assert.equal(blocked.status, 409);
    assert.deepEqual(await blocked.json(), {
      owner: 'directory',
      verified: false,
      status: 'blocked',
      remaining: 2,
      blocked: 1,
    });
    outcome = async () => {
      throw Error('DIRECTORY_DELETION_GRANT_INVALID');
    };
    assert.equal((await call('/internal/account-deletion/fence')).status, 403);
    outcome = async () => {
      throw Error('secret detail');
    };
    const failed = await call('/internal/account-deletion/fence');
    assert.equal(failed.status, 503);
    assert.equal(await failed.text(), '');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('environment, snapshot purge, runtime readback and export routes are mounted only when supplied', async () => {
  const secret = 's'.repeat(32);
  const seen = [];
  const op = (name) => async (payload) => {
    seen.push([name, payload]);
    return { name, ok: true };
  };
  const serve = async (handler) => {
    const server = createServer(async (req, res) => {
      if (!(await handler(req, res))) res.writeHead(404).end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return server;
  };
  const call = (server, path, options = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      body: '{"a":1}',
      ...options,
    });
  const bare = await serve(
    createAccountLifecycleHandler(
      async () => ({ verified: true, remaining: 0, blocked: 0 }),
      secret
    )
  );
  const full = await serve(
    createAccountLifecycleHandler(
      async () => ({ verified: true, remaining: 0, blocked: 0 }),
      secret,
      {
        environment: op('environment'),
        purgeSnapshots: op('purge'),
        runtimeReadback: op('runtime'),
        exportOpen: op('open'),
        exportRead: op('read'),
        exportRelease: op('release'),
      }
    )
  );
  try {
    for (const path of [
      '/internal/account-deletion/environment',
      '/internal/account-deletion/purge-snapshots',
      '/internal/account-deletion/runtime-readback',
      '/internal/account-export/open',
      '/internal/account-export/read',
      '/internal/account-export/release',
    ])
      assert.equal((await call(bare, path)).status, 404, path);
    const routes = [
      ['/internal/account-deletion/environment', 'environment'],
      ['/internal/account-deletion/purge-snapshots', 'purge'],
      ['/internal/account-deletion/runtime-readback', 'runtime'],
      ['/internal/account-export/open', 'open'],
      ['/internal/account-export/read', 'read'],
      ['/internal/account-export/release', 'release'],
    ];
    for (const [path, name] of routes) {
      assert.equal(
        (
          await call(full, path, {
            headers: { authorization: 'Bearer ' + 'x'.repeat(32) },
          })
        ).status,
        401,
        path
      );
      assert.equal((await call(full, path, { headers: {} })).status, 401, path);
      assert.equal(
        (await call(full, path, { method: 'GET', body: undefined })).status,
        405,
        path
      );
    }
    assert.deepEqual(seen, []);
    for (const [path, name] of routes) {
      const reply = await call(full, path);
      assert.equal(reply.status, 200, path);
      assert.deepEqual(await reply.json(), { name, ok: true });
    }
    assert.deepEqual(
      seen.map((x) => x[0]),
      routes.map((x) => x[1])
    );
    assert.ok(seen.every((x) => x[1].a === 1));
    assert.equal(
      (
        await call(full, '/internal/account-export/open', {
          body: JSON.stringify({ pad: 'x'.repeat(40000) }),
        })
      ).status,
      413
    );
    assert.equal(
      (await call(full, '/internal/account-export/finalize')).status,
      404
    );
  } finally {
    await new Promise((resolve) => bare.close(resolve));
    await new Promise((resolve) => full.close(resolve));
  }
  const failing = await serve(
    createAccountLifecycleHandler(async () => ({}), secret, {
      exportRead: async () => {
        throw Error('secret detail');
      },
    })
  );
  try {
    const reply = await call(failing, '/internal/account-export/read');
    assert.equal(reply.status, 503);
    assert.equal(await reply.text(), '');
  } finally {
    await new Promise((resolve) => failing.close(resolve));
  }
});

test('lifecycle settings fail closed', () => {
  const { accountLifecycleConfig } = require('../src/account-lifecycle-server');
  assert.equal(accountLifecycleConfig({}), undefined);
  assert.equal(
    accountLifecycleConfig({ DIRECTORY_ACCOUNT_DELETION_SECRET: '' }),
    undefined
  );
  const secret = 'k'.repeat(32);
  assert.deepEqual(
    accountLifecycleConfig({ DIRECTORY_ACCOUNT_DELETION_SECRET: secret }),
    {
      secret,
      authenticationHost: 'authentication',
      authenticationPort: 3001,
      profileHost: 'profile',
      profilePort: 3002,
    }
  );
  assert.equal(
    accountLifecycleConfig({
      DIRECTORY_ACCOUNT_DELETION_SECRET: secret,
      DIRECTORY_AUTHENTICATION_HOST: 'auth',
      DIRECTORY_AUTHENTICATION_PORT: '4001',
      DIRECTORY_PROFILE_PORT: '4002',
    }).authenticationPort,
    4001
  );
  assert.throws(
    () =>
      accountLifecycleConfig({ DIRECTORY_ACCOUNT_DELETION_SECRET: 'short' }),
    /Invalid account lifecycle secret/
  );
  assert.throws(
    () =>
      accountLifecycleConfig({
        DIRECTORY_ACCOUNT_DELETION_SECRET: 'k'.repeat(31) + ' ',
      }),
    /Invalid account lifecycle secret/
  );
  assert.throws(
    () =>
      accountLifecycleConfig({ DIRECTORY_ACCOUNT_DELETION_SECRET: secret }, [
        undefined,
        secret,
      ]),
    /Invalid account lifecycle secret/
  );
  assert.throws(
    () =>
      accountLifecycleConfig({
        DIRECTORY_ACCOUNT_DELETION_SECRET: secret,
        DIRECTORY_PROFILE_PORT: '0x',
      }),
    /DIRECTORY_PROFILE_PORT/
  );
});

test('reviewer write paths check the fence first, inside their transaction', async () => {
  const { recordBoundaryDecision } = require('../src/boundary-decision');
  const {
    recordHumanAddressReviewDecision,
  } = require('../src/address-review-store');
  const reviewer = randomUUID();
  const open = (fenced) => {
    const sql = [];
    return {
      sql,
      db: {
        transaction: async (fn) =>
          fn({
            query: async (text) => {
              sql.push(text);
              return text.includes('account_deletion_write_fence') && fenced
                ? [{}]
                : [];
            },
          }),
      },
    };
  };
  const boundary = {
    requestId: randomUUID(),
    reviewerId: reviewer,
    decision: 'verified',
    attested: true,
    sourceUrl: 'https://www.census.gov/geographies/reference-files.html',
    candidate: { communityId: randomUUID(), changeToken: randomUUID() },
  };
  const human = {
    candidateId: randomUUID(),
    decisionId: randomUUID(),
    expectedVersionToken: 'a'.repeat(64),
    actorId: reviewer,
    decision: 'reject',
  };
  for (const [name, call] of [
    [
      'boundary',
      (db) => recordBoundaryDecision(db, {}, boundary, async () => null),
    ],
    ['address', (db) => recordHumanAddressReviewDecision(db, human)],
  ]) {
    const fenced = open(true);
    await assert.rejects(call(fenced.db), /ACCOUNT_DELETION_FENCED/, name);
    assert.ok(
      fenced.sql.every((text) =>
        /pg_advisory_xact_lock|account_deletion_write_fence/.test(text)
      ),
      name + ' touched rows before the fence check'
    );
    // Unfenced, the same call gets past the fence check and fails later on its own rules.
    const free = open(false);
    await assert.rejects(
      call(free.db),
      (error) => !/ACCOUNT_DELETION_FENCED/.test(String(error.message)),
      name
    );
    assert.ok(free.sql.length > fenced.sql.length - 1, name);
  }
});
