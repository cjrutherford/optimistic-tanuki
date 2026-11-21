const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { DataSource } = require('typeorm');
const {
  beginRecovery: beginSocial,
  enableRegisterCapture,
} = require('../../social/src/app/services/community-directory-epoch');
const {
  initializeDirectoryRegister,
} = require('../../social/src/app/services/community-directory-register-initialize');
const {
  scanDirectoryRegisterV2,
  readDirectoryRegisterSnapshotV2,
  readCurrentDirectoryRegister,
} = require('../../social/src/app/services/community-directory-register-read');
const {
  beginRegisterRecovery,
  advanceRegisterRecovery,
} = require('../src/register-recovery-authority');
const {
  registerBootstrapPage,
} = require('../../directory-worker/src/register-bootstrap');

const enabled = process.env.S3_RESTORE_DRILL === 'disposable';
function checkedUrl(value, template) {
  const url = new URL(value);
  assert.equal(url.protocol, 'postgres:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, `/${template}`);
  return url;
}
function urlFor(base, name) {
  const result = new URL(base);
  result.pathname = `/${name}`;
  return result.toString();
}
function tool(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 100000,
  });
  if (result.status !== 0)
    throw new Error(
      `${command} failed: ${(
        result.stderr ||
        result.error?.message ||
        ''
      ).slice(0, 1000)}`
    );
}

