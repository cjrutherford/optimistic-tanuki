// DIRECTORY_TEST_DATABASE_URL must point to a migrated, idle disposable template.
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

async function main() {
  const files = readdirSync('apps/directory/test')
    .filter((name) => name.endsWith('.test.js'))
    .sort();
  const source = process.env.DIRECTORY_TEST_DATABASE_URL;
  if (!source) {
    const run = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        '--test',
        ...files.map((f) => `apps/directory/test/${f}`),
      ],
      { stdio: 'inherit' }
    );
    process.exitCode = run.status ?? 1;
    return;
  }
  const template = new URL(source);
  const templateName = decodeURIComponent(template.pathname.slice(1));
  if (!templateName || templateName === 'postgres')
    throw new Error(
      'Use a dedicated migrated test template database, not postgres'
    );
  const adminUrl = new URL(source);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const quote = (name) => `"${name.replace(/"/g, '""')}"`;
  try {
    for (const file of files) {
      const name = `directory_test_${randomUUID().replace(/-/g, '')}`;
      let created = false;
      try {
        await admin.query(
          `CREATE DATABASE ${quote(name)} TEMPLATE ${quote(templateName)}`
        );
        created = true;
        const isolated = new URL(source);
        isolated.pathname = `/${name}`;
        const clone = new Client({ connectionString: isolated.toString() });
        await clone.connect();
        try {
          const {
            rows: [{ n }],
          } = await clone.query(
            'SELECT count(*)::int AS n FROM directory_reconciliation_receipt'
          );
          if (n) throw new Error('Test template must contain no receipts');
          await clone.query('DELETE FROM directory_receipt_slot');
        } finally {
          await clone.end();
        }
        const env = {
          ...process.env,
          DIRECTORY_TEST_DATABASE_URL: isolated.toString(),
        };
        for (const key of [
          'DIRECTORY_RECOVERY_TEST_DATABASE_URL',
          'DIRECTORY_MIGRATION_TEST_DATABASE_URL',
        ]) {
          if (env[key] === source) env[key] = isolated.toString();
        }
        const run = spawnSync(
          process.execPath,
          [
            '-r',
            'ts-node/register/transpile-only',
            '--test',
            `apps/directory/test/${file}`,
          ],
          { stdio: 'inherit', env }
        );
        if (run.status !== 0) process.exitCode = 1;
      } finally {
        if (created)
          await admin.query(`DROP DATABASE ${quote(name)} WITH (FORCE)`);
      }
    }
  } finally {
    await admin.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
