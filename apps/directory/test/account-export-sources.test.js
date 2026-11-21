const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createDirectoryAccountExportSources,
} = require('../src/account-export-sources');
const {
  DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} = require('../../../libs/constants/src/lib/libs/directory');
const {
  DIRECTORY_ACCOUNT_LIFECYCLE_INVENTORY: inventory,
} = require('../src/account-lifecycle-dispositions');
const uuid = () => require('node:crypto').randomUUID();
const sources = createDirectoryAccountExportSources(
  'directory_export_scope_test'
);
const by = (name) => sources.find((s) => s.source === name);

test('sources are exactly the declared capture sources, in order', () => {
  assert.deepEqual(
    sources.map((s) => s.source),
    [...DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES]
  );
  assert.throws(
    () => createDirectoryAccountExportSources('x"; DROP TABLE y; --'),
    /INVALID_PROFILE_TABLE/
  );
});

test('every query is bound to the account, paged in C collation, and limited', () => {
  for (const { source, sql } of sources) {
    assert.match(sql, /\$1/, source);
    assert.match(sql, /\$2::text COLLATE "C"/, source);
    assert.match(sql, /LIMIT \$3/, source);
    assert.doesNotMatch(sql, /\$4/, source);
    assert.match(
      sql,
      source === 'DirectoryExportCoverage'
        ? /WHERE 'coverage'/
        : /ORDER BY .* COLLATE "C" LIMIT/,
      source
    );
  }
  // Identity is matched only in the domain the column holds.
  assert.match(by('DirectoryBusinessLinkRequest').sql, /"ownerId"=\$1::uuid/);
  assert.doesNotMatch(by('DirectoryBusinessLinkRequest').sql, /"ownerId" IN/);
  assert.match(
    by('DirectoryBoundaryDecision').sql,
    /"reviewerId" IN \(SELECT id FROM "directory_export_scope_test"\)/
  );
  assert.doesNotMatch(by('DirectoryBoundaryDecision').sql, /"reviewerId"=\$1/);
  assert.match(
    by('DirectoryAddressReviewDecision').sql,
    /"actorId" IN \(SELECT id FROM "directory_export_scope_test"\)/
  );
  assert.match(
    by('DirectoryBusinessLinkEvent').sql,
    /"actorDomain"='account' AND e\."actorId"=\$1::uuid/
  );
  assert.match(
    by('DirectoryBusinessLinkEvent').sql,
    /"actorDomain"='profile' AND e\."actorId" IN/
  );
  // Ambiguous matches are counted, never selected.
  const coverage = by('DirectoryExportCoverage').sql;
  for (const part of [
    '"ownerId" IN',
    '"reviewerId"=$1::uuid',
    '"actorId"=$1::uuid',
  ])
    assert.ok(coverage.includes(part), part);
});

test('selected columns are exactly the included, non-identity columns of the inventory', () => {
  const included = (table) =>
    inventory.tables
      .find((t) => t.table === table)
      .columns.filter((g) => g.export === 'include')
      .flatMap((g) => [...g.fields]);
  const selected = (name, table) => {
    const sql = by(name).sql;
    const list = sql.slice(7, sql.indexOf(' FROM '));
    return [
      ...list.matchAll(
        /(?:AS "?(\w+)"?|\b[a-z]\.(\w+)(?=,|$)|\b[a-z]\."(\w+)")/g
      ),
    ].map((m) => m[1] || m[2] || m[3]);
  };
  const flat = (name, table) =>
    selected(name, table).map((c) =>
      c === 'id' && name === 'DirectoryBusinessLinkRequest'
        ? 'requestId'
        : c === 'id' && name === 'DirectoryBoundaryDecision'
        ? 'requestId'
        : c
    );
  for (const [name, table] of [
    ['DirectoryBusinessLinkRequest', 'directory_business_link_request'],
    ['DirectoryBusinessLinkEvent', 'directory_business_link_event'],
    ['DirectoryBoundaryDecision', 'directory_boundary_decision'],
    ['DirectoryAddressReviewDecision', 'directory_address_review_decision'],
  ]) {
    const got = new Set(flat(name, table)),
      want = new Set(included(table));
    for (const column of got)
      assert.ok(
        want.has(column),
        `${name} selects ${column} which the inventory does not include`
      );
    for (const identity of ['ownerId', 'actorId', 'reviewerId'])
      assert.ok(!got.has(identity), `${name} exports ${identity}`);
  }
});

