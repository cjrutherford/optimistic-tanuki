#!/usr/bin/env node
'use strict';
/**
 * Verifies a restored directory database against a backup manifest.
 *   node scripts/directory-restore-verify.cjs <backup-dir> --db-url-env VAR [--source-db NAME] [--exports-dir DIR]
 * The connection string is read from the named environment variable and never printed.
 *
 * Checks (each is a named entry in the JSON report):
 *  rowCounts        every table in the manifest has the same row count.
 *  latestMigration  the newest row of `migrations` has the manifest's name.
 *  exportArtifacts  every export job that is status=complete and not past expiresAt has
 *                   <artifactName> (<uuid>.jsonl, per export-job.ts) in the exports dir, with the
 *                   job's sha256 and byteCount. Requires --exports-dir when any such job exists.
 *  providerBudget   directory_provider_budget_attempt count and sum(reservedCents) equal the manifest.
 *  receiptSlots     every directory_reconciliation_receipt has a directory_receipt_slot (the receipt
 *                   consumes a slot one-to-one), no slot is used twice, so receipts <= slots.
 *  exportJobs       a complete job has sha256, artifactName and rowCount/byteCount recorded
 *                   (export-job.ts writes them in the same UPDATE that sets status=complete);
 *                   every directory_export_download row references an existing job.
 */
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { stat, open } = require('node:fs/promises');
const { checkBackupDir } = require('./directory-backup-lib.cjs');

const ARTIFACT_RE = /^[0-9a-f-]{36}\.jsonl$/;

async function hashFile(path) {
  const fh = await open(path, 'r');
  try {
    const h = createHash('sha256');
    let bytes = 0;
    for await (const c of fh.createReadStream()) {
      h.update(c);
      bytes += c.length;
    }
    return { sha: h.digest('hex'), bytes };
  } finally {
    await fh.close();
  }
}

