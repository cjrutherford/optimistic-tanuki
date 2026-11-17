// The sweep race: a binding sweep, the carry and the old policy's revocation run at once on separate connections.
// Identity never locks a binding, so this must finish, leave every binding in a legal state, and never put a
// reviewed field on a row of the new cohort.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const b = require('./reviewed-binding-fixtures');
const f = require('./business-identity-carry-fixtures');
const { sweepBindings } = require('../src/reviewed-binding-revalidate');
const { planCarry, applyCarry, carryAllowsRevoke } = require('../src/business-identity-carry');

const enabled = Boolean(b.connectionUrls());
const NEW_POLICY = f.hex('7'), NEW_SCAN = f.hex('8'), PRE = f.hex('0');
const opts = (from, to) => ({ fromPolicyId: from, toPolicyId: to, key: f.KEY });
const within = (promise, ms, label) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out (deadlock?)`)), ms))]);
const LEGAL = new Set(['pending', 'active', 'suspended', 'retired']);
const N = 6;

test('a sweep, the carry and the old policy revocation do not deadlock or expose reviewed fields', { skip: !enabled }, async () => {
  const w = await b.connect();
  const carryConn = await b.connect(), revokeConn = await b.connect(), watch = await b.connect();
  try {
    await f.clear(w.live);
    await b.reset(w.live, w.stage);
    for (let n = 1; n <= N; n += 1) await b.seedRow(w.live, w.stage, n, { state: 'active', until: new Date(Date.now() + 86_400_000) });
    // Release one: evidence and keys on the live scan, then origin businesses.
    await w.live.query(`INSERT INTO directory_overture_source_evidence ("scanId","evidenceVersion",kind,"releaseId","artifactUrl","artifactEtag","inventorySha256","evidenceSha256",recorder)
      VALUES ($1,1,'captured','2026-09-23.0','https://example.test/a','e',$2,$3,'test')`, [b.liveScan, f.hex('1'), f.hex('2')]);
    for (let n = 1; n <= N; n += 1) await w.live.query('INSERT INTO directory_overture_source_key ("scanId","sourceFileRowNumber","upstreamKeyHash","keyVersion") VALUES ($1,$2,$3,1)', [b.liveScan, n, f.hash(`k${n}`)]);
    await planCarry(w.live, opts(PRE, b.livePolicy)).then((p) => applyCarry(w.live, { ...opts(PRE, b.livePolicy), planDigest: p.digest }));
    // Release two: a new cohort with the same keys and no reviewed fields.
    await f.cohort(w.live, { policy: NEW_POLICY, town: b.town, release: '2026-10-21.0', scans: [{ scan: NEW_SCAN, rows: Array.from({ length: N }, (_, i) => ({ n: i + 1, id: `k${i + 1}` })) }] });

    const stopWatch = { v: false }, seen = { observations: 0, reviewedSeen: 0 };
    const watcher = (async () => {
      while (!stopWatch.v) {
        const rows = await watch.live.query(`SELECT 1 FROM directory_overture_private_row WHERE "scanId"=$1 AND listing ? 'reviewed'`, [NEW_SCAN]);
        seen.observations += 1; seen.reviewedSeen += rows.length;
      }
    })();

    const sweeper = (async () => { for (let i = 0; i < 8; i += 1) await sweepBindings(w.live, w.stage, b.key, { apply: true, stageInstallationId: 'stage-a', runId: `race-${i}` }); })();
    const plan = await planCarry(carryConn.live, opts(b.livePolicy, NEW_POLICY));
    const carrier = applyCarry(carryConn.live, { ...opts(b.livePolicy, NEW_POLICY), planDigest: plan.digest, batchSize: 1 });
    const revoker = (async () => {
      for (let i = 0; i < 400; i += 1) {
        if ((await carryAllowsRevoke(revokeConn.live, b.livePolicy, NEW_POLICY)).ok) {
          await revokeConn.live.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1', [b.livePolicy]);
          return true;
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      return false;
    })();
    const [, , revoked] = await within(Promise.all([sweeper, carrier, revoker]), 90000, 'sweep, carry and revoke');
    stopWatch.v = true; await watcher;

    assert.equal(revoked, true);
    assert.ok(seen.observations > 0);
    assert.equal(seen.reviewedSeen, 0);
    const states = await w.live.query('SELECT DISTINCT state FROM directory_reviewed_binding');
    assert.ok(states.every((s) => LEGAL.has(s.state)));
    assert.equal((await w.live.query(`SELECT count(*)::int n FROM directory_business_assertion WHERE "policyId"=$1 AND state='current'`, [NEW_POLICY]))[0].n, N);
  } finally {
    await w.close(); await carryConn.close(); await revokeConn.close(); await watch.close();
  }
});
