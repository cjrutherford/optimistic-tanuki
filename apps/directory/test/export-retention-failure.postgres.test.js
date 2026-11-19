require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  chmodSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const { runExportPass } = require('../src/export-job');
const { collectOpsMetrics } = require('../src/ops-metrics');

const ALL = [
  'name',
  'basic_category',
  'primary',
  'hierarchy',
  'geometry',
  'address',
  'phone',
  'website',
];
const url = process.env.DIRECTORY_TEST_DATABASE_URL;
// A root process ignores directory permissions, so the failure cannot be produced.
const canFail = typeof process.getuid === 'function' && process.getuid() !== 0;

test(
  'retention sweep: a file that cannot be deleted keeps its name, does not starve jobs, is reported, and is retried',
  { skip: !url || !canFail },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const dir = mkdtempSync(join(tmpdir(), 'retention-failure-'));
    const insert = (id, status, artifactName, expiresAt) =>
      ds.query(
        `INSERT INTO directory_export_job (id,"releaseId","requestHash",status,"artifactName","expiresAt") VALUES ($1,'rel-x',$2,$3,$4,$5)`,
        [id, id, status, artifactName, expiresAt]
      );
    const row = async (id) =>
      (
        await ds.query(
          'SELECT status,"artifactName","errorCode" FROM directory_export_job WHERE id=$1',
          [id]
        )
      )[0];
    const due = randomUUID(),
      kept = randomUUID(),
      orphan = randomUUID(),
      queued = randomUUID();
    const file = (id) => join(dir, `${id}.jsonl`);
    try {
      await ds.query('TRUNCATE directory_export_job CASCADE');
      const past = new Date(Date.now() - 60_000);
      const future = new Date(Date.now() + 3_600_000);
      await insert(due, 'complete', `${due}.jsonl`, past);
      await insert(kept, 'complete', `${kept}.jsonl`, future);
      // An earlier sweep cleared the name without the file going.
      await insert(orphan, 'expired', null, past);
      await insert(queued, 'queued', null, null);
      for (const id of [due, kept, orphan]) writeFileSync(file(id), 'data\n');
      const options = {
        dir,
        policyFor: (releaseId) => ({
          releaseId,
          operations: { export: true },
          terms: [
            {
              dataset: 'meta',
              license: 'CDLA',
              permissions: { export: ALL },
            },
          ],
        }),
      };

      // The directory is read-only: nothing can be deleted.
      chmodSync(dir, 0o555);
      await assert.rejects(
        runExportPass(ds, options),
        /could not delete 2 artifact file/
      );
      chmodSync(dir, 0o755);
      // Fail safe: the due job is expired but still names its file; the unexpired job and its file are untouched.
      assert.deepEqual(
        { ...(await row(due)) },
        { status: 'expired', artifactName: `${due}.jsonl`, errorCode: null }
      );
      assert.equal((await row(kept)).status, 'complete');
      assert.ok(existsSync(file(due)) && existsSync(file(kept)));
      assert.ok(existsSync(file(orphan)));
      // Other work was not starved by the failed sweep (the queued job was claimed and run, and recorded its own outcome).
      assert.ok((await row(queued)).errorCode);
      // Visible: the metric counts the artifact whose file is still there.
      const m = await collectOpsMetrics(ds, {});
      assert.equal(m.exportRetention.pendingDeletion, 1);

      // The cause is removed: the next pass deletes both files and clears the name.
      await runExportPass(ds, options);
      assert.ok(!existsSync(file(due)) && !existsSync(file(orphan)));
      assert.equal((await row(due)).artifactName, null);
      assert.ok(existsSync(file(kept)));
      assert.equal((await row(kept)).artifactName, `${kept}.jsonl`);
      const after = await collectOpsMetrics(ds, {});
      assert.equal(after.exportRetention.pendingDeletion, 0);
    } finally {
      chmodSync(dir, 0o755);
      rmSync(dir, { recursive: true, force: true });
      await ds.destroy();
    }
  }
);
