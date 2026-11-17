const test = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { readDirectoryRegisterSnapshot } = require('../../social/src/app/services/community-directory-register-read');
const { reconcileRegisterV2 } = require('../src/register-reconciliation-v2');

const enabled = process.env.S3_CONCURRENCY_PROOF === 'disposable';
const socialUrl = process.env.S3_CONCURRENCY_SOCIAL_URL;
const directoryUrl = process.env.S3_CONCURRENCY_DIRECTORY_URL;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function checkedUrl(value, database) {
  assert.ok(value, `S3_CONCURRENCY_*_URL must explicitly name ${database}`);
  const url = new URL(value);
  assert.equal(url.protocol, 'postgres:');
  assert.equal(url.hostname, '127.0.0.1', 'proof databases must be loopback-only');
  assert.equal(url.pathname, `/${database}`);
  return url;
}

async function waitForLock(directory, applicationName, deadline) {
  while (Date.now() < deadline) {
    const rows = await directory.query(`SELECT wait_event_type, wait_event FROM pg_stat_activity
      WHERE application_name=$1 AND state='active'`, [applicationName]);
    if (rows.some(row => row.wait_event_type === 'Lock')) return;
    await pause(50);
  }
  assert.fail('second reconciliation was not observed waiting on a PostgreSQL lock');
}

test('concurrent register reconciliation serializes by community and remains idempotent', { skip: !enabled, timeout: 30000 }, async () => {
  checkedUrl(socialUrl, 's3social');
  checkedUrl(directoryUrl, 'directorybootstrap');
  assert.notEqual(socialUrl, directoryUrl);

  const applicationName = `s3-concurrency-${process.pid}`;
  const social = new DataSource({ type: 'postgres', url: socialUrl, extra: { application_name: applicationName } });
  const directory = new DataSource({ type: 'postgres', url: directoryUrl, extra: { application_name: applicationName } });
  let socialInitialized = false, directoryInitialized = false;
  let releaseGate;
  const gate = new Promise(resolve => { releaseGate = resolve; });
  try {
    await social.initialize(); socialInitialized = true;
    await directory.initialize(); directoryInitialized = true;
    const authorityRows = await directory.query(`SELECT p."sourceEpoch",p."recoveryEpoch",p.owner,p."activationId",p."socialGeneration",p."directoryGeneration",p.phase,p.protocol,i."recoveryEpoch" AS "authorityEpoch"
      FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery'`);
    assert.equal(authorityRows.length, 1, 'current Directory recovery identity must exist');
    const authority = authorityRows[0];
    assert.equal(authority.protocol, 'register-pending-v1');
    assert.equal(authority.phase, 'reg-running');
    assert.equal(authority.recoveryEpoch, authority.authorityEpoch);
    const identity = {
      sourceEpoch: authority.sourceEpoch, recoveryEpoch: authority.recoveryEpoch, owner: authority.owner,
      activationId: authority.activationId, socialGeneration: authority.socialGeneration,
      directoryGeneration: authority.directoryGeneration
    };

    const candidates = await social.query(`SELECT r."communityId",r."changeToken" FROM community_directory_register r
      JOIN community c ON c.id=r."communityId" WHERE r."changeToken" IS NOT NULL
      AND r.dirty IS TRUE AND r.operation='changed' AND c."appScope"='local-hub' AND c."localityType" IN ('city','town')
      AND c."isPrivate"=false ORDER BY r."communityId" LIMIT 20`);
    assert.ok(candidates.length, 'an eligible synthetic fixture town/register token must exist');
    let selected;
    for (const candidate of candidates) {
      const exact = await social.transaction(manager => readDirectoryRegisterSnapshot(manager, identity.sourceEpoch, candidate.communityId, candidate.changeToken));
      if (exact.status === 'current' && exact.snapshot) { selected = { ...candidate, exact }; break; }
    }
    assert.ok(selected, 'a current eligible Social snapshot and token must be available');

    let markRead;
    const readReached = new Promise(resolve => { markRead = resolve; });
    const gatedRead = async () => {
      const exact = await social.transaction(manager => readDirectoryRegisterSnapshot(manager, identity.sourceEpoch, selected.communityId, selected.changeToken));
      markRead();
      await gate;
      return exact;
    };
    const first = reconcileRegisterV2(directory, identity, selected.communityId, selected.changeToken, gatedRead);
    await Promise.race([readReached, pause(10000).then(() => assert.fail('first reconciliation did not reach its exact Social read'))]);
    const second = reconcileRegisterV2(directory, identity, selected.communityId, selected.changeToken, async () =>
      social.transaction(manager => readDirectoryRegisterSnapshot(manager, identity.sourceEpoch, selected.communityId, selected.changeToken)));
    try {
      await waitForLock(directory, applicationName, Date.now() + 10000);
    } finally {
      releaseGate();
    }
    assert.deepEqual(await Promise.all([first, second]), ['applied', 'applied']);
    assert.deepEqual(await directory.query('SELECT count(*)::int AS count FROM directory_town WHERE "communityId"=$1', [selected.communityId]), [{ count: 1 }]);
    assert.deepEqual(await directory.query('SELECT count(*)::int AS count FROM directory_provider_work WHERE "communityId"=$1 AND status=\'blocked\'', [selected.communityId]), [{ count: 1 }]);
  } finally {
    releaseGate();
    if (directoryInitialized) await directory.destroy();
    if (socialInitialized) await social.destroy();
  }
});
