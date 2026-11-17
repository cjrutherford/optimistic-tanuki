const { test } = require('node:test');
const assert = require('node:assert/strict');
const f = require('./reviewed-binding-fixtures');
const { revalidateBinding, sweepBindings, confirmBinding, invalidateForStage } = require('../src/reviewed-binding-revalidate');
const { stageContentHash } = require('../src/reviewed-binding');

const enabled = Boolean(f.connectionUrls());
const opts = { apply: true, stageInstallationId: 'stage-a', runId: 'test-run' };
const DAY = 86_400_000;

async function withWorld(run) {
  const world = await f.connect();
  try {
    await f.reset(world.live, world.stage);
    return await run(world);
  } finally {
    await world.close();
  }
}

// Each row of the signal table in S5-item4-source-binding-design.md 2.2.
const retireCases = [
  ['stage scan revocation', 'stage_scan_revoked', (w) => w.stage.query('INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)', [f.stageScan])],
  ['stage row revocation', 'stage_row_revoked', (w) => w.stage.query('INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,1)', [f.stageScan])],
  ['stage policy revoked', 'stage_policy_revoked', (w) => w.stage.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1', [f.stagePolicy])],
  ['live row withdrawn', 'live_row_withdrawn', (w) => w.live.query('DELETE FROM directory_overture_private_row WHERE "scanId"=$1', [f.liveScan])],
];

for (const state of ['pending', 'active']) {
  for (const [name, cause, mutate] of retireCases) {
    test(`${name} retires a ${state} binding, strips reviewed and resets the candidate`, { skip: !enabled }, () => withWorld(async (w) => {
      const seeded = await f.seedRow(w.live, w.stage, 1, { state, until: state === 'active' ? new Date(Date.now() + DAY) : null });
      await mutate(w);
      const result = await revalidateBinding(w.live, w.stage, f.key, seeded.bindingId, opts);
      assert.deepEqual([result.outcome, result.cause], ['retired', cause]);
      const row = await f.bindingState(w.live, seeded.bindingId);
      assert.deepEqual([row.state, row.stateCause], ['retired', cause]);
      assert.deepEqual((await f.events(w.live, seeded.bindingId)).map((e) => `${e.kind}:${e.cause}`), [`retired:${cause}`]);
      if (cause !== 'live_row_withdrawn') assert.equal(await f.liveReviewed(w.live, 1), false);
      const [candidate] = await w.live.query('SELECT status FROM directory_address_review_candidate WHERE id=$1', [seeded.candidateId]);
      assert.equal(candidate.status, 'revoked');
      const decisions = await w.live.query(`SELECT "actorKind","actorId",decision,reason FROM directory_address_review_decision WHERE "candidateId"=$1 AND "actorKind"='auto' AND decision='revoke'`, [seeded.candidateId]);
      assert.equal(decisions.length, 1);
      assert.equal(decisions[0].actorId, null);
      assert.equal(decisions[0].reason, cause);
    }));
  }
}

test('a missing stage row suspends and keeps reviewed fields for re-review', { skip: !enabled }, () => withWorld(async (w) => {
  const seeded = await f.seedRow(w.live, w.stage, 1, { state: 'active', until: new Date(Date.now() + DAY) });
  await w.stage.query('DELETE FROM directory_overture_private_row');
  const result = await revalidateBinding(w.live, w.stage, f.key, seeded.bindingId, opts);
  assert.deepEqual([result.outcome, result.cause], ['suspended', 'stage_row_missing']);
  assert.equal((await f.bindingState(w.live, seeded.bindingId)).state, 'suspended');
  assert.equal(await f.liveReviewed(w.live, 1), true);
}));

test('changed stage content suspends and is never copied over', { skip: !enabled }, () => withWorld(async (w) => {
  const seeded = await f.seedRow(w.live, w.stage, 1, { state: 'active', until: new Date(Date.now() + DAY) });
  await w.stage.query(`UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{addresses,0,freeform}','"9 New Rd"')`);
  const result = await revalidateBinding(w.live, w.stage, f.key, seeded.bindingId, opts);
  assert.deepEqual([result.outcome, result.cause], ['suspended', 'stage_content_changed']);
  const [live] = await w.live.query(`SELECT listing->'reviewed'->>'address' AS address FROM directory_overture_private_row`);
  assert.equal(live.address, '1 Main St');
  const [event] = await w.live.query('SELECT "observedStageHash" FROM directory_reviewed_binding_event WHERE "bindingId"=$1 AND kind=\'suspended\'', [seeded.bindingId]);
  assert.match(event.observedStageHash, /^[a-f0-9]{64}$/);
}));

async function newerScan(w) {
  await w.stage.query('INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING', [f.otherStageScan]);
  await w.stage.query('INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2) ON CONFLICT DO NOTHING', [f.otherStageScan, f.stagePolicy]);
  await w.stage.query('INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1) ON CONFLICT DO NOTHING', [f.otherStageScan]);
}

test('a newer stage scan with different content suspends; identical content stays active', { skip: !enabled }, () => withWorld(async (w) => {
  const different = await f.seedRow(w.live, w.stage, 1, { state: 'active', until: new Date(Date.now() + DAY) });
  await w.stage.query('DELETE FROM directory_overture_private_row');
  await newerScan(w);
  await w.stage.query('INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)', [f.otherStageScan, f.town, JSON.stringify(f.stageListing(1, { phones: ['+19125550199'] }))]);
  const result = await revalidateBinding(w.live, w.stage, f.key, different.bindingId, opts);
  assert.deepEqual([result.outcome, result.cause], ['suspended', 'stage_superseded']);

  await f.reset(w.live, w.stage);
  const same = await f.seedRow(w.live, w.stage, 1, { state: 'active', until: new Date(Date.now() + DAY) });
  await w.stage.query('DELETE FROM directory_overture_private_row');
  await newerScan(w);
  await w.stage.query('INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)', [f.otherStageScan, f.town, JSON.stringify(f.stageListing(1))]);
  const kept = await revalidateBinding(w.live, w.stage, f.key, same.bindingId, opts);
  assert.equal(kept.outcome, 'extended');
  assert.equal((await f.bindingState(w.live, same.bindingId)).state, 'active');
  assert.equal((await f.events(w.live, same.bindingId)).length, 0);
}));

test('drift in the live reviewed fields suspends', { skip: !enabled }, () => withWorld(async (w) => {
  const seeded = await f.seedRow(w.live, w.stage, 1, { state: 'active', until: new Date(Date.now() + DAY) });
  await w.live.query(`UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{reviewed,phone}','"+10000000000"')`);
  const result = await revalidateBinding(w.live, w.stage, f.key, seeded.bindingId, opts);
  assert.deepEqual([result.outcome, result.cause], ['suspended', 'live_reviewed_drift']);
}));

test('a passing check confirms a pending binding with a lease and extends an active one', { skip: !enabled }, () => withWorld(async (w) => {
  const seeded = await f.seedRow(w.live, w.stage, 1);
  const before = Date.now();
  const confirmed = await confirmBinding(w.live, w.stage, f.key, seeded.bindingId, { stageInstallationId: 'stage-a', leaseMs: 1_000_000 });
  assert.equal(confirmed.outcome, 'confirmed');
  const row = await f.bindingState(w.live, seeded.bindingId);
  assert.equal(row.state, 'active');
  assert.ok(new Date(row.verifiedUntil).getTime() >= before + 1_000_000 && new Date(row.verifiedUntil).getTime() <= Date.now() + 1_000_000);
  assert.deepEqual((await f.events(w.live, seeded.bindingId)).map((e) => e.kind), ['confirmed']);
  const again = await revalidateBinding(w.live, w.stage, f.key, seeded.bindingId, { ...opts, leaseMs: 5_000_000 });
  assert.equal(again.outcome, 'extended');
  const longer = await f.bindingState(w.live, seeded.bindingId);
  assert.ok(new Date(longer.verifiedUntil).getTime() > new Date(row.verifiedUntil).getTime());
  assert.equal((await f.events(w.live, seeded.bindingId)).length, 1);
}));

test('an unreachable stage changes nothing and does not extend the lease', { skip: !enabled }, () => withWorld(async (w) => {
  const until = new Date(Date.now() + 3_600_000);
  const seeded = await f.seedRow(w.live, w.stage, 1, { state: 'active', until });
  const down = { query: async () => { throw Error('stage down'); } };
  const result = await revalidateBinding(w.live, down, f.key, seeded.bindingId, opts);
  assert.equal(result.outcome, 'unreachable');
  const row = await f.bindingState(w.live, seeded.bindingId);
  assert.equal(row.state, 'active');
  assert.equal(new Date(row.verifiedUntil).getTime(), until.getTime());
  assert.equal((await f.events(w.live, seeded.bindingId)).length, 0);
  const summary = await sweepBindings(w.live, down, f.key, opts);
  assert.equal(summary.counts.unreachable, 1);
  // A binding recorded against another stage is not evaluated either.
  const other = await revalidateBinding(w.live, w.stage, f.key, seeded.bindingId, { ...opts, stageInstallationId: 'stage-b' });
  assert.equal(other.outcome, 'unreachable');
}));

test('a sweep run twice produces one event', { skip: !enabled }, () => withWorld(async (w) => {
  const seeded = await f.seedRow(w.live, w.stage, 1, { state: 'active', until: new Date(Date.now() + DAY) });
  await w.stage.query('UPDATE directory_overture_private_policy SET revoked=true');
  const first = await sweepBindings(w.live, w.stage, f.key, opts);
  const second = await sweepBindings(w.live, w.stage, f.key, opts);
  assert.equal(first.counts.retired, 1);
  assert.equal(second.examined, 0);
  assert.equal((await f.events(w.live, seeded.bindingId)).length, 1);
  const suspended = await f.seedRow(w.live, w.stage, 2, { state: 'active', until: new Date(Date.now() + DAY), stageRow: false });
  await w.stage.query('UPDATE directory_overture_private_policy SET revoked=false');
  await sweepBindings(w.live, w.stage, f.key, opts);
  await sweepBindings(w.live, w.stage, f.key, opts);
  assert.deepEqual((await f.events(w.live, suspended.bindingId)).map((e) => `${e.kind}:${e.cause}`), ['suspended:stage_row_missing']);
}));

test('a dry run reports but writes nothing', { skip: !enabled }, () => withWorld(async (w) => {
  const seeded = await f.seedRow(w.live, w.stage, 1, { state: 'active', until: new Date(Date.now() + DAY) });
  await w.stage.query('INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)', [f.stageScan]);
  const summary = await sweepBindings(w.live, w.stage, f.key, { ...opts, apply: false });
  assert.equal(summary.counts.retired, 1);
  assert.equal((await f.bindingState(w.live, seeded.bindingId)).state, 'active');
  assert.equal(await f.liveReviewed(w.live, 1), true);
  assert.equal((await f.events(w.live, seeded.bindingId)).length, 0);
}));

test('suspension expires into retirement, legacy rows included; source_file never activates', { skip: !enabled }, () => withWorld(async (w) => {
  const old = new Date(Date.now() - 31 * DAY);
  const stale = await f.seedRow(w.live, w.stage, 1, { state: 'suspended', suspendedAt: old });
  const legacy = await f.seedRow(w.live, w.stage, 2, { state: 'suspended', provenance: 'unknown_legacy', suspendedAt: old, stageRow: false });
  const recent = await f.seedRow(w.live, w.stage, 3, { state: 'suspended', suspendedAt: new Date() });
  const file = await f.seedRow(w.live, w.stage, 4, { state: 'pending', provenance: 'source_file', stageRow: false });
  await sweepBindings(w.live, w.stage, f.key, opts);
  assert.equal((await f.bindingState(w.live, stale.bindingId)).stateCause, 'suspension_expired');
  assert.equal((await f.bindingState(w.live, legacy.bindingId)).state, 'retired');
  assert.equal(await f.liveReviewed(w.live, 2), false);
  assert.equal((await f.bindingState(w.live, recent.bindingId)).state, 'suspended');
  assert.equal((await f.bindingState(w.live, file.bindingId)).state, 'pending');
}));

test('invalidateForStage retires the bindings a stage withdrawal touches', { skip: !enabled }, () => withWorld(async (w) => {
  const a = await f.seedRow(w.live, w.stage, 1, { state: 'active', until: new Date(Date.now() + DAY) });
  await w.stage.query('INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,1)', [f.stageScan]);
  const summary = await invalidateForStage(w.live, w.stage, f.key, { scanId: f.stageScan, sourceFileRowNumber: '1' }, { stageInstallationId: 'stage-a' });
  assert.equal(summary.counts.retired, 1);
  assert.equal((await f.bindingState(w.live, a.bindingId)).state, 'retired');
  assert.equal(stageContentHash(f.key, f.stageListing(1)).length, 64);
}));
