import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { readCensusBoundaryCandidate } from './census-boundary-reader.mjs';

const require = createRequire(import.meta.url);
const { DataSource } = require('typeorm');
const {
  pendingRuntimeConfig,
} = require('../apps/directory/src/register-pending-runtime.ts');
const {
  RegisterDeliveryV2,
} = require('../apps/directory-worker/src/register-delivery.ts');
const {
  installReviewedBoundary,
} = require('../apps/directory/src/reviewed-boundary-install.ts');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
async function main() {
  const [communityId, requestId] = process.argv.slice(2);
  if (
    process.argv.length !== 4 ||
    !uuid.test(communityId || '') ||
    !uuid.test(requestId || '')
  )
    throw Error('Supply canonical community and decision UUIDs');
  const archive = process.env.DIRECTORY_CENSUS_ARCHIVE_PATH;
  if (!archive) throw Error('A staged Census archive is required');
  const archivePath = resolve(archive),
    archiveBytes = (await stat(archivePath)).size,
    config = pendingRuntimeConfig(process.env);
  const db = new DataSource({
    type: 'postgres',
    url: config.databaseUrl,
    extra: { connectionTimeoutMillis: 2000, statement_timeout: 10000 },
  });
  const source = new RegisterDeliveryV2(
    config.host,
    config.port,
    config.secret
  );
  let duck, connection;
  try {
    await db.initialize();
    duck = await DuckDBInstance.create(':memory:');
    connection = await duck.connect();
    await connection.run('SET autoinstall_known_extensions=false');
    await connection.run('SET autoload_known_extensions=false');
    await connection.run('LOAD spatial');
    const version = await installReviewedBoundary(
      db,
      config.identity,
      { communityId, requestId },
      () => source.geography(config.identity, communityId),
      (decision, geography) =>
        readCensusBoundaryCandidate({
          connection,
          archivePath,
          archiveBytes,
          archiveSha256: decision.archiveSha256,
          vintage: decision.vintage,
          stateFips: decision.stateFips,
          layer: decision.layer,
          geoid: decision.geoid,
          referencePoint: geography.referencePoint,
        })
    );
    console.log(
      `Private boundary version ${version} installed. Public serving remains pending.`
    );
  } finally {
    connection?.closeSync();
    duck?.closeSync();
    source.close();
    if (db.isInitialized) await db.destroy();
  }
}
main().catch(() => {
  console.error(
    'Private boundary installation failed. Check the decision, pinned archive and current authority.'
  );
  process.exitCode = 1;
});
