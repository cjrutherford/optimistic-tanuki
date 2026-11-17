/** Check a sample of newly populated towns through the running local gateway. */
const { DataSource } = require('typeorm');
async function main() {
  if (
    process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
    process.argv.slice(2).join(' ') !== '--verify-local'
  )
    throw Error('Explicit local verification required');
  const url = new URL(process.env.LOCAL_DIRECTORY_DATABASE_URL || '');
  if (
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.pathname !== '/ot_directory'
  )
    throw Error('Refusing non-local database');
  const db = new DataSource({ type: 'postgres', url: url.href });
  await db.initialize();
  try {
    const towns = await db.query(
      `SELECT r."regionId" AS id,count(*)::int AS n FROM directory_overture_private_row r JOIN directory_overture_private_membership m USING ("scanId") JOIN directory_overture_private_policy p USING ("policyId") JOIN directory_overture_private_completion c USING ("scanId") JOIN directory_boundary_candidate b ON b."communityId"::text=r."regionId" AND b."changeToken"::text=r.listing->>'assignmentChangeToken' WHERE NOT p.revoked AND r."regionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId") AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber") GROUP BY r."regionId" ORDER BY n DESC,r."regionId" LIMIT 10`
    );
    if (!towns.length) throw Error('No current additional-town listings');
    let passed = 0;
    for (const town of towns) {
      const response = await fetch(
        `http://127.0.0.1:3000/api/directory/towns/${town.id}/local-evaluation-listings`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!response.ok)
        throw Error(`Local gateway returned ${response.status}`);
      const result = await response.json();
      if (
        !Array.isArray(result.listings) ||
        !result.listings.length ||
        !result.listings.every(
          (x) =>
            Array.isArray(x.attribution) &&
            x.attribution.length &&
            Array.isArray(x.notices) &&
            !x.coordinates
        )
      )
        throw Error('Invalid additional-town listing response');
      passed++;
    }
    console.log(
      `Verified ${passed}/${towns.length} additional-town gateway responses with source credits and no unreviewed coordinates.`
    );
  } finally {
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
