#!/usr/bin/env node
'use strict';
/**
 * Pure helpers and a small CLI shared by directory-backup.sh and directory-restore.sh.
 * Nothing here opens a database or prints connection details.
 */
const { createHash } = require('node:crypto');
const {
  createReadStream,
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
} = require('node:fs');
const { join } = require('node:path');

const TOOL_VERSION = 'directory-backup/1';
const LIVE_DATABASES = ['ot_directory', 'ot_directory_census_stage'];
const DIRECTORY_CONTAINERS = [
  'optimistic-tanuki-directory-1',
  'optimistic-tanuki-directory-worker-1',
];
const DB_NAME_RE = /^[a-z][a-z0-9_]{0,62}$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const FILE_RE = /^[A-Za-z0-9._-]+$/;

function isSafeDbName(name) {
  return typeof name === 'string' && DB_NAME_RE.test(name);
}

/** Pure restore guard. Live names need --live and every directory container stopped. */
function restoreGuard({ target, live = false, replace = false, running = [] }) {
  if (!isSafeDbName(target)) {
    return {
      ok: false,
      reason: 'target database name is not a safe identifier',
    };
  }
  if (LIVE_DATABASES.includes(target)) {
    if (!live) {
      return {
        ok: false,
        reason: `refusing to restore into live database ${target} without --live`,
      };
    }
    const up = DIRECTORY_CONTAINERS.filter((c) => running.includes(c));
    if (up.length) {
      return {
        ok: false,
        reason: `fence not in place: ${up.join(
          ', '
        )} still running; stop all directory serving and workers first`,
      };
    }
  } else if (live) {
    return {
      ok: false,
      reason: '--live only applies to the live database names',
    };
  }
  return { ok: true, reason: replace ? 'replace requested' : 'ok' };
}

function validateManifest(m) {
  const errors = [];
  const err = (e) => errors.push(e);
  if (!m || typeof m !== 'object') return ['manifest is not an object'];
  if (typeof m.createdAt !== 'string' || Number.isNaN(Date.parse(m.createdAt)))
    err('createdAt invalid');
  if (typeof m.toolVersion !== 'string' || !m.toolVersion)
    err('toolVersion missing');
  const fileOk = (o, where) => {
    if (!o || typeof o !== 'object') return err(`${where} missing`);
    if (typeof o.file !== 'string' || !FILE_RE.test(o.file))
      err(`${where}.file invalid`);
    if (!Number.isInteger(o.bytes) || o.bytes < 0)
      err(`${where}.bytes invalid`);
    if (typeof o.sha256 !== 'string' || !SHA_RE.test(o.sha256))
      err(`${where}.sha256 invalid`);
  };
  const dbs = m.databases;
  if (!dbs || typeof dbs !== 'object' || !Object.keys(dbs).length)
    err('databases missing');
  else {
    for (const [name, d] of Object.entries(dbs)) {
      if (!isSafeDbName(name)) err(`database name ${name} invalid`);
      fileOk(d, `databases.${name}`);
      if (d && typeof d.latestMigration !== 'string')
        err(`databases.${name}.latestMigration invalid`);
      const rc = d && d.rowCounts;
      if (!rc || typeof rc !== 'object')
        err(`databases.${name}.rowCounts missing`);
      else
        for (const [t, n] of Object.entries(rc)) {
          if (!Number.isInteger(n) || n < 0)
            err(`databases.${name}.rowCounts.${t} invalid`);
        }
      const pb = d && d.providerBudget;
      if (
        pb != null &&
        (!Number.isInteger(pb.attempts) || !Number.isInteger(pb.reservedCents))
      ) {
        err(`databases.${name}.providerBudget invalid`);
      }
    }
  }
  fileOk(m.exports, 'exports');
  if (
    m.exports &&
    (!Number.isInteger(m.exports.fileCount) || m.exports.fileCount < 0)
  )
    err('exports.fileCount invalid');
  return errors;
}

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path)
      .on('data', (c) => h.update(c))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

/** Recomputes every file hash and size named in the manifest. Returns a list of problems. */
async function checkBackupDir(dir) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  } catch {
    return {
      manifest: null,
      problems: ['manifest.json missing or unreadable'],
    };
  }
  const problems = validateManifest(manifest);
  if (problems.length) return { manifest, problems };
  const entries = [
    ...Object.entries(manifest.databases),
    ['exports', manifest.exports],
  ];
  for (const [label, e] of entries) {
    try {
      const st = statSync(join(dir, e.file));
      if (st.size !== e.bytes) problems.push(`${label}: size mismatch`);
      if ((await sha256File(join(dir, e.file))) !== e.sha256)
        problems.push(`${label}: sha256 mismatch`);
    } catch {
      problems.push(`${label}: file missing`);
    }
  }
  return { manifest, problems };
}

async function assemble(dir) {
  const databases = {};
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith('.info.json'))
    .sort()) {
    const name = f.replace(/\.info\.json$/, '');
    if (name === 'exports') continue;
    const info = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const file = `${name}.dump`;
    databases[name] = {
      file,
      bytes: statSync(join(dir, file)).size,
      sha256: await sha256File(join(dir, file)),
      latestMigration: info.latestMigration,
      rowCounts: info.rowCounts,
      providerBudget: info.providerBudget ?? null,
      snapshot:
        'repeatable-read exported snapshot shared by pg_dump and counts',
    };
  }
  const xi = JSON.parse(readFileSync(join(dir, 'exports.info.json'), 'utf8'));
  const manifest = {
    createdAt: new Date().toISOString(),
    toolVersion: TOOL_VERSION,
    databases,
    exports: {
      file: 'exports.tar',
      bytes: statSync(join(dir, 'exports.tar')).size,
      sha256: await sha256File(join(dir, 'exports.tar')),
      fileCount: xi.fileCount,
      volume: xi.volume,
    },
  };
  const problems = validateManifest(manifest);
  if (problems.length)
    throw new Error(`manifest invalid: ${problems.join('; ')}`);
  writeFileSync(
    join(dir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 }
  );
  return manifest;
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (k) => {
    const i = rest.indexOf(k);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (cmd === 'assemble') {
    const m = await assemble(rest[0]);
    console.log(
      JSON.stringify({
        databases: Object.keys(m.databases),
        exportsBytes: m.exports.bytes,
      })
    );
  } else if (cmd === 'check-backup') {
    const { problems } = await checkBackupDir(rest[0]);
    if (problems.length) {
      console.error(JSON.stringify({ ok: false, problems }));
      process.exit(2);
    }
    console.log(JSON.stringify({ ok: true }));
  } else if (cmd === 'manifest-file') {
    const { manifest } = await checkBackupDir(rest[0]);
    const name = opt('--db');
    console.log(
      name === 'exports'
        ? manifest.exports.file
        : manifest.databases[name]?.file ?? ''
    );
  } else if (cmd === 'guard') {
    const r = restoreGuard({
      target: opt('--target'),
      live: rest.includes('--live'),
      replace: rest.includes('--replace'),
      running: (opt('--running') || '').split(',').filter(Boolean),
    });
    if (!r.ok) {
      console.error(r.reason);
      process.exit(3);
    }
  } else {
    console.error(
      'usage: directory-backup-lib.cjs assemble|check-backup|manifest-file|guard'
    );
    process.exit(64);
  }
}

module.exports = {
  TOOL_VERSION,
  LIVE_DATABASES,
  DIRECTORY_CONTAINERS,
  isSafeDbName,
  restoreGuard,
  validateManifest,
  checkBackupDir,
  sha256File,
};

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`error: ${e.message}`);
    process.exit(1);
  });
}