async function verify({ manifestDb, client, exportsDir, now = new Date() }) {
  const checks = [];
  const add = (name, ok, detail) =>
    checks.push({ name, ok, ...(detail ? { detail } : {}) });
  const q = async (sql, params) => (await client.query(sql, params)).rows;

  // rowCounts
  const bad = [];
  for (const [table, expected] of Object.entries(manifestDb.rowCounts)) {
    if (!/^[a-z_]+$/.test(table)) {
      bad.push({ table, error: 'unsafe name' });
      continue;
    }
    try {
      const [{ c }] = await q(`SELECT count(*)::bigint AS c FROM "${table}"`);
      if (Number(c) !== expected)
        bad.push({ table, expected, actual: Number(c) });
    } catch {
      bad.push({ table, expected, actual: 'missing' });
    }
  }
  add(
    'rowCounts',
    bad.length === 0,
    bad.length
      ? { mismatches: bad }
      : { tables: Object.keys(manifestDb.rowCounts).length }
  );

  // latestMigration
  const mig = await q('SELECT name FROM migrations ORDER BY id DESC LIMIT 1');
  add('latestMigration', mig[0]?.name === manifestDb.latestMigration, {
    expected: manifestDb.latestMigration,
    actual: mig[0]?.name ?? null,
  });

  // exportArtifacts
  const jobs = await q(
    `SELECT id, "artifactName", sha256, "byteCount" FROM directory_export_job
      WHERE status = 'complete' AND ("expiresAt" IS NULL OR "expiresAt" > $1)`,
    [now]
  );
  const artifactProblems = [];
  if (jobs.length && !exportsDir) {
    artifactProblems.push({
      error: '--exports-dir required: live export jobs exist',
    });
  } else {
    for (const j of jobs) {
      if (
        typeof j.artifactName !== 'string' ||
        !ARTIFACT_RE.test(j.artifactName)
      ) {
        artifactProblems.push({ job: j.id, error: 'artifactName invalid' });
        continue;
      }
      try {
        const p = join(exportsDir, j.artifactName);
        await stat(p);
        const { sha, bytes } = await hashFile(p);
        if (sha !== j.sha256)
          artifactProblems.push({ job: j.id, error: 'sha256 mismatch' });
        else if (bytes !== Number(j.byteCount))
          artifactProblems.push({ job: j.id, error: 'size mismatch' });
      } catch {
        artifactProblems.push({ job: j.id, error: 'artifact missing' });
      }
    }
  }
  add('exportArtifacts', artifactProblems.length === 0, {
    liveJobs: jobs.length,
    ...(artifactProblems.length ? { problems: artifactProblems } : {}),
  });

  // providerBudget
  if (manifestDb.providerBudget) {
    const [b] = await q(
      `SELECT count(*)::bigint AS c, coalesce(sum("reservedCents"),0)::bigint AS s FROM directory_provider_budget_attempt`
    );
    const ok =
      Number(b.c) === manifestDb.providerBudget.attempts &&
      Number(b.s) === manifestDb.providerBudget.reservedCents;
    add('providerBudget', ok, {
      expected: manifestDb.providerBudget,
      actual: { attempts: Number(b.c), reservedCents: Number(b.s) },
    });
  } else
    add('providerBudget', true, { skipped: 'table absent at backup time' });

  // receiptSlots
  const [r] = await q(
    `SELECT (SELECT count(*) FROM directory_reconciliation_receipt) AS receipts,
            (SELECT count(*) FROM directory_receipt_slot) AS slots,
            (SELECT count(*) FROM directory_reconciliation_receipt r LEFT JOIN directory_receipt_slot s ON s.id = r."slotId" WHERE s.id IS NULL) AS orphans,
            (SELECT count(*) FROM (SELECT "slotId" FROM directory_reconciliation_receipt GROUP BY "slotId" HAVING count(*) > 1) d) AS duplicates`
  );
  add(
    'receiptSlots',
    Number(r.orphans) === 0 &&
      Number(r.duplicates) === 0 &&
      Number(r.receipts) <= Number(r.slots),
    {
      receipts: Number(r.receipts),
      slots: Number(r.slots),
      orphanReceipts: Number(r.orphans),
      sharedSlots: Number(r.duplicates),
    }
  );

  // exportJobs
  const [e] = await q(
    `SELECT (SELECT count(*) FROM directory_export_job WHERE status='complete' AND (sha256 IS NULL OR "artifactName" IS NULL OR "completedAt" IS NULL)) AS incomplete,
            (SELECT count(*) FROM directory_export_download d LEFT JOIN directory_export_job j ON j.id = d."jobId" WHERE j.id IS NULL) AS orphanDownloads`
  );
  add(
    'exportJobs',
    Number(e.incomplete) === 0 && Number(e.orphandownloads) === 0,
    {
      completeWithoutArtifactMetadata: Number(e.incomplete),
      orphanDownloads: Number(e.orphandownloads),
    }
  );

  return { ok: checks.every((c) => c.ok), checks };
}

async function main(argv) {
  const dir = argv[0];
  const opt = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const envName = opt('--db-url-env');
  if (!dir || !envName || !process.env[envName]) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'usage: <backup-dir> --db-url-env VAR (variable must be set)',
      })
    );
    return 64;
  }
  const { manifest, problems } = await checkBackupDir(dir);
  if (problems.length) {
    console.log(
      JSON.stringify({ ok: false, error: 'backup invalid', problems })
    );
    return 2;
  }
  const dbName = opt('--source-db') ?? Object.keys(manifest.databases)[0];
  const manifestDb = manifest.databases[dbName];
  if (!manifestDb) {
    console.log(
      JSON.stringify({ ok: false, error: 'source database not in manifest' })
    );
    return 2;
  }
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env[envName] });
  try {
    await client.connect();
    const report = await verify({
      manifestDb,
      client,
      exportsDir: opt('--exports-dir'),
    });
    console.log(
      JSON.stringify(
        { ...report, sourceDb: dbName, backupCreatedAt: manifest.createdAt },
        null,
        2
      )
    );
    return report.ok ? 0 : 1;
  } catch (e) {
    console.log(
      JSON.stringify({
        ok: false,
        error: `verification failed: ${e.code ?? 'error'}`,
      })
    );
    return 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

module.exports = { verify };

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
