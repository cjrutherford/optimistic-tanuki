/** Import only the locally approved, minimal POC projection. Never use for public release. */
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
const artifact =
  '/home/cjrutherford/workspace/business-directory-poc/data/providers/overture/2026-09-23.0/four-seat-places.jsonl';
const artifactSha256 =
  '72355d674966b9f84d4293be9420f6ced0d454247d005e739bac014de728237c';
const digest = (x) => crypto.createHash('sha256').update(x).digest('hex');
async function main() {
  if (
    process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
    process.argv.slice(2).join(' ') !== '--apply-local'
  )
    throw Error('Explicit local evaluation mode required');
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
    throw Error('Refusing non-local evaluation databases');
  const bytes = fs.readFileSync(artifact);
  if (digest(bytes) !== artifactSha256)
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
  const oldPolicy = {
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
  const policy = {
    ...oldPolicy,
    terms: [
      ...oldPolicy.terms,
      {
        dataset: 'AllThePlaces',
        license: 'CC0-1.0',
        attribution: 'AllThePlaces; Overture Maps Foundation (September 2026)',
        termsUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        notice: 'CC0 1.0',
        permissions,
      },
    ],
  };
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
    const curated = new Set([3723943, 3752791, 3770829, 3773386]);
    const key = (r) =>
      JSON.stringify([
        r.assignedSeatId,
        (r.names?.primary || '').trim().toLowerCase(),
        r.geometry?.coordinates,
      ]);
    const seen = new Set(
      rows.filter((r) => curated.has(r.sourceFileRowNumber)).map(key)
    );
    const oldPolicyIds = [
      'local-low-risk-v1',
      'local-low-risk-v2',
      'local-low-risk-v3',
    ].map((classification) =>
      digest(
        JSON.stringify({ policy: oldPolicy, classification, artifactSha256 })
      )
    );
    const policyId = digest(
        JSON.stringify({
          policy,
          classification: 'local-low-risk-v4',
          artifactSha256,
        })
      ),
      scanId = digest(JSON.stringify({ policyId, towns, artifactSha256 }));
    const sink = new OverturePrivateSink(d),
      checkpoint = await sink.load(scanId, policyId);
    if (await sink.isComplete(scanId)) {
      for (const oldPolicyId of oldPolicyIds) {
        let done = false;
        while (!done) done = (await sink.withdrawPolicy(oldPolicyId)).complete;
      }
      console.log('Local POC import is already complete.');
      return;
    }
    let last = -1,
      batch = [],
      included = 0,
      quarantined = 0;
    for (const r of rows) {
      const n = r.sourceFileRowNumber,
        regionId = towns[r.assignedSeatId];
      if (!Number.isSafeInteger(n) || n <= last || !regionId)
        throw Error('Invalid source ordering or town');
      last = n;
      let outcome = projectLocalEvaluation(
        { ...r, releaseId: policy.releaseId },
        policy
      );
      const k = key(r);
      if (curated.has(n) || (outcome.status === 'eligible' && seen.has(k)))
        outcome = { status: 'quarantined' };
      if (outcome.status === 'eligible') seen.add(k);
      if (checkpoint && n <= checkpoint.sourceFileRowNumber) continue;
      if (outcome.status === 'eligible') included++;
      else quarantined++;
      batch.push({ sourceFileRowNumber: n, regionId, outcome });
      if (batch.length === 250) {
        await sink.commit(batch, { scanId, sourceFileRowNumber: n });
        batch = [];
      }
    }
    if (batch.length)
      await sink.commit(batch, { scanId, sourceFileRowNumber: last });
    await sink.complete();
    for (const oldPolicyId of oldPolicyIds) {
      let done = false;
      while (!done) done = (await sink.withdrawPolicy(oldPolicyId)).complete;
    }
    console.log(
      `Local POC import completed: ${included} listings retained; ${quarantined} records quarantined or omitted.`
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
