/**
 * Re-capture the active Census cohort with source contact fields retained.
 *
 * The original October capture used `projectLocalEvaluation`, which keeps only
 * name/category/location/attribution. The address-review seed needs the source
 * `addresses`, `websites` and `phones` too, so this pass re-reads the same
 * pinned assets with an explicit contact-retaining sink.
 *
 * Local evaluation only. The sink retains contacts under
 * ingest/retain/privateDisplay rights; nothing is published here.
 *
 * Usage:
 *   DIRECTORY_LOCAL_EVALUATION=true \
 *   LOCAL_STAGE_DATABASE_URL=postgres://.../ot_directory_census_stage \
 *   LOCAL_DIRECTORY_DATABASE_URL=postgres://.../ot_directory \
 *   node scripts/local-directory-overture-contact-capture.cjs --asset 00001
 *
 * Pass `--asset all` (or `--asset 00000,00001,...`) to run several assets.
 */
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
const digest = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const CONTACT_ASSETS = ['00000', '00001', '00003', '00006'];
const SCOPE = 'local-evaluation-census-october-contact-v1';

/** Compose the structured Overture address into a Census-friendly string. */
const composeAddress = (value) => {
  if (typeof value === 'string') return value;
  const freeform =
    typeof value?.freeform === 'string' ? value.freeform.trim() : '';
  if (!freeform) return '';
  const locality =
    typeof value.locality === 'string' ? value.locality.trim() : '';
  const region = typeof value.region === 'string' ? value.region.trim() : '';
  const postcode =
    typeof value.postcode === 'string' ? value.postcode.trim() : '';
  const stateAndPostcode = [region, postcode].filter(Boolean).join(' ');
  const normalizedFreeform = freeform.toLocaleLowerCase();
  const normalizedLocality = locality.toLocaleLowerCase();
  const alreadyEndsWithLocality =
    normalizedLocality &&
    (normalizedFreeform === normalizedLocality ||
      normalizedFreeform.endsWith(`, ${normalizedLocality}`));
  const tail = [alreadyEndsWithLocality ? '' : locality, stateAndPostcode]
    .filter(Boolean)
    .join(', ');
  return tail ? `${freeform}, ${tail}` : freeform;
};

