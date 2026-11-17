const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const h = require('./reviewed-spatial-helpers');
const f = require('./business-identity-carry-fixtures');
const { applyCarry, planCarry } = require('../src/business-identity-carry');
const { requestBusinessLink, reviewBusinessLink } = require('../src/listing-business-link');
const { stageLinkCarries } = require('../src/business-link-carry');
const { decideBusinessIdentity } = require('../src/business-identity-decision');
const { deletionIdentityKey } = require('../../../libs/storage/src/lib/account-deletion-write-fence');

const url = h.databaseUrl('S5_DECISION_TEST_DATABASE_URL', /^\/s5_identity_decision_[a-z0-9_]+$/i);
const town = '44444444-4444-4444-8444-444444444444';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const reviewer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03';
const page = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04';
const P0 = f.hex('0'), A = f.hex('a'), B = f.hex('b');
const scanA = f.hex('c'), scanB = f.hex('d');
const rows = (...ids) => ids.map((id, i) => ({ n: i + 1, id, name: `Biz ${id}` }));
const actor = { id: reviewer, domain: 'profile' };
const decide = (db, o) => decideBusinessIdentity(db, { decisionId: randomUUID(), townId: town, actor, reason: 'reviewed by hand', ...o });
const biz = async (db, scan, n) => (await db.query('SELECT "businessId" id FROM directory_business_assertion WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2', [scan, n]))[0].id;
const state = async (db, id) => (await db.query('SELECT state,"successorId" FROM directory_business WHERE id=$1', [id]))[0];
const carry = async (db, from, to) => { const o = { fromPolicyId: from, toPolicyId: to, key: f.KEY }; const plan = await planCarry(db, o); await applyCarry(db, { ...o, planDigest: plan.digest }); };

async function setup(db, { link = false, second = false } = {}) {
  await f.clear(db);
  await db.query('TRUNCATE directory_business_identity_decision, directory_reviewed_binding, directory_business_link_carry, directory_business_link_event, directory_business_link_active, directory_business_link_request');
  await f.cohort(db, { policy: A, town, release: '2026-09-23.0', scans: [{ scan: scanA, rows: rows('k1', 'k2', 'k3') }] });
  await carry(db, P0, A);
  let linked = null;
  if (link) {
    const listing = (await db.query('INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,1) RETURNING id', [town, scanA]))[0].id;
    const req = { townId: town, listingId: listing, businessCommunityId: page, ownerId: owner, requestId: randomUUID() };
    await requestBusinessLink(db, req);
    await reviewBusinessLink(db, { ...req, reviewerId: reviewer, decision: 'approve', evidenceUrl: 'https://example.org/proof' });
    linked = req;
  }
  if (second) {
    await f.cohort(db, { policy: B, town, release: '2026-10-21.0', scans: [{ scan: scanB, rows: rows('k1', 'k2', 'k3') }] });
    await carry(db, A, B);
    await stageLinkCarries(db, { townId: town });
  }
  return linked;
}

test('confirm records the decision once, is idempotent, and rejects a changed replay', { skip: !url }, async () => {
  const db = await h.connect(url);
  try {
    await setup(db);
    const b = await biz(db, scanA, 1);
    const decisionId = randomUUID();
    const first = await decide(db, { decisionId, action: 'confirm', businessId: b });
    assert.deepEqual([first.replayed, first.restoredLinks], [false, 0]);
    assert.equal((await f.assertions(db, A))[0].confidence, 'confirmed');
    const again = await decide(db, { decisionId, action: 'confirm', businessId: b });
    assert.equal(again.replayed, true);
    await assert.rejects(decide(db, { decisionId, action: 'confirm', businessId: b, reason: 'different' }), /decision/i);
    await assert.rejects(decide(db, { decisionId, action: 'retire', businessId: b }), /decision/i);
    const decisions = await db.query('SELECT action,"actorDomain",reason FROM directory_business_identity_decision');
    assert.deepEqual(decisions, [{ action: 'confirm', actorDomain: 'profile', reason: 'reviewed by hand' }]);
    const events = await db.query(`SELECT kind,"decisionId" FROM directory_business_event WHERE "businessId"=$1 AND kind='confirmed'`, [b]);
    assert.deepEqual(events, [{ kind: 'confirmed', decisionId }]);
    await assert.rejects(decide(db, { action: 'confirm', businessId: randomUUID() }), /decision/i);
    await assert.rejects(decide(db, { action: 'confirm', businessId: b, reason: '' }), /decision/i);
  } finally { await db.destroy(); }
});

test('confirming a carried business restores its waiting link with the reviewer as actor', { skip: !url }, async () => {
  const db = await h.connect(url);
  try {
    const req = await setup(db, { link: true, second: true });
    const b = await biz(db, scanB, 1);
    const result = await decide(db, { action: 'confirm', businessId: b });
    assert.equal(result.restoredLinks, 1);
    const ev = await db.query(`SELECT "actorId","actorDomain",action FROM directory_business_link_event WHERE "requestId"=$1 AND action='carry_restore'`, [req.requestId]);
    assert.deepEqual(ev, [{ actorId: reviewer, actorDomain: 'profile', action: 'carry_restore' }]);
    assert.deepEqual(await db.query('SELECT state FROM directory_business_link_carry'), [{ state: 'restored' }]);
  } finally { await db.destroy(); }
});

