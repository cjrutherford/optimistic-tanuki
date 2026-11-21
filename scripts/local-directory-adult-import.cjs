/** Import narrowly classified adult listings for explicit local visitor opt-in. */
const fs = require('node:fs'),
  crypto = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  OverturePrivateSink,
} = require('../apps/directory/src/overture-private-sink');
const {
  projectLocalAdult,
} = require('../apps/directory/src/overture-local-adult');
const {
  OVERTURE_RIGHTS_FIELDS_LEGACY_V1,
} = require('../apps/directory/src/overture-rights');
const hash = (x) => crypto.createHash('sha256').update(x).digest('hex');
async function main() {
  if (
    process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
    process.argv.slice(2).join(' ') !== '--apply-local'
  )
    throw Error('Explicit local mode required');
  const social = new URL(process.env.LOCAL_SOCIAL_DATABASE_URL || ''),
    directory = new URL(process.env.LOCAL_DIRECTORY_DATABASE_URL || '');
  if (
    social.hostname !== '127.0.0.1' ||
    !social.port ||
    social.pathname !== '/ot_social' ||
    directory.hostname !== '127.0.0.1' ||
    !directory.port ||
    directory.pathname !== '/ot_directory'
  )
    throw Error('Refusing non-local databases');
  const bytes = fs.readFileSync(
    '/home/cjrutherford/workspace/business-directory-poc/data/providers/overture/2026-09-23.0/four-seat-places.jsonl'
  );
  const artifactSha256 =
    '72355d674966b9f84d4293be9420f6ced0d454247d005e739bac014de728237c';
  if (hash(bytes) !== artifactSha256)
    throw Error('POC artifact fingerprint changed');
  const rows = bytes
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (rows.length !== 20811) throw Error('Unexpected source frame');
  const fields = [...OVERTURE_RIGHTS_FIELDS_LEGACY_V1],
    permissions = Object.fromEntries(
      ['ingest', 'retain', 'privateDisplay'].map((x) => [x, fields])
    );
  const policy = {
    releaseId: '2026-09-23.0',
    operations: { ingest: true, retain: true, privateDisplay: true },
    terms: ['meta', 'Microsoft', 'BrightQuery', 'DAC'].map((dataset) => ({
      dataset,
      license: 'CDLA-Permissive-2.0',
      attribution: `${dataset}; Overture Maps Foundation (September 2026)`,
      termsUrl: 'https://cdla.dev/permissive-2.0/',
      notice: 'CDLA Permissive 2.0',
      permissions,
    })),
  };
  policy.terms.push({
    dataset: 'AllThePlaces',
    license: 'CC0-1.0',
    attribution: 'AllThePlaces; Overture Maps Foundation (September 2026)',
    termsUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    notice: 'CC0 1.0',
    permissions,
  });
  const s = new DataSource({ type: 'postgres', url: social.href }),
    d = new DataSource({ type: 'postgres', url: directory.href });
  await s.initialize();
  await d.initialize();
  try {
    const towns = {};
    for (const name of ['douglas', 'tifton', 'valdosta', 'waycross']) {
      const matches = await s.query(
        `SELECT id FROM community WHERE lower(city)=$1 AND "adminArea"='GA' AND "isPrivate"=false AND "appScope"='local-hub' AND "localityType" IN ('city','town')`,
        [name]
      );
      if (matches.length !== 1)
        throw Error('Town identity unavailable or ambiguous');
      towns[name] = matches[0].id;
    }
    const policyId = hash(
        JSON.stringify({
          policy,
          classification: 'local-adult-v1',
          artifactSha256,
          projection: hash(
            fs.readFileSync('apps/directory/src/overture-local-adult.ts')
          ),
        })
      ),
      scanId = hash(JSON.stringify({ policyId, towns, artifactSha256 }));
    const sink = new OverturePrivateSink(d),
      checkpoint = await sink.load(scanId, policyId);
    if (await sink.isComplete(scanId)) {
      console.log('Local adult import is already complete.');
      return;
    }
    let last = -1,
      batch = [],
      included = 0,
      quarantined = 0;
    for (const r of rows) {
      if (!r.assignedCategoryIds?.includes('adult')) continue;
      const n = r.sourceFileRowNumber,
        regionId = towns[r.assignedSeatId];
      if (!Number.isSafeInteger(n) || n <= last || !regionId)
        throw Error('Invalid source ordering or town');
      last = n;
      const outcome = projectLocalAdult(
        { ...r, releaseId: policy.releaseId },
        policy
      );
      if (checkpoint && n <= checkpoint.sourceFileRowNumber) continue;
      if (outcome.status === 'eligible') included++;
      else quarantined++;
      batch.push({ sourceFileRowNumber: n, regionId, outcome });
    }
    if (batch.length)
      await sink.commit(batch, { scanId, sourceFileRowNumber: last });
    await sink.complete();
    console.log(
      `Local adult import completed: ${included} candidates; ${quarantined} quarantined.`
    );
  } finally {
    await d.destroy();
    await s.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