async function main() {
  const args = process.argv.slice(2);
  if (process.env.DIRECTORY_LOCAL_EVALUATION !== 'true') {
    throw Error('Explicit local evaluation mode is required');
  }
  const assetArg = args[0] === '--asset' ? args[1] : '';
  if (!assetArg) throw Error('--asset is required');
  const assetIds =
    assetArg === 'all'
      ? CONTACT_ASSETS
      : assetArg
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
  if (
    !assetIds.length ||
    assetIds.some((id) => !/^\d{5}$/.test(id)) ||
    new Set(assetIds).size !== assetIds.length
  ) {
    throw Error('Invalid asset id list');
  }

  const stageUrl = new URL(process.env.LOCAL_STAGE_DATABASE_URL || '');
  const budgetUrl = new URL(process.env.LOCAL_DIRECTORY_DATABASE_URL || '');
  if (
    [stageUrl, budgetUrl].some(
      (url) => url.hostname !== '127.0.0.1' || !url.port
    ) ||
    stageUrl.port !== budgetUrl.port ||
    stageUrl.pathname !== '/ot_directory_census_stage' ||
    budgetUrl.pathname !== '/ot_directory'
  ) {
    throw Error('Refusing non-local databases');
  }

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
  ) {
    throw Error('Release inventory changed');
  }
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
    new Set(manifest.regions.map((region) => region.id)).size !==
      manifest.regions.length
  ) {
    throw Error('Census assignment manifest changed');
  }

  const stage = new DataSource({ type: 'postgres', url: stageUrl.href });
  const budget = new DataSource({ type: 'postgres', url: budgetUrl.href });
  await stage.initialize();
  await budget.initialize();
  let connection;

  try {
    const current = await budget.query(
      'SELECT "communityId","changeToken" FROM directory_boundary_candidate WHERE "sourceEpoch"=$1 AND "activationId"=$2 AND "socialGeneration"=$3',
      [manifest.sourceEpoch, manifest.activationId, manifest.socialGeneration]
    );
    const candidates = new Map(
      current.map((row) => [row.communityId, row.changeToken])
    );
    if (
      manifest.regions.some(
        (region) => candidates.get(region.id) !== region.assignmentChangeToken
      )
    ) {
      throw Error('Census candidate changed; prepare assignments again');
    }

    const fields = [...OVERTURE_RIGHTS_FIELDS_LEGACY_V1];
    const permissions = Object.fromEntries(
      ['ingest', 'retain', 'privateDisplay'].map((operation) => [
        operation,
        fields,
      ])
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
    );
    const projectionSha256 = digest(
      Buffer.concat([
        fs.readFileSync('apps/directory/src/overture-local-evaluation.ts'),
        fs.readFileSync('scripts/local-directory-overture-contact-capture.cjs'),
      ])
    );
    const approvalSha256 = digest(
      JSON.stringify({
        rights,
        inventory: inventory.inventorySha256,
        assignments: sha256,
        scope: SCOPE,
      })
    );
    await budget.query(
      'INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING',
      [approvalSha256]
    );

    const { DuckDBInstance } = await import('@duckdb/node-api');
    const { extractPrivate } = await import('./overture-private-extractor.mjs');
    const duck = await DuckDBInstance.create(':memory:');
    connection = await duck.connect();
    await connection.run('LOAD spatial');
    await connection.run('LOAD httpfs');

    const keys = crypto.generateKeyPairSync('ed25519');
    const subject = crypto.randomUUID();
    const tokens = new Map(
      manifest.regions.map((region) => [
        region.id,
        region.assignmentChangeToken,
      ])
    );

    for (const assetId of assetIds) {
      const item = inventory.items.find((entry) => entry.id === assetId);
      if (!item) throw Error(`Unknown asset ${assetId}`);
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
        const now = Date.now();
        const claims = {
          version: 's4-private-source-v1',
          policyId: approvalSha256,
          subject,
          assetSha256: digest(item.asset),
          etag: item.etag,
          methods: ['GET', 'HEAD'],
          maxCostCents: 1,
          issuedAt: now - 1000,
          expiresAt: now + 600000,
        };
        const payload = Buffer.from(JSON.stringify(claims)).toString(
          'base64url'
        );
        const signature = crypto
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
              : source.geometry;
          const base = projectLocalEvaluation(
            {
              ...source,
              geometry,
              releaseId: inventory.release,
              assignedCategoryIds: ['local'],
            },
            rights
          );
          if (base.status !== 'eligible') return base;
          const contacts = (key) =>
            Array.isArray(source[key])
              ? source[key]
                  .map((value) =>
                    typeof value === 'string' ? value : composeAddress(value)
                  )
                  .filter(
                    (value) =>
                      typeof value === 'string' &&
                      value.trim().length > 0 &&
                      value.length <= 2048
                  )
                  .slice(0, 20)
              : [];
          const addresses = contacts('addresses');
          const websites = contacts('websites');
          const phones = contacts('phones');
          const listing = {
            ...base.listing,
            assignmentChangeToken: tokens.get(regionId),
          };
          if (Array.isArray(source.sources) && source.sources.length) {
            const provenance = source.sources
              .filter(
                (entry) =>
                  entry &&
                  typeof entry === 'object' &&
                  typeof entry.dataset === 'string' &&
                  entry.dataset.trim().length > 0 &&
                  typeof entry.license === 'string' &&
                  entry.license.trim().length > 0 &&
                  (entry.property === undefined ||
                    entry.property === '' ||
                    (typeof entry.property === 'string' &&
                      entry.property.startsWith('/')))
              )
              .slice(0, 20)
              .map((entry) => ({
                ...(entry.property !== undefined
                  ? { property: entry.property }
                  : {}),
                dataset: entry.dataset,
                license: entry.license,
              }));
            if (provenance.length) listing.sources = provenance;
          }
          if (addresses.length) listing.addresses = addresses;
          if (websites.length) listing.websites = websites;
          if (phones.length) listing.phones = phones;
          return { status: 'eligible', listing };
        } catch {
          return { status: 'quarantined' };
        }
      };
      const start = Date.now();
      const heartbeat = setInterval(
        () =>
          console.log(
            `Contact asset ${item.id}: ${Math.round(
              (Date.now() - start) / 1000
            )} seconds elapsed`
          ),
        30000
      );
      console.log(`Starting contact capture for asset ${item.id}.`);
      try {
        const result = await extractPrivate({
          connection,
          inventory,
          policy,
          project,
          sourceMode: 'remote',
          reserveAttempt,
          sink: new OverturePrivateSink(stage, {
            includeContactFields: true,
            includeSourceProvenance: true,
          }),
        });
        console.log(
          `Completed contact asset ${item.id}: scan ${result.scanId} last row ${result.sourceFileRowNumber}.`
        );
      } finally {
        clearInterval(heartbeat);
      }
    }
  } finally {
    connection?.closeSync();
    await budget.destroy();
    await stage.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = { composeAddress };