test('retire is compare-and-set and closes waiting carries; nothing un-retires', { skip: !url }, async () => {
  const db = await h.connect(url);
  try {
    await setup(db, { link: true, second: true });
    const b = await biz(db, scanB, 1);
    await decide(db, { action: 'retire', businessId: b });
    assert.equal((await state(db, b)).state, 'retired');
    assert.deepEqual(await db.query('SELECT state FROM directory_business_link_carry'), [{ state: 'closed' }]);
    await assert.rejects(decide(db, { action: 'retire', businessId: b }), /decision/i);
    await assert.rejects(decide(db, { action: 'confirm', businessId: b }), /decision/i);
    const results = await Promise.allSettled([2, 3].map(() => decide(db, { action: 'retire', businessId: undefined })));
    assert.ok(results.every((r) => r.status === 'rejected'));
    const c = await biz(db, scanB, 2);
    const race = await Promise.allSettled([decide(db, { action: 'retire', businessId: c }), decide(db, { action: 'retire', businessId: c })]);
    assert.deepEqual(race.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  } finally { await db.destroy(); }
});

test('merge joins two businesses, refuses links and self-merge, and leaves a successor', { skip: !url }, async () => {
  const db = await h.connect(url);
  try {
    await setup(db);
    const [x, y] = [await biz(db, scanA, 1), await biz(db, scanA, 2)];
    await assert.rejects(decide(db, { action: 'merge', businessId: x, otherBusinessId: x }), /decision/i);
    await decide(db, { action: 'merge', businessId: x, otherBusinessId: y });
    assert.deepEqual(await state(db, y), { state: 'merged', successorId: x });
    assert.equal((await state(db, x)).state, 'active');
    assert.equal((await db.query(`SELECT count(*)::int n FROM directory_business_event WHERE kind='merged' AND "decisionId" IS NOT NULL`))[0].n, 2);
    await assert.rejects(decide(db, { action: 'merge', businessId: x, otherBusinessId: y }), /decision/i);
    const linked = await setup(db, { link: true });
    const [p, q] = [await biz(db, scanA, 1), await biz(db, scanA, 2)];
    assert.ok(linked);
    await assert.rejects(decide(db, { action: 'merge', businessId: q, otherBusinessId: p }), /decision/i, 'the merged-away business has a link');
    await assert.rejects(decide(db, { action: 'merge', businessId: p, otherBusinessId: q }).then(() => decide(db, { action: 'merge', businessId: q, otherBusinessId: p })), /decision/i);
  } finally { await db.destroy(); }
});

test('split moves each named row to its own business and never leaves a row with two assertions', { skip: !url }, async () => {
  const db = await h.connect(url);
  try {
    await setup(db);
    const [x, y] = [await biz(db, scanA, 1), await biz(db, scanA, 2)];
    // Give x a second, superseded assertion by hand: a historic row that was folded into it.
    await db.query(`UPDATE directory_business_assertion SET "businessId"=$1,state='superseded' WHERE "businessId"=$2`, [x, y]);
    const key = (n) => ({ scanId: scanA, sourceFileRowNumber: String(n) });
    await assert.rejects(decide(db, { action: 'split', businessId: x, rows: [key(2)] }), /decision/i, 'the current row must leave too');
    await assert.rejects(decide(db, { action: 'split', businessId: x, rows: [key(1), key(1)] }), /decision/i);
    await assert.rejects(decide(db, { action: 'split', businessId: x, rows: [key(1), key(3)] }), /decision/i, 'row 3 belongs to another business');
    assert.equal((await state(db, x)).state, 'active', 'a refused split changes nothing');
    await decide(db, { action: 'split', businessId: x, rows: [key(1), key(2)] });
    const after = await db.query('SELECT "sourceFileRowNumber"::text r,"businessId",confidence,evidence FROM directory_business_assertion WHERE "scanId"=$1 AND "sourceFileRowNumber" IN (1,2) ORDER BY 1', [scanA]);
    assert.equal(new Set(after.map((r) => r.businessId)).size, 2);
    assert.ok(after.every((r) => r.businessId !== x && r.confidence === 'confirmed' && r.evidence === 'reviewer_confirmed'));
    const original = await state(db, x);
    assert.equal(original.state, 'split');
    assert.ok(after.some((r) => r.businessId === original.successorId));
    assert.equal((await db.query('SELECT count(*)::int n FROM (SELECT 1 FROM directory_business_assertion GROUP BY "scanId","sourceFileRowNumber" HAVING count(*)>1) t'))[0].n, 0);
    assert.equal((await db.query(`SELECT count(*)::int n FROM directory_business_event WHERE kind='split' AND "businessId"=$1`, [x]))[0].n, 2);
  } finally { await db.destroy(); }
});

test('split is refused while an owner link is attached', { skip: !url }, async () => {
  const db = await h.connect(url);
  try {
    await setup(db, { link: true });
    const x = await biz(db, scanA, 1);
    await assert.rejects(decide(db, { action: 'split', businessId: x, rows: [{ scanId: scanA, sourceFileRowNumber: '1' }] }), /decision/i);
    assert.equal((await state(db, x)).state, 'active');
  } finally { await db.destroy(); }
});

test('a fenced reviewer cannot decide', { skip: !url }, async () => {
  const db = await h.connect(url);
  try {
    await setup(db);
    const b = await biz(db, scanA, 1);
    const key = deletionIdentityKey('profile', reviewer);
    await db.query(`INSERT INTO account_deletion_write_fence ("key",kind,"operationId") VALUES ($1,'profile',$2)`, [key, randomUUID()]);
    try { await assert.rejects(decide(db, { action: 'retire', businessId: b }), /ACCOUNT_DELETION_FENCED/); }
    finally { await db.query('DELETE FROM account_deletion_write_fence WHERE "key"=$1', [key]); }
    assert.equal((await state(db, b)).state, 'active');
    assert.equal((await db.query('SELECT count(*)::int n FROM directory_business_identity_decision'))[0].n, 0);
  } finally { await db.destroy(); }
});
