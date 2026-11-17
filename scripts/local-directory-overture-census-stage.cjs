/** Stage Overture for unverified Census matches, for local evaluation only. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  OverturePrivateSink,
} = require('../apps/directory/src/overture-private-sink');
const {
  projectLocalEvaluation,
} = require('../apps/directory/src/overture-local-evaluation');
const {
  OVERTURE_RIGHTS_FIELDS_LEGACY_V1,
} = require('../apps/directory/src/overture-rights');
const {
  authorizeAnonymousOvertureAttempt,
} = require('../apps/directory/src/provider-budget');
const digest = (x) => crypto.createHash('sha256').update(x).digest('hex');
async function main() {
  const args = process.argv.slice(2);
  if (
    process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
    args.length !== 2 ||
    args[0] !== '--stage-local' ||
    !/^\d{5}$/.test(args[1])
  )
    throw Error('Explicit local staging mode and asset required');
  const stageUrl = new URL(process.env.LOCAL_STAGE_DATABASE_URL || ''),
    budgetUrl = new URL(process.env.LOCAL_DIRECTORY_DATABASE_URL || '');
  if (
    [stageUrl, budgetUrl].some((u) => u.hostname !== '127.0.0.1' || !u.port) ||
    stageUrl.port !== budgetUrl.port ||
    stageUrl.pathname !== '/ot_directory_census_stage' ||
    budgetUrl.pathname !== '/ot_directory'
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
    inventory.items.length !== 16 ||
    digest(JSON.stringify(inventory.items)) !== inventory.inventorySha256
  )
    throw Error('Release inventory changed');
  inventory.envelope = [-180, -90, 180, 90];
  const raw = JSON.parse(
    fs.readFileSync('.agent/local-census-regions.json', 'utf8')
  );
  const { sha256, ...manifest } = raw;
  if (
    manifest.version !== 1 ||
    digest(JSON.stringify(manifest)) !== sha256 ||
    !Array.isArray(manifest.regions) ||
    !manifest.regions.length ||
    new Set(manifest.regions.map((r) => r.id)).size !== manifest.regions.length
  )
    throw Error('Census assignment manifest changed');
  const stage = new DataSource({ type: 'postgres', url: stageUrl.href }),
    budget = new DataSource({ type: 'postgres', url: budgetUrl.href });
  await stage.initialize();
  await budget.initialize();
  let connection;
  try {
    const current = await budget.query(
      'SELECT "communityId","changeToken" FROM directory_boundary_candidate WHERE "sourceEpoch"=$1 AND "activationId"=$2 AND "socialGeneration"=$3',
      [manifest.sourceEpoch, manifest.activationId, manifest.socialGeneration]
    );
    const candidates = new Map(
      current.map((c) => [c.communityId, c.changeToken])
    );
    if (
      manifest.regions.some(
        (r) => candidates.get(r.id) !== r.assignmentChangeToken
      )
    )
      throw Error('Census candidate changed; prepare assignments again');
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
    rights.terms.push({
      dataset: 'AllThePlaces',
      license: 'CC0-1.0',
      attribution: 'AllThePlaces; Overture Maps Foundation (October 2026)',
      termsUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      notice: 'CC0 1.0',
      permissions,
    });
    const classifierSha256 = digest(
        fs.readFileSync('apps/directory/src/overture-local-evaluation.ts')
      ),
      projectionSha256 = digest(
        Buffer.concat([
          fs.readFileSync('apps/directory/src/overture-local-evaluation.ts'),
          fs.readFileSync('scripts/local-directory-overture-census-stage.cjs'),
        ])
      );
    const approvalSha256 = digest(
      JSON.stringify({
        rights,
        inventory: inventory.inventorySha256,
        assignments: sha256,
        scope: 'local-evaluation-census-october-v1',
      })
    );
    await budget.query(
      'INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING',
      [approvalSha256]
    );
    const item = inventory.items.find((i) => i.id === args[1]);
    if (!item) throw Error('Unknown asset');
    const { DuckDBInstance } = await import('@duckdb/node-api'),
      { extractPrivate } = await import('./overture-private-extractor.mjs');
    const duck = await DuckDBInstance.create(':memory:');
    connection = await duck.connect();
    await connection.run('LOAD spatial');
    await connection.run('LOAD httpfs');
    const keys = crypto.generateKeyPairSync('ed25519'),
      subject = crypto.randomUUID(),
      tokens = new Map(
        manifest.regions.map((r) => [r.id, r.assignmentChangeToken])
      );
    const policy = {
      authorized: true,
      inventorySha256: inventory.inventorySha256,
      itemId: item.id,
      approvalSha256,
      projectionSha256,
      classifierSha256,
      regions: manifest.regions,
      singleMatch: true,
      localSnapshot: true,
      maxMemoryBytes: 2 * 1024 * 1024 * 1024,
      maxTransferBytes: 1024 * 1024 * 1024,
    };
    const reserveAttempt = (attempt) => {
      const now = Date.now(),
        claims = {
          version: 's4-private-source-v1',
          policyId: approvalSha256,
          subject,
          assetSha256: digest(item.asset),
          etag: item.etag,
          methods: ['GET', 'HEAD'],
          maxCostCents: 1,
          issuedAt: now - 1000,
          expiresAt: now + 600000,
        },
        payload = Buffer.from(JSON.stringify(claims)).toString('base64url'),
        signature = crypto
          .sign(null, Buffer.from(payload), keys.privateKey)
          .toString('base64url');
      return authorizeAnonymousOvertureAttempt(
        budget,
        keys.publicKey,
        { payload, signature },
        attempt
      );
    };
    const project = async ({ source, regionId }) => {
      try {
        const geometry =
            typeof source.geometry === 'string'
              ? JSON.parse(source.geometry)
              : source.geometry,
          outcome = projectLocalEvaluation(
            {
              ...source,
              geometry,
              releaseId: inventory.release,
              assignedCategoryIds: ['local'],
            },
            rights
          );
        if (outcome.status === 'eligible')
          outcome.listing.assignmentChangeToken = tokens.get(regionId);
        return outcome;
      } catch {
        return { status: 'quarantined' };
      }
    };
    const start = Date.now(),
      heartbeat = setInterval(
        () =>
          console.log(
            `Census asset ${item.id}: ${Math.round(
              (Date.now() - start) / 1000
            )} seconds elapsed`
          ),
        30000
      );
    console.log(`Starting Census asset ${item.id}.`);
    try {
      await extractPrivate({
        connection,
        inventory,
        policy,
        project,
        sourceMode: 'remote',
        reserveAttempt,
        sink: new OverturePrivateSink(stage),
      });
      console.log(`Completed Census asset ${item.id}.`);
    } finally {
      clearInterval(heartbeat);
    }
  } finally {
    connection?.closeSync();
    await budget.destroy();
    await stage.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