test(
  'two independent restored stores require new authority and rebaseline',
  { skip: !enabled, timeout: 90000 },
  async () => {
    const bases = [
      checkedUrl(process.env.S3_REGISTER_SOCIAL_URL, 's3social'),
      checkedUrl(process.env.S3_REGISTER_DIRECTORY_URL, 'directorybootstrap'),
    ];
    assert.notEqual(bases[0].port, bases[1].port);
    const suffix = randomUUID().replace(/-/g, '').slice(0, 16);
    const names = [
      `s3drill_s_${suffix}`,
      `s3drill_d_${suffix}`,
      `s3drill_sr_${suffix}`,
      `s3drill_dr_${suffix}`,
    ];
    const temp = mkdtempSync(join(tmpdir(), 's3-restore-drill-'));
    const admins = bases.map(
      (base) =>
        new DataSource({ type: 'postgres', url: urlFor(base, 'postgres') })
    );
    const owned = [];
    const connections = [];
    const oldMode = process.env.SOCIAL_DIRECTORY_MODE;
    try {
      for (const admin of admins) await admin.initialize();
      for (let i = 0; i < 2; i++) {
        const template = bases[i].pathname.slice(1);
        assert.equal(
          (
            await admins[i].query(
              'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',
              [template]
            )
          )[0].n,
          0,
          'template must be idle'
        );
        const templateDb = new DataSource({
          type: 'postgres',
          url: bases[i].toString(),
        });
        await templateDb.initialize();
        try {
          const tables =
            i === 0
              ? [
                  'community',
                  'community_directory_epoch',
                  'community_directory_register',
                  'community_directory_change',
                ]
              : [
                  'directory_town',
                  'directory_provider_work',
                  'directory_census_progress',
                  'directory_installation',
                ];
          for (const table of tables)
            assert.equal(
              (
                await templateDb.query(
                  `SELECT count(*)::int AS n FROM "${table}"`
                )
              )[0].n,
              0,
              `${table} template must be empty`
            );
        } finally {
          await templateDb.destroy();
        }
        await admins[i].query(
          `CREATE DATABASE "${names[i]}" TEMPLATE "${template}"`
        );
        owned.push([i, names[i]]);
        await admins[i].query(`CREATE DATABASE "${names[i + 2]}"`);
        owned.push([i, names[i + 2]]);
      }
      const connect = async (i, name) => {
        const db = new DataSource({
          type: 'postgres',
          url: urlFor(bases[i], name),
        });
        await db.initialize();
        connections.push(db);
        return db;
      };
      let social = await connect(0, names[0]),
        directory = await connect(1, names[1]);
      const kept = randomUUID(),
        lost = randomUUID();
      await social.query(
        `INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,'Before backup','owner','owner','local-hub','town',false)`,
        [kept]
      );
      await beginSocial(social);
      await initializeDirectoryRegister(social, true);
      await enableRegisterCapture(social, true);
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';
      const [oldSource] = await social.query(
        'SELECT "sourceEpoch","activationId","socialGeneration" FROM community_directory_epoch WHERE id=1'
      );
      const oldIdentity = await beginRegisterRecovery(directory, {
        ...oldSource,
        owner: randomUUID(),
        expectedPrevious: null,
        externalFence: true,
      });
      await directory.query(
        `INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus") VALUES ($1,'stale',true,'ready')`,
        [kept]
      );
      // No worker or writer processes are started: the test simulates an external stop/drain.
      for (let i = 0; i < 2; i++)
        tool('pg_dump', [
          '--format=custom',
          '--file',
          join(temp, `${i}.dump`),
          urlFor(bases[i], names[i]),
        ]);
      await social.query(
        `INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,'After backup','owner','owner','local-hub','town',false)`,
        [lost]
      );
      await directory.query(
        `UPDATE directory_town SET name='After backup' WHERE "communityId"=$1`,
        [kept]
      );
      await social.destroy();
      await directory.destroy();
      for (let i = 0; i < 2; i++)
        tool('pg_restore', [
          '--exit-on-error',
          '--no-owner',
          '--dbname',
          urlFor(bases[i], names[i + 2]),
          join(temp, `${i}.dump`),
        ]);
      social = await connect(0, names[2]);
      directory = await connect(1, names[3]);
      assert.equal(
        (await social.query('SELECT 1 FROM community WHERE id=$1', [lost]))
          .length,
        0,
        'post-backup Social write is lost'
      );
      assert.equal(
        (
          await directory.query(
            'SELECT name FROM directory_town WHERE "communityId"=$1',
            [kept]
          )
        )[0].name,
        'stale',
        'post-backup Directory write is lost'
      );
      await beginSocial(social);
      await initializeDirectoryRegister(social, true);
      await enableRegisterCapture(social, true);
      const [source] = await social.query(
        'SELECT "sourceEpoch","activationId","socialGeneration" FROM community_directory_epoch WHERE id=1'
      );
      assert.notEqual(source.sourceEpoch, oldSource.sourceEpoch);
      assert.notEqual(source.activationId, oldSource.activationId);
      const identity = await beginRegisterRecovery(directory, {
        ...source,
        owner: randomUUID(),
        expectedPrevious: oldIdentity,
        externalFence: true,
      });
      assert.notEqual(identity.recoveryEpoch, oldIdentity.recoveryEpoch);
      await assert.rejects(
        advanceRegisterRecovery(
          directory,
          oldIdentity,
          { phase: 'blocked', cursor: null },
          { phase: 'reg-source', cursor: null }
        ),
        /authority mismatch/
      );
      await assert.rejects(
        social.transaction((m) =>
          scanDirectoryRegisterV2(m, oldSource, null, 10)
        ),
        /epoch|authority|incarnation/i
      );
      const adapter = {
        scan: (_i, cursor, limit) =>
          social.transaction((m) =>
            scanDirectoryRegisterV2(m, source, cursor, limit)
          ),
        read: (_i, id, token) =>
          social.transaction((m) =>
            readDirectoryRegisterSnapshotV2(m, source, id, token)
          ),
        current: (_i, id) =>
          social.transaction((m) =>
            readCurrentDirectoryRegister(m, source, id)
          ),
      };
      await assert.rejects(
        registerBootstrapPage(directory, oldIdentity, adapter, 10),
        /authority unavailable/
      );
      let state = 'more';
      for (let i = 0; i < 10 && state === 'more'; i++)
        state = await registerBootstrapPage(directory, identity, adapter, 10);
      assert.equal(state, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT name,eligible FROM directory_town WHERE "communityId"=$1',
          [kept]
        ),
        [{ name: 'Before backup', eligible: true }]
      );
      assert.equal(
        (
          await directory.query(
            'SELECT 1 FROM directory_town WHERE "communityId"=$1',
            [lost]
          )
        ).length,
        0
      );
    } finally {
      process.env.SOCIAL_DIRECTORY_MODE = oldMode;
      if (oldMode === undefined) delete process.env.SOCIAL_DIRECTORY_MODE;
      for (const db of connections) if (db.isInitialized) await db.destroy();
      for (const [i, name] of owned.reverse())
        await admins[i].query(`DROP DATABASE "${name}"`);
      for (const admin of admins)
        if (admin.isInitialized) await admin.destroy();
      rmSync(temp, { recursive: true, force: true });
    }
  }
);