test('projection validates every field and never carries an identity column', () => {
  const ids = {
    id: uuid(),
    townId: uuid(),
    listingId: uuid(),
    businessCommunityId: uuid(),
  };
  const request = by('DirectoryBusinessLinkRequest').project(
    {
      ...ids,
      status: 'approved',
      createdAt: '2026-11-01 10:00:00.5+00',
      ownerId: 'x',
    },
    'acct'
  );
  assert.deepEqual(Object.keys(request).sort(), [
    'businessCommunityId',
    'createdAt',
    'id',
    'listingId',
    'status',
    'townId',
  ]);
  assert.equal(request.createdAt, '2026-11-01T10:00:00.500Z');
  assert.throws(
    () =>
      by('DirectoryBusinessLinkRequest').project(
        { ...ids, status: 'weird', createdAt: '2026-11-01T00:00:00Z' },
        'a'
      ),
    /UNKNOWN_ENUM/
  );
  assert.throws(
    () =>
      by('DirectoryBusinessLinkRequest').project(
        {
          ...ids,
          id: 'nope',
          status: 'pending',
          createdAt: '2026-11-01T00:00:00Z',
        },
        'a'
      ),
    /INVALID_ID/
  );
  const event = by('DirectoryBusinessLinkEvent').project(
    {
      id: uuid(),
      requestId: uuid(),
      action: 'approve',
      actorDomain: 'profile',
      actorId: uuid(),
      evidenceUrl: null,
      createdAt: '2026-11-01T00:00:00Z',
    },
    'a'
  );
  assert.deepEqual(Object.keys(event).sort(), [
    'action',
    'actorDomain',
    'createdAt',
    'evidenceUrl',
    'id',
    'requestId',
  ]);
  const review = by('DirectoryAddressReviewDecision').project(
    {
      id: uuid(),
      candidateId: uuid(),
      actorKind: 'human',
      actorId: uuid(),
      decision: 'approve',
      reason: null,
      checks: { a: 1 },
      evidenceUrl: null,
      evidenceHash: null,
      policyVersion: null,
      createdAt: '2026-11-01T00:00:00Z',
      appliedAt: null,
    },
    'a'
  );
  assert.ok(!('actorId' in review));
  assert.equal(review.appliedAt, null);
  assert.throws(
    () =>
      by('DirectoryAddressReviewDecision').project(
        {
          id: uuid(),
          candidateId: uuid(),
          actorKind: 'human',
          decision: 'approve',
          reason: null,
          checks: [],
          createdAt: '2026-11-01T00:00:00Z',
        },
        'a'
      ),
    /INVALID_JSON/
  );
});

test('the coverage row reports counts only and marks the receipt incomplete when anything was withheld', () => {
  const { project } = by('DirectoryExportCoverage');
  assert.deepEqual(project({ id: 'coverage', withheld: '0' }, 'a'), {
    id: 'coverage',
    withheldAmbiguousRows: 0,
    complete: true,
  });
  assert.deepEqual(
    project({ id: 'coverage', withheld: '3', leak: uuid() }, 'a'),
    { id: 'coverage', withheldAmbiguousRows: 3, complete: false }
  );
  assert.throws(
    () => project({ id: 'coverage', withheld: '-1' }, 'a'),
    /INVALID_COUNT/
  );
  assert.throws(
    () => project({ id: 'coverage', withheld: 3 }, 'a'),
    /INVALID_COUNT/
  );
});
