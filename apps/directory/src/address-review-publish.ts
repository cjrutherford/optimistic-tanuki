import { unprojectBinding } from './reviewed-spatial';
import { assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';
import { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { OverturePrivateSink } from './overture-private-sink';
import type { OvertureRightsPolicy } from './overture-rights';
import { DEFAULT_ADDRESS_REVIEW_POLICY } from './address-review';
import {
  type BindingKey,
  documentHash,
  fieldHashes,
  keyedHash,
  reviewedHash,
  stageContentHash,
} from './reviewed-binding';

const HEX64 = /^[a-f0-9]{64}$/;

/**
 * Where the published contact fields came from, so the publication can be
 * bound durably to that exact source (S5-item4-source-binding-design.md 1.1).
 */
export interface ReviewedSourceBinding {
  provenance: 'contact_stage' | 'source_file';
  /** HMAC key for the content hashes; held by the Directory, never stored. */
  key: BindingKey;
  /** contact_stage: which stage database (its installation id, or an operator label). */
  stageInstallationId?: string;
  /** contact_stage: the exact stage row that supplied the contact fields. */
  stage?: {
    scanId: string;
    sourceFileRowNumber: string | number;
    policyId: string;
    listing: unknown;
  };
  /** source_file: the source row as read. */
  fileRow?: unknown;
}

function validateSourceBinding(
  binding: ReviewedSourceBinding | undefined
): ReviewedSourceBinding {
  if (!binding || typeof binding !== 'object')
    throw Error('Source binding is required');
  if (typeof binding.key !== 'string' && !Buffer.isBuffer(binding.key))
    throw Error('Source binding key is required');
  if (binding.provenance === 'contact_stage') {
    const stage = binding.stage;
    if (
      !stage ||
      !HEX64.test(stage.scanId || '') ||
      !HEX64.test(stage.policyId || '') ||
      !/^[0-9]+$/.test(String(stage.sourceFileRowNumber)) ||
      !stage.listing ||
      typeof binding.stageInstallationId !== 'string' ||
      !binding.stageInstallationId.trim() ||
      binding.stageInstallationId.length > 64
    ) {
      throw Error('Contact-stage source binding is incomplete');
    }
  } else if (binding.provenance === 'source_file') {
    if (binding.fileRow === undefined || binding.fileRow === null)
      throw Error('Source-file binding is incomplete');
  } else {
    throw Error('Unknown source binding provenance');
  }
  return binding;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActivePrivateRow {
  scanId: string;
  sourceFileRowNumber: string;
  policyId: string;
  listing: any;
}

function samePoint(left: unknown, right: unknown): boolean {
  if (!left || !right) return false;
  const a = left as any;
  const b = right as any;
  return (
    Array.isArray(a.coordinates) &&
    a.coordinates.length === 2 &&
    Math.abs(a.coordinates[0] - b.lng) < 1e-6 &&
    Math.abs(a.coordinates[1] - b.lat) < 1e-6
  );
}

/** Verified boundaries take precedence; a pinned Census place is local-only. */
export async function requireTownContainment(
  candidate: any,
  manager: EntityManager
): Promise<{ basis: string; changeToken: string; manifestHash?: string }> {
  const raw = process.env.DIRECTORY_CONTAINMENT_GATEWAY_URL;
  let gateway: URL;
  try {
    gateway = new URL(raw || '');
  } catch {
    throw Error('Town containment is unavailable');
  }
  if (
    !['http:', 'https:'].includes(gateway.protocol) ||
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(gateway.hostname) ||
    gateway.username ||
    gateway.password ||
    gateway.search ||
    gateway.hash ||
    gateway.pathname !== '/'
  ) {
    throw Error('Town containment is unavailable');
  }
  const geocode = candidate.geocode;
  const points = [geocode?.coordinates, candidate.point];
  if (
    geocode?.status !== 'match' ||
    points.some(
      (point) =>
        !point ||
        !Number.isFinite(point.lng) ||
        !Number.isFinite(point.lat) ||
        Math.abs(point.lng) > 180 ||
        Math.abs(point.lat) > 90
    )
  ) {
    throw Error('Verified geocode is required for town containment');
  }
  let boundaryStatus: string | undefined;
  for (const point of points) {
    const url = new URL(
      `/api/directory/towns/${candidate.communityId}/validate`,
      gateway
    );
    url.search = new URLSearchParams({
      longitude: String(point.lng),
      latitude: String(point.lat),
    }).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw Error('Town containment is unavailable');
    const result = (await response.json()) as any;
    if (
      result?.town?.id !== candidate.communityId ||
      !['pending', 'ready'].includes(result.status) ||
      (result.status === 'ready' && typeof result.covers !== 'boolean') ||
      (boundaryStatus && boundaryStatus !== result.status)
    )
      throw Error('Verified town boundary is unavailable');
    boundaryStatus = result.status;
    if (result.status === 'ready' && !result.covers)
      throw Error('Address or map point is outside the assigned town');
  }
  if (boundaryStatus === 'ready') {
    const [result] = await manager.query(
      `SELECT b."geometryHash",b."changeToken",encode(ST_AsEWKB(g.boundary,'XDR'),'hex') AS geometry, ST_Covers(g.boundary,ST_SetSRID(ST_MakePoint($2,$3),4326)) AS geocode_inside, ST_Covers(g.boundary,ST_SetSRID(ST_MakePoint($4,$5),4326)) AS source_inside
      FROM directory_reviewed_geometry b
      JOIN directory_town t ON t."communityId"=b."communityId" AND t.eligible IS TRUE AND t."geometryStatus"='ready' AND t."geometryVersion"=b.version
      JOIN directory_town_geometry g ON g."communityId"=b."communityId" AND g.version=b.version
      JOIN directory_boundary_decision d ON d."requestId"=b."requestId" AND d."communityId"=b."communityId" AND d.decision='verified' AND d."invalidatedAt" IS NULL
      JOIN directory_boundary_candidate c ON c."communityId"=b."communityId" AND c."changeToken"=b."changeToken" AND c."geographyHash"=b."geographyHash" AND c."sourceEpoch"=d."sourceEpoch" AND c."activationId"=d."activationId" AND c."socialGeneration"=d."socialGeneration"
      WHERE b."communityId"=$1 AND d."changeToken"=b."changeToken" AND d."geographyHash"=b."geographyHash" AND d."recoveryEpoch"=b."recoveryEpoch" AND d."directoryGeneration"=b."directoryGeneration"
      FOR SHARE OF b,t,g,d,c`,
      [
        candidate.communityId,
        points[0].lng,
        points[0].lat,
        points[1].lng,
        points[1].lat,
      ]
    );
    if (
      !result ||
      createHash('sha256')
        .update(Buffer.from(result.geometry, 'hex'))
        .digest('hex') !== result.geometryHash
    )
      throw Error('Verified town boundary changed or is unavailable');
    if (!result.geocode_inside || !result.source_inside)
      throw Error('Address or map point is outside the assigned town');
    return { basis: 'verified_boundary', changeToken: result.changeToken };
  }
  const options = manager.connection.options as { url?: string; host?: string };
  let databaseHost = options.host || '';
  try {
    if (options.url) databaseHost = new URL(options.url).hostname;
  } catch {
    throw Error('Census fallback requires local evaluation');
  }
  if (
    process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
    !['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseHost)
  )
    throw Error('Census fallback requires local evaluation');
  const file = process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_PATH;
  const pinned = process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256;
  if (!file || !pinned || !/^[a-f0-9]{64}$/.test(pinned))
    throw Error('Verified town boundary is unavailable');
  let manifest: any;
  try {
    if (statSync(file).size > 50_000_000) throw Error();
    manifest = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw Error('Census place candidate is unavailable');
  }
  const { sha256, ...payload } = manifest ?? {};
  if (
    payload.version !== 1 ||
    sha256 !== pinned ||
    createHash('sha256').update(JSON.stringify(payload)).digest('hex') !==
      pinned ||
    !Array.isArray(payload.regions)
  )
    throw Error('Census place manifest is invalid');
  const matches = payload.regions.filter(
    (region: any) => region?.id === candidate.communityId
  );
  if (
    matches.length !== 1 ||
    !matches[0].geometry ||
    !UUID.test(matches[0].assignmentChangeToken || '')
  )
    throw Error('Census place candidate is unavailable');
  const region = matches[0];
  const current = await manager.query(
    `SELECT 1 FROM directory_boundary_candidate WHERE "communityId"=$1 AND "sourceEpoch"=$2 AND "activationId"=$3 AND "socialGeneration"=$4 AND "changeToken"=$5 AND layer='place' FOR SHARE`,
    [
      candidate.communityId,
      payload.sourceEpoch,
      payload.activationId,
      String(payload.socialGeneration),
      region.assignmentChangeToken,
    ]
  );
  if (current.length !== 1)
    throw Error('Census place candidate is stale or unavailable');
  const geo = JSON.stringify(region.geometry);
  for (const point of points) {
    const [result] = await manager.query(
      `SELECT ST_IsValid(g) AND NOT ST_IsEmpty(g) AND GeometryType(g) IN ('POLYGON','MULTIPOLYGON') AS valid, ST_Covers(g,ST_SetSRID(ST_MakePoint($2,$3),4326)) AS covers FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) g) x`,
      [geo, point.lng, point.lat]
    );
    if (!result?.valid) throw Error('Census place geometry is invalid');
    if (!result.covers)
      throw Error('Address or map point is outside the assigned town');
  }
  return {
    basis: 'census_place_candidate_local',
    changeToken: region.assignmentChangeToken,
    manifestHash: pinned,
  };
}

export async function findActivePrivateRow(
  db: DataSource,
  input: {
    communityId: string;
    name: string;
    category: string;
    point: { lat: number; lng: number };
  }
): Promise<ActivePrivateRow> {
  if (!UUID.test(input.communityId)) throw Error('Invalid community');
  const rows = await db.query(
    `SELECT r."scanId",r."sourceFileRowNumber",r.listing,m."policyId"
     FROM "directory_overture_private_row" r
     JOIN "directory_overture_private_membership" m ON m."scanId"=r."scanId"
     JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId" AND p.revoked=false
     JOIN "directory_overture_private_completion" c ON c."scanId"=r."scanId"
     WHERE r."regionId"=$1
       AND btrim(r.listing->>'name')=$2
       AND NOT EXISTS (SELECT 1 FROM "directory_overture_private_revocation" x WHERE x."scanId"=r."scanId")
       AND NOT EXISTS (SELECT 1 FROM "directory_overture_private_row_revocation" x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")`,
    [input.communityId, input.name]
  );
  const matches = rows.filter(
    (row: any) =>
      row.listing?.category === input.category &&
      samePoint(row.listing?.location, input.point)
  );
  if (matches.length !== 1) {
    throw Error(
      matches.length === 0
        ? 'No active private row matches this candidate'
        : 'Multiple active private rows match this candidate'
    );
  }
  return {
    scanId: matches[0].scanId,
    sourceFileRowNumber: String(matches[0].sourceFileRowNumber),
    policyId: matches[0].policyId,
    listing: matches[0].listing,
  };
}

export async function publishAddressReviewCandidate(
  db: DataSource,
  input: {
    candidateId: string;
    source: Parameters<OverturePrivateSink['attachLocalReviewedFields']>[1];
    policy: OvertureRightsPolicy;
    actorId?: string;
    actorKind?: 'auto' | 'human';
    /** Reviewer-supplied evidence, only accepted with a matching human approval. */
    humanEvidenceUrl?: string;
    /** Durable binding of the published fields to the source that supplied them. */
    sourceBinding: ReviewedSourceBinding;
  }
): Promise<{
  candidateId: string;
  status: string;
  scanId: string;
  row: string;
  bindingId: string;
  decisionId: string;
}> {
  if (!UUID.test(input.candidateId)) throw Error('Invalid candidate');
  const binding = validateSourceBinding(input.sourceBinding);
  if (!input.policy || typeof input.policy !== 'object') {
    throw Error('Public-display policy is required');
  }
  if (!input.actorId || !UUID.test(input.actorId)) {
    throw Error('Verified publisher is required');
  }
  const rows = await db.query(
    'SELECT * FROM "directory_address_review_candidate" WHERE "id"=$1',
    [input.candidateId]
  );
  if (rows.length !== 1) throw Error('Candidate not found');
  const candidate = rows[0];
  if (!['approved', 'auto_approved'].includes(candidate.status)) {
    throw Error('Candidate is not approved for publication');
  }
  if (candidate.policyVersion !== DEFAULT_ADDRESS_REVIEW_POLICY.version) {
    throw Error('Review policy is obsolete; review the candidate again');
  }
  const evidence = candidate.officialEvidence;
  const automatedEvidence =
    evidence &&
    evidence.status === 'fetched' &&
    evidence.nameMatch === true &&
    evidence.addressMatch === true;
  let evidenceUrl: string;
  if (automatedEvidence) {
    const fetchedAt =
      typeof evidence.fetchedAt === 'string'
        ? Date.parse(evidence.fetchedAt)
        : NaN;
    if (
      !Number.isFinite(fetchedAt) ||
      fetchedAt > Date.now() ||
      Date.now() - fetchedAt >
        DEFAULT_ADDRESS_REVIEW_POLICY.maxEvidenceAgeDays * 86_400_000
    ) {
      throw Error('Official-page evidence is stale or unavailable');
    }
    evidenceUrl = evidence.url;
  } else {
    const humanUrl = input.humanEvidenceUrl;
    if (
      input.actorKind !== 'human' ||
      typeof humanUrl !== 'string' ||
      humanUrl.length > 2048
    ) {
      throw Error('Matching official-page evidence is required');
    }
    let parsed: URL;
    try {
      parsed = new URL(humanUrl);
    } catch {
      throw Error('Matching official-page evidence is required');
    }
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      !host.includes('.') ||
      /(?:^|\.)(localhost|local|internal)$/.test(host)
    ) {
      throw Error('Matching official-page evidence is required');
    }
    const approvals = await db.query(
      `SELECT 1 FROM "directory_address_review_decision"
       WHERE "candidateId"=$1 AND "actorKind"='human' AND "decision"='approve'
         AND "actorId"=$2 AND "evidenceUrl"=$3 LIMIT 1`,
      [input.candidateId, input.actorId, humanUrl]
    );
    if (approvals.length !== 1) {
      throw Error('Human approval evidence is required');
    }
    evidenceUrl = humanUrl;
  }
  const risk = candidate.risk || {};
  if (
    risk.residential !== false ||
    risk.sensitive !== false ||
    risk.adult !== false
  ) {
    throw Error('Residential, sensitive and adult checks must be clear');
  }
  if (!candidate.point || !candidate.category) {
    throw Error('Candidate location is incomplete');
  }
  const source = input.source as any;
  const sameSingle = (left: unknown, right: unknown) =>
    Array.isArray(left) &&
    left.length === 1 &&
    Array.isArray(right) &&
    right.length === 1 &&
    typeof left[0] === 'string' &&
    typeof right[0] === 'string' &&
    left[0].trim() === right[0].trim();
  const hasValues = (value: unknown) =>
    Array.isArray(value) && value.length > 0;
  const sourceAddresses = Array.isArray(source.addresses)
    ? source.addresses.map((value: any) => value?.freeform)
    : [];
  if (
    !sameSingle(candidate.addresses, sourceAddresses) ||
    (evidence?.websiteMatch === true &&
      (hasValues(candidate.websites) || hasValues(source.websites)) &&
      !sameSingle(candidate.websites, source.websites)) ||
    (evidence?.phoneMatch === true &&
      (hasValues(candidate.phones) || hasValues(source.phones)) &&
      !sameSingle(candidate.phones, source.phones))
  ) {
    throw Error('Source does not match the reviewed contact fields');
  }

  const active = await findActivePrivateRow(db, {
    communityId: candidate.communityId,
    name: candidate.name,
    category: candidate.category,
    point: candidate.point,
  });
  if (
    candidate.scanId !== active.scanId ||
    String(candidate.sourceFileRowNumber) !== active.sourceFileRowNumber
  ) {
    throw Error('Candidate source key does not match the active private row');
  }
  const sink = new OverturePrivateSink(db);
  await sink.load(active.scanId, active.policyId);
  const review = {
    evidenceUrl,
    nonResidential: true,
    nonSensitive: true,
    nonAdult: true,
    addressVerified: true,
    websiteVerified: evidence?.websiteMatch === true,
    phoneVerified: evidence?.phoneMatch === true,
  };
  const written = await db.transaction(async (manager) => {
    await assertDirectoryIdentitiesUnfenced(manager, [input.actorId]);
    const locked = await manager.query(
      'SELECT * FROM "directory_address_review_candidate" WHERE "id"=$1 FOR UPDATE',
      [input.candidateId]
    );
    const relevant = [
      'status',
      'scanId',
      'sourceFileRowNumber',
      'communityId',
      'name',
      'category',
      'point',
      'risk',
      'officialEvidence',
      'geocode',
      'addresses',
      'websites',
      'phones',
      'rights',
      'policyVersion',
    ];
    if (
      locked.length !== 1 ||
      relevant.some(
        (key) =>
          JSON.stringify(locked[0][key]) !== JSON.stringify(candidate[key])
      ) ||
      new Date(locked[0].updatedAt).getTime() !==
        new Date(candidate.updatedAt).getTime()
    ) {
      throw Error('Candidate changed before publication');
    }
    // Lock order: fence -> candidate -> binding -> policy -> scan -> row.
    const earlier = await manager.query(
      `SELECT id FROM "directory_reviewed_binding" WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "state"<>'retired' FOR UPDATE`,
      [active.scanId, active.sourceFileRowNumber]
    );
    const containment = await requireTownContainment(locked[0], manager);
    await sink.attachLocalReviewedFields(
      Number(active.sourceFileRowNumber),
      {
        ...input.source,
        names: { primary: active.listing.name },
        basic_category: active.listing.category,
        geometry: active.listing.location,
      },
      input.policy,
      { ...review, assignmentChangeToken: containment.changeToken },
      manager
    );
    await manager.query(
      'UPDATE "directory_address_review_candidate" SET "status"=\'published\',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1',
      [input.candidateId]
    );
    const [decision] = await manager.query(
      `INSERT INTO "directory_address_review_decision"
        ("candidateId","actorKind","actorId","decision","evidenceUrl","evidenceHash","reason","checks","policyVersion","appliedAt")
       VALUES ($1,$2,$3,'approve',$4,$5,NULL,$6::jsonb,$7,CURRENT_TIMESTAMP)
       RETURNING "id"`,
      [
        input.candidateId,
        input.actorKind ?? 'human',
        input.actorId,
        evidenceUrl,
        evidence?.evidenceHash ?? null,
        JSON.stringify({
          publication: 'reviewed_fields_attached',
          containment: containment.basis,
          assignmentChangeToken: containment.changeToken,
          ...(containment.manifestHash
            ? { manifestHash: containment.manifestHash }
            : {}),
        }),
        input.policy.releaseId,
      ]
    );
    // A re-publication replaces whatever binding the row had; the new one starts pending.
    for (const old of earlier) {
      await unprojectBinding(manager, old.id);
      await manager.query(
        `UPDATE "directory_reviewed_binding" SET "state"='retired',"stateCause"='replaced',"retiredAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
        [old.id]
      );
      await manager.query(
        `INSERT INTO "directory_reviewed_binding_event" ("bindingId","kind","cause","decisionId") VALUES ($1,'retired','replaced',$2)`,
        [old.id, decision.id]
      );
    }
    const [written] = await manager.query(
      'SELECT listing->\'reviewed\' AS reviewed FROM "directory_overture_private_row" WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
      [active.scanId, active.sourceFileRowNumber]
    );
    const reviewed = written?.reviewed;
    if (!reviewed) throw Error('Reviewed fields were not written');
    const stage = binding.stage;
    const [created] = await manager.query(
      `INSERT INTO "directory_reviewed_binding"
        ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber","livePolicyId","provenance",
         "stageInstallationId","stageScanId","stageSourceFileRowNumber","stagePolicyId",
         "displayPolicyReleaseId","displayPolicyHash","stageContentHash","reviewedHash","fieldHashes",
         "assignmentChangeToken","state","stateCause")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,'pending','published')
       RETURNING "id"`,
      [
        input.candidateId,
        decision.id,
        candidate.communityId,
        active.scanId,
        active.sourceFileRowNumber,
        active.policyId,
        binding.provenance,
        binding.provenance === 'contact_stage'
          ? binding.stageInstallationId!.trim()
          : null,
        stage ? stage.scanId : null,
        stage ? String(stage.sourceFileRowNumber) : null,
        stage ? stage.policyId : null,
        input.policy.releaseId ?? null,
        documentHash(input.policy),
        binding.provenance === 'contact_stage'
          ? stageContentHash(binding.key, stage!.listing)
          : keyedHash(binding.key, binding.fileRow),
        reviewedHash(binding.key, reviewed),
        JSON.stringify(
          fieldHashes(binding.key, {
            name: active.listing.name,
            category: active.listing.category,
            point: active.listing.location,
            address: reviewed.address,
            website: reviewed.website,
            phone: reviewed.phone,
            attribution: reviewed.attribution,
            notices: reviewed.notices,
            termsUrls: reviewed.termsUrls,
          })
        ),
        containment.changeToken,
      ]
    );
    await manager.query(
      `INSERT INTO "directory_reviewed_binding_event" ("bindingId","kind","cause","decisionId") VALUES ($1,'published','publication',$2)`,
      [created.id, decision.id]
    );
    return {
      bindingId: created.id as string,
      decisionId: decision.id as string,
    };
  });
  return {
    candidateId: input.candidateId,
    status: 'published',
    scanId: active.scanId,
    row: active.sourceFileRowNumber,
    bindingId: written.bindingId,
    decisionId: written.decisionId,
  };
}
