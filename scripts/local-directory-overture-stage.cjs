/** Stage an anonymous, pinned Overture release for local evaluation only. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  OverturePrivateSink,
} = require('../apps/directory/src/overture-private-sink');
const {
  OVERTURE_RIGHTS_FIELDS_LEGACY_V1,
} = require('../apps/directory/src/overture-rights');
const {
  anonymousAttemptReserver,
  newStageSigner,
  projectStagedRow,
} = require('../apps/directory/src/overture-stage-core');
const {
  StageStopped,
  ledgerSink,
  openLedger,
  parseLedgerArgs,
} = require('./local-directory-run-ledger.cjs');
const digest = (x) => crypto.createHash('sha256').update(x).digest('hex');
const geometryHash = (geometry) => `sha256:${digest(JSON.stringify(geometry))}`;
const expectedGeometry = {
  douglas:
    'sha256:eff0af2eb6ce36fa389842de6d5d679c0253d073a5af44c02d6402ee6d600c99',
  tifton:
    'sha256:ed9c1b4f11db4d9d8c65d36a785dbeb1d161f82208660e771283c6918513aa6d',
  valdosta:
    'sha256:3dc105a4006ad14b146db2122d65fe8e464388b07850be586a2f24a6708fa88e',
  waycross:
    'sha256:21646e863343da4c07f6d8e372bb7f85f88b866a359a07fd6b7e3bf71c74e588',
};
async function main() {
  // `--resume <runId>` and `--no-ledger` are the run-ledger flags (S7e); the rest is the original argument list.
  const {
    rest: args,
    resume,
    enabled: ledgerEnabled,
  } = parseLedgerArgs(process.argv.slice(2));
  if (
    process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
    args[0] !== '--stage-local' ||
    args.length > 2 ||
    (args[1] && !/^\d{5}$/.test(args[1])) ||
    (resume && args[1])
  )
    throw Error('Explicit local staging mode required');
  const stageUrl = new URL(process.env.LOCAL_STAGE_DATABASE_URL || ''),
    budgetUrl = new URL(process.env.LOCAL_DIRECTORY_DATABASE_URL || ''),
    socialUrl = new URL(process.env.LOCAL_SOCIAL_DATABASE_URL || '');
  if (
    [stageUrl, budgetUrl, socialUrl].some(
      (u) => u.hostname !== '127.0.0.1' || !u.port
    ) ||
    budgetUrl.port !== stageUrl.port ||
    stageUrl.pathname !== '/ot_directory_october_stage' ||
    budgetUrl.pathname !== '/ot_directory' ||
    socialUrl.pathname !== '/ot_social'
  )
    throw Error('Refusing non-local databases');
  const inventory = JSON.parse(
    fs.readFileSync(
      'docs/plans/town-square-directory/S4a1-overture-2026-10-21-metadata.json',
      'utf8'
    )
  );
  if (
    inventory.release !== '2026-10-21.0' ||
    digest(JSON.stringify(inventory.items)) !== inventory.inventorySha256 ||
    inventory.items.length !== 16
  )
    throw Error('Release inventory changed');
  const geo = JSON.parse(
    fs.readFileSync(
      '/home/cjrutherford/workspace/business-directory-poc/data/generated/service-regions.geojson',
      'utf8'
    )
  );
  if (geo.type !== 'FeatureCollection' || geo.features?.length !== 4)
    throw Error('POC regions unavailable');
  const social = new DataSource({ type: 'postgres', url: socialUrl.href }),
    stage = new DataSource({ type: 'postgres', url: stageUrl.href }),
    budget = new DataSource({ type: 'postgres', url: budgetUrl.href });
  await social.initialize();
  await stage.initialize();
  await budget.initialize();
  let connection;
  try {
    const regions = [];
    for (const name of Object.keys(expectedGeometry)) {
      const matches = geo.features.filter((f) => f?.properties?.id === name);
      if (
        matches.length !== 1 ||
        geometryHash(matches[0].geometry) !== expectedGeometry[name]
      )
        throw Error('POC region checksum mismatch');
      const towns = await social.query(
        `SELECT id FROM community WHERE lower(city)=$1 AND "adminArea"='GA' AND "isPrivate"=false AND "appScope"='local-hub' AND "localityType" IN ('city','town')`,
        [name]
      );
      if (towns.length !== 1) throw Error('Town unavailable or ambiguous');
      regions.push({ id: towns[0].id, geometry: matches[0].geometry });
    }
    const fields = [...OVERTURE_RIGHTS_FIELDS_LEGACY_V1],
      permissions = Object.fromEntries(
        ['ingest', 'retain', 'privateDisplay'].map((op) => [op, fields])
      );
    const rights = {
      releaseId: inventory.release,
      operations: { ingest: true, retain: true, privateDisplay: true },
      terms: ['meta', 'Microsoft', 'BrightQuery', 'DAC'].map((dataset) => ({
        dataset,
        license: 'CDLA-Permissive-2.0',
        attribution: `${dataset}; Overture Maps Foundation (October 2026)`,
        termsUrl: 'https://cdla.dev/permissive-2.0/',
        notice: 'CDLA Permissive 2.0',
        permissions,
      })),
    };
    const projectionSha256 = digest(
        fs.readFileSync('apps/directory/src/overture-local-evaluation.ts')
      ),
      classifierSha256 = projectionSha256,
      approvalSha256 = digest(
        JSON.stringify({
          rights,
          inventory: inventory.inventorySha256,
          scope: 'local-evaluation-october-v1',
        })
      );
    await budget.query(
      'INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING',
      [approvalSha256]
    );
    const { DuckDBInstance } = await import('@duckdb/node-api'),
      { extractPrivate } = await import('./overture-private-extractor.mjs');
    const duck = await DuckDBInstance.create(':memory:');
    connection = await duck.connect();
    await connection.run('LOAD spatial');
    await connection.run('LOAD httpfs');
    const signer = newStageSigner();
    const ordered = args[1]
      ? inventory.items.filter((i) => i.id === args[1])
      : [...inventory.items].sort((a, b) =>
          a.id === '00001'
            ? -1
            : b.id === '00001'
            ? 1
            : a.id.localeCompare(b.id)
        );
    if (!ordered.length) throw Error('Unknown asset');
    const ledger = await openLedger(budget, {
      enabled: ledgerEnabled,
      resume,
      kind: 'overture-stage',
      provider: 'overture',
      release: inventory.release,
      townIds: regions.map((r) => r.id),
      reason: args[1] ? `asset ${args[1]}` : 'all assets',
    });
    // Resuming runs only the units an operator re-queued, in the original order.
    const items = ledger.units
      ? ordered.filter((i) => ledger.units.includes(i.id))
      : ordered;
    let unit = null;
    try {
      for (const item of items) {
        if (await ledger.shouldStop()) throw new StageStopped();
        unit = item.id;
        await ledger.job(item.id);
        const policy = {
          authorized: true,
          inventorySha256: inventory.inventorySha256,
          itemId: item.id,
          approvalSha256,
          projectionSha256,
          classifierSha256,
          regions,
          localSnapshot: true,
          maxMemoryBytes: 2 * 1024 * 1024 * 1024,
          maxTransferBytes: 1024 * 1024 * 1024,
        };
        const reserveAttempt = anonymousAttemptReserver(budget, {
          approvalSha256,
          item,
          signer,
        });
        const project = async ({ source }) =>
          projectStagedRow({ source, releaseId: inventory.release, rights });
        const started = Date.now(),
          heartbeat = setInterval(() => {
            console.log(
              `October asset ${item.id}: ${Math.round(
                (Date.now() - started) / 1000
              )} seconds elapsed`
            );
            ledger.heartbeat();
          }, 30000);
        console.log(`Starting October asset ${item.id}.`);
        try {
          const sink = ledgerSink(
            new OverturePrivateSink(stage),
            ledger,
            item.id
          );
          const done = await extractPrivate({
            connection,
            inventory,
            policy,
            project,
            sourceMode: 'remote',
            reserveAttempt,
            sink,
          });
          await ledger.finishJob(item.id, {
            status: 'succeeded',
            checkpoint: {
              scanId: done?.scanId ?? null,
              sourceFileRowNumber: done?.sourceFileRowNumber ?? null,
            },
          });
          unit = null;
          console.log(`Completed October asset ${item.id}.`);
        } finally {
          clearInterval(heartbeat);
        }
      }
      await ledger.finish();
    } catch (error) {
      if (error instanceof StageStopped) {
        if (unit) await ledger.finishJob(unit, { status: 'cancelled' });
        await ledger.finish();
        console.log('Stopped at operator request.');
      } else {
        await ledger.fail(error, unit);
        throw error;
      }
    }
  } finally {
    if (connection) connection.closeSync();
    await budget.destroy();
    await stage.destroy();
    await social.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
