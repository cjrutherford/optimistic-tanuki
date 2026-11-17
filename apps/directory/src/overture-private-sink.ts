import { unprojectScan, unprojectRow } from './reviewed-spatial';
import { DataSource, EntityManager } from 'typeorm';
import { isIP } from 'node:net';
import { projectPublicOverture } from './overture-public-projection';
import { OvertureRightsPolicy } from './overture-rights';
import {
  insertSourceEvidence,
  SourceEvidenceInput,
} from './source-evidence-store';
import {
  BUSINESS_IDENTITY_KEY_VERSION,
  businessIdentityKeyFromEnv,
  upstreamKeyHash,
} from './business-identity';

type Checkpoint = { scanId: string; sourceFileRowNumber: number };
type Listing = {
  name: string;
  category: string;
  location: { type: 'Point'; coordinates: [number, number] };
  attribution: string[];
  notices: string[];
  termsUrls: string[];
  adult?: boolean;
  assignmentChangeToken?: string;
  addresses?: string[];
  websites?: string[];
  phones?: string[];
};
export interface OverturePrivateSinkOptions {
  /**
   * Retain source contact fields in the private listing. Only enable this for a
   * capture whose policy explicitly approves retain and private display for the
   * address, phone and website fields.
   */
  includeContactFields?: boolean;
  /**
   * Retain the minimal source provenance (dataset, license, optional JSON
   * pointer) needed to re-evaluate rights later. Only enable alongside a policy
   * that approves ingest and retain.
   */
  includeSourceProvenance?: boolean;
  /**
   * Key for the upstream-id hash (DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY when
   * omitted). Without a key no source key is stored and the cohort is origin-only.
   */
  businessIdentityKey?: string;
}
type Row = {
  sourceFileRowNumber: number;
  regionId: string;
  outcome:
    | { status: 'quarantined' }
    | { status: 'eligible'; listing: Listing; upstreamId?: unknown };
};

const TARGET_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validCheckpoint = (value: Checkpoint) =>
  value &&
  /^[a-f0-9]{64}$/.test(value.scanId) &&
  Number.isSafeInteger(value.sourceFileRowNumber) &&
  value.sourceFileRowNumber >= 0;
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((x) => typeof x === 'string');

/** Each instance represents one scan attempt. Reload before attempting recovery. */
export class OverturePrivateSink {
  readonly atomicCommit = true;
  private loaded = false;
  private expected: Checkpoint | null = null;
  private scanId: string | null = null;
  private policyId: string | null = null;

  private async lockPolicy(
    manager: EntityManager,
    policyId: string
  ): Promise<void> {
    await manager.query(
      'INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING',
      [policyId]
    );
    const [policy] = await manager.query(
      'SELECT revoked FROM directory_overture_private_policy WHERE "policyId" = $1 FOR UPDATE',
      [policyId]
    );
    if (policy.revoked) throw Error('Private policy revoked');
  }

  private async lockBoundScan(
    manager: EntityManager,
    scanId: string,
    policyId: string
  ): Promise<void> {
    await this.lockPolicy(manager, policyId);
    await manager.query(
      'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId" = $1 FOR UPDATE',
      [scanId]
    );
    const [binding] = await manager.query(
      'SELECT "policyId" FROM directory_overture_private_membership WHERE "scanId" = $1',
      [scanId]
    );
    if (!binding || binding.policyId !== policyId)
      throw Error('Scan not bound to policy');
    if (
      (
        await manager.query(
          'SELECT 1 FROM directory_overture_private_revocation WHERE "scanId" = $1',
          [scanId]
        )
      ).length
    )
      throw Error('Private scan revoked');
  }
  constructor(
    private readonly dataSource: DataSource,
    private readonly options: OverturePrivateSinkOptions = {}
  ) {}

  /** Local operator workflow only. The caller must authenticate the reviewer and evidence. */
  async attachLocalReviewedFields(
    rowNumber: number,
    source: Parameters<typeof projectPublicOverture>[0],
    policy: OvertureRightsPolicy,
    review: {
      evidenceUrl: string;
      nonResidential: boolean;
      nonSensitive: boolean;
      nonAdult: boolean;
      websiteVerified?: boolean;
      phoneVerified?: boolean;
      addressVerified?: boolean;
      assignmentChangeToken?: string;
    },
    transactionManager?: EntityManager
  ): Promise<void> {
    if (
      !this.loaded ||
      !this.scanId ||
      !this.policyId ||
      !Number.isSafeInteger(rowNumber) ||
      rowNumber < 0 ||
      !review ||
      !['nonResidential', 'nonSensitive', 'nonAdult'].every(
        (k) =>
          Object.prototype.hasOwnProperty.call(review, k) &&
          (review as any)[k] === true
      )
    )
      throw Error('Invalid local review');
    if (
      review.assignmentChangeToken !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        review.assignmentChangeToken
      )
    )
      throw Error('Invalid assignment token');
    let evidence: URL;
    try {
      evidence = new URL(review.evidenceUrl);
    } catch {
      throw Error('Invalid review evidence');
    }
    const host = evidence.hostname.toLowerCase().replace(/\.$/, '');
    if (
      !['https:', 'http:'].includes(evidence.protocol) ||
      evidence.username ||
      evidence.password ||
      !host.includes('.') ||
      isIP(host.replace(/^\[|\]$/g, '')) ||
      /(?:^|\.)(localhost|local|internal)$/.test(host)
    )
      throw Error('Invalid review evidence');
    const own = (
      key: 'websiteVerified' | 'phoneVerified' | 'addressVerified'
    ) =>
      Object.prototype.hasOwnProperty.call(review, key) && review[key] === true;
    const projection = projectPublicOverture(
      source,
      {
        residential: false,
        sensitive: false,
        adult: false,
        websiteVerified: own('websiteVerified'),
        phoneVerified: own('phoneVerified'),
        addressVerified: own('addressVerified'),
      },
      policy,
      false
    );
    if (projection.status !== 'eligible')
      throw Error('Source rights unavailable');
    const value = projection.listing,
      scanId = this.scanId,
      policyId = this.policyId;
    const attach = async (manager: EntityManager) => {
      await this.lockBoundScan(manager, scanId, policyId);
      if (
        (
          await manager.query(
            'SELECT 1 FROM directory_overture_private_row_revocation WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
            [scanId, rowNumber]
          )
        ).length
      )
        throw Error('Row revoked');
      const rows = await manager.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 FOR UPDATE',
        [scanId, rowNumber]
      );
      const old = rows[0]?.listing;
      if (
        rows.length !== 1 ||
        old?.name !== value.name ||
        old?.category !== value.category ||
        old?.location?.type !== value.location.type ||
        !Array.isArray(old?.location?.coordinates) ||
        old.location.coordinates.length !== 2 ||
        old.location.coordinates[0] !== value.location.coordinates[0] ||
        old.location.coordinates[1] !== value.location.coordinates[1]
      )
        throw Error('Reviewed source mismatch');
      if (
        review.assignmentChangeToken &&
        old.assignmentChangeToken &&
        old.assignmentChangeToken !== review.assignmentChangeToken
      )
        throw Error('Reviewed assignment changed');
      const reviewed = {
        ...(value.website ? { website: value.website } : {}),
        ...(value.phone ? { phone: value.phone } : {}),
        ...(value.address ? { address: value.address } : {}),
        attribution: value.attribution,
        notices: value.notices,
        termsUrls: value.termsUrls,
        evidenceUrl: evidence.href,
      };
      await manager.query(
        'UPDATE directory_overture_private_row SET listing=$3::jsonb WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
        [
          scanId,
          rowNumber,
          JSON.stringify({
            ...old,
            ...(review.assignmentChangeToken
              ? { assignmentChangeToken: review.assignmentChangeToken }
              : {}),
            reviewed,
          }),
        ]
      );
    };
    if (transactionManager) await attach(transactionManager);
    else await this.dataSource.transaction(attach);
  }

  /**
   * `regionIds` are the policy's target regions (Social community ids). Each uuid-shaped one is recorded as a
   * `recorded` town scan target in the same transaction that binds the scan; other ids are skipped. Idempotent.
   */
  async load(
    scanId: string,
    policyId: string,
    regionIds: readonly string[] = []
  ): Promise<Checkpoint | null> {
    this.loaded = false;
    const targets = [
      ...new Set(
        (Array.isArray(regionIds) ? regionIds : [])
          .filter((id) => typeof id === 'string' && TARGET_UUID.test(id))
          .map((id) => id.toLowerCase())
      ),
    ];
    if (
      typeof scanId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(scanId) ||
      typeof policyId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(policyId)
    )
      throw Error('Invalid scan or policy');
    const checkpoint = await this.dataSource.transaction(async (manager) => {
      await this.lockPolicy(manager, policyId);
      const inserted = await manager.query(
        'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING RETURNING "scanId"',
        [scanId]
      );
      await manager.query(
        'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId" = $1 FOR UPDATE',
        [scanId]
      );
      if (
        (
          await manager.query(
            'SELECT 1 FROM directory_overture_private_revocation WHERE "scanId" = $1',
            [scanId]
          )
        ).length
      )
        throw Error('Private scan revoked');
      const [binding] = await manager.query(
        'SELECT "policyId" FROM directory_overture_private_membership WHERE "scanId" = $1',
        [scanId]
      );
      if (binding && binding.policyId !== policyId)
        throw Error('Scan already bound to another policy');
      if (!binding) {
        if (
          !inserted.length ||
          (
            await manager.query(
              `SELECT 1 FROM directory_overture_private_checkpoint WHERE "scanId" = $1 UNION ALL SELECT 1 FROM directory_overture_private_row WHERE "scanId" = $1 UNION ALL SELECT 1 FROM directory_overture_private_completion WHERE "scanId" = $1 UNION ALL SELECT 1 FROM directory_overture_private_row_revocation WHERE "scanId" = $1 LIMIT 1`,
              [scanId]
            )
          ).length
        )
          throw Error('Legacy unbound scan');
        const [{ count }] = await manager.query(
          'SELECT count(*)::int AS count FROM directory_overture_private_membership WHERE "policyId" = $1',
          [policyId]
        );
        if (count >= 10000) throw Error('Private policy scan limit reached');
        await manager.query(
          'INSERT INTO directory_overture_private_membership ("scanId", "policyId") VALUES ($1, $2)',
          [scanId, policyId]
        );
      }
      if (targets.length)
        await manager.query(
          `INSERT INTO directory_town_scan_target ("communityId","scanId",provenance)
           SELECT t,$1,'recorded' FROM unnest($2::uuid[]) AS t ON CONFLICT DO NOTHING`,
          [scanId, targets]
        );
      const rows = await manager.query(
        'SELECT "scanId", "sourceFileRowNumber" FROM directory_overture_private_checkpoint WHERE "scanId" = $1',
        [scanId]
      );
      return rows.length
        ? {
            scanId: rows[0].scanId,
            sourceFileRowNumber: Number(rows[0].sourceFileRowNumber),
          }
        : null;
    });
    if (checkpoint && !validCheckpoint(checkpoint))
      throw Error('Invalid durable checkpoint');
    this.expected = checkpoint;
    this.scanId = scanId;
    this.policyId = policyId;
    this.loaded = true;
    return checkpoint && { ...checkpoint };
  }

  async isComplete(scanId: string): Promise<boolean> {
    if (typeof scanId !== 'string' || !/^[a-f0-9]{64}$/.test(scanId))
      throw Error('Invalid scan');
    if (!this.loaded || this.scanId !== scanId || !this.policyId)
      throw Error('Scan not loaded');
    const expected = this.expected;
    return this.dataSource.transaction(async (manager) => {
      await this.lockBoundScan(manager, scanId, this.policyId!);
      if (expected !== undefined) {
        const current = await manager.query(
          'SELECT "scanId", "sourceFileRowNumber" FROM directory_overture_private_checkpoint WHERE "scanId" = $1',
          [scanId]
        );
        if (
          expected
            ? current.length !== 1 ||
              current[0].scanId !== expected.scanId ||
              current[0].sourceFileRowNumber !==
                String(expected.sourceFileRowNumber)
            : current.length !== 0
        )
          throw Error('Stale private scan checkpoint');
      }
      return (
        (
          await manager.query(
            'SELECT 1 FROM directory_overture_private_completion WHERE "scanId" = $1',
            [scanId]
          )
        ).length > 0
      );
    });
  }

  /** Mark exhaustion only if this attempt still owns the current checkpoint. */
  async complete(evidence?: SourceEvidenceInput | null): Promise<void> {
    if (!this.loaded || !this.scanId) throw Error('Scan not loaded');
    const scanId = this.scanId,
      expected = this.expected && { ...this.expected };
    await this.dataSource.transaction(async (manager) => {
      await this.lockBoundScan(manager, scanId, this.policyId!);
      const current = await manager.query(
        'SELECT "scanId", "sourceFileRowNumber" FROM directory_overture_private_checkpoint WHERE "scanId" = $1 FOR UPDATE',
        [scanId]
      );
      if (
        expected
          ? current.length !== 1 ||
            current[0].scanId !== expected.scanId ||
            current[0].sourceFileRowNumber !==
              String(expected.sourceFileRowNumber)
          : current.length !== 0
      )
        throw Error('Stale private scan checkpoint');
      await manager.query(
        'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
        [scanId]
      );
      // Same transaction: the recorded targets learn how many rows the scan produced for them.
      await manager.query(
        `UPDATE directory_town_scan_target t SET "completedAt"=now(),
           "rowCount"=(SELECT count(*)::int FROM directory_overture_private_row r WHERE r."scanId"=t."scanId" AND lower(r."regionId")=t."communityId"::text)
         WHERE t."scanId"=$1 AND t.provenance='recorded' AND t."completedAt" IS NULL`,
        [scanId]
      );
      // Same transaction: a completion either has its evidence or provably has none.
      await insertSourceEvidence(manager, scanId, evidence);
    });
  }

  /** Withdraw the active scan, or preemptively revoke an ID before its first commit. */
  async withdraw(scanId: string): Promise<void> {
    if (typeof scanId !== 'string' || !/^[a-f0-9]{64}$/.test(scanId))
      throw Error('Invalid scan');
    await this.dataSource.transaction(async (manager) => {
      const [binding] = await manager.query(
        'SELECT "policyId" FROM directory_overture_private_membership WHERE "scanId" = $1',
        [scanId]
      );
      if (binding) await this.lockPolicy(manager, binding.policyId);
      await manager.query(
        'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
        [scanId]
      );
      await manager.query(
        'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId" = $1 FOR UPDATE',
        [scanId]
      );
      if (
        !binding &&
        (
          await manager.query(
            'SELECT 1 FROM directory_overture_private_membership WHERE "scanId" = $1',
            [scanId]
          )
        ).length
      )
        throw Error('Scan registered concurrently; retry withdrawal');
      await manager.query(
        'INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
        [scanId]
      );
      await unprojectScan(manager, scanId);
      await manager.query(
        'DELETE FROM directory_overture_source_key WHERE "scanId" = $1',
        [scanId]
      );
      await manager.query(
        'DELETE FROM directory_overture_private_row WHERE "scanId" = $1',
        [scanId]
      );
      await manager.query(
        'DELETE FROM directory_overture_private_completion WHERE "scanId" = $1',
        [scanId]
      );
      await manager.query(
        'DELETE FROM directory_overture_source_evidence WHERE "scanId" = $1',
        [scanId]
      );
      await manager.query(
        'DELETE FROM directory_overture_private_checkpoint WHERE "scanId" = $1',
        [scanId]
      );
    });
    if (this.scanId === scanId) this.loaded = false;
  }

  /** Revoke first; bounded, restartable cleanup never reauthorizes the cohort. */
  async withdrawPolicy(
    policyId: string,
    options: { maxBatches?: number } = {}
  ): Promise<{ complete: boolean }> {
    if (typeof policyId !== 'string' || !/^[a-f0-9]{64}$/.test(policyId))
      throw Error('Invalid policy');
    const maxBatches = options.maxBatches ?? 32;
    if (!Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > 64)
      throw Error('Invalid withdrawal batch limit');
    await this.dataSource.transaction(async (manager) => {
      await manager.query("SET LOCAL lock_timeout = '2s'");
      await manager.query("SET LOCAL statement_timeout = '5s'");
      await manager.query(
        'INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING',
        [policyId]
      );
      await manager.query(
        'SELECT "policyId" FROM directory_overture_private_policy WHERE "policyId" = $1 FOR UPDATE',
        [policyId]
      );
      await manager.query(
        'UPDATE directory_overture_private_policy SET revoked = true WHERE "policyId" = $1',
        [policyId]
      );
    });
    const deadline = Date.now() + 5000;
    for (let i = 0; i < maxBatches && Date.now() < deadline; i++) {
      const complete = await this.dataSource.transaction(async (manager) => {
        await manager.query("SET LOCAL lock_timeout = '2s'");
        await manager.query("SET LOCAL statement_timeout = '5s'");
        const policies = await manager.query(
          'SELECT "policyId",revoked FROM directory_overture_private_policy WHERE "policyId" = $1 FOR UPDATE',
          [policyId]
        );
        if (policies.length !== 1 || policies[0].revoked !== true)
          throw Error('Policy revocation unavailable');
        const scans = await manager.query(
          `SELECT m."scanId" FROM directory_overture_private_membership m WHERE m."policyId"=$1 AND (
          EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=m."scanId") OR
          EXISTS (SELECT 1 FROM directory_overture_private_row_revocation r WHERE r."scanId"=m."scanId") OR
          EXISTS (SELECT 1 FROM directory_overture_source_key r WHERE r."scanId"=m."scanId") OR
          EXISTS (SELECT 1 FROM directory_overture_private_checkpoint r WHERE r."scanId"=m."scanId") OR
          EXISTS (SELECT 1 FROM directory_overture_private_completion r WHERE r."scanId"=m."scanId")) ORDER BY m."scanId" LIMIT 1`,
          [policyId]
        );
        if (!scans.length) return true;
        const scanId = scans[0].scanId;
        const locks = await manager.query(
          'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId"=$1 FOR UPDATE',
          [scanId]
        );
        if (locks.length !== 1) throw Error('Policy scan lock unavailable');
        const removed = await manager.query(
          `WITH batch AS (SELECT "scanId","sourceFileRowNumber" FROM directory_overture_private_row WHERE "scanId"=$1 ORDER BY "sourceFileRowNumber" LIMIT 500), unkeyed AS (DELETE FROM directory_overture_source_key k USING batch WHERE k."scanId"=batch."scanId" AND k."sourceFileRowNumber"=batch."sourceFileRowNumber" RETURNING 1), unprojected AS (DELETE FROM directory_reviewed_spatial p USING batch WHERE p."scanId"=batch."scanId" AND p."sourceFileRowNumber"=batch."sourceFileRowNumber" RETURNING 1), deleted AS (DELETE FROM directory_overture_private_row r USING batch WHERE r."scanId"=batch."scanId" AND r."sourceFileRowNumber"=batch."sourceFileRowNumber" RETURNING 1) SELECT count(*)::int AS n FROM deleted`,
          [scanId]
        );
        if (removed[0].n > 0) return false;
        // Keys of withdrawn rows outlive their row; they go with the scan, in bounded batches.
        const keys = await manager.query(
          `WITH batch AS (SELECT "scanId","sourceFileRowNumber" FROM directory_overture_source_key WHERE "scanId"=$1 ORDER BY "sourceFileRowNumber" LIMIT 500), deleted AS (DELETE FROM directory_overture_source_key k USING batch WHERE k."scanId"=batch."scanId" AND k."sourceFileRowNumber"=batch."sourceFileRowNumber" RETURNING 1) SELECT count(*)::int AS n FROM deleted`,
          [scanId]
        );
        if (keys[0].n > 0) return false;
        const revoked = await manager.query(
          `WITH batch AS (SELECT "scanId","sourceFileRowNumber" FROM directory_overture_private_row_revocation WHERE "scanId"=$1 ORDER BY "sourceFileRowNumber" LIMIT 500), deleted AS (DELETE FROM directory_overture_private_row_revocation r USING batch WHERE r."scanId"=batch."scanId" AND r."sourceFileRowNumber"=batch."sourceFileRowNumber" RETURNING 1) SELECT count(*)::int AS n FROM deleted`,
          [scanId]
        );
        if (revoked[0].n > 0) return false;
        await manager.query(
          'DELETE FROM directory_overture_private_completion WHERE "scanId"=$1',
          [scanId]
        );
        await manager.query(
          'DELETE FROM directory_overture_source_evidence WHERE "scanId"=$1',
          [scanId]
        );
        await manager.query(
          'DELETE FROM directory_overture_private_checkpoint WHERE "scanId"=$1',
          [scanId]
        );
        return false;
      });
      if (complete) return { complete: true };
    }
    return { complete: false };
  }

  /** Revoke a row, including before it has been ingested. */
  async withdrawRow(
    scanId: string,
    sourceFileRowNumber: number
  ): Promise<void> {
    if (
      typeof scanId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(scanId) ||
      !Number.isSafeInteger(sourceFileRowNumber) ||
      sourceFileRowNumber < 0
    )
      throw Error('Invalid scan or row');
    await this.dataSource.transaction(async (manager) => {
      const [binding] = await manager.query(
        'SELECT "policyId" FROM directory_overture_private_membership WHERE "scanId" = $1',
        [scanId]
      );
      if (!binding) throw Error('Scan not bound to policy');
      await this.lockPolicy(manager, binding.policyId);
      await manager.query(
        'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
        [scanId]
      );
      await manager.query(
        'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId" = $1 FOR UPDATE',
        [scanId]
      );
      await manager.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId", "sourceFileRowNumber") VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [scanId, sourceFileRowNumber]
      );
      await unprojectRow(manager, scanId, sourceFileRowNumber);
      await manager.query(
        'DELETE FROM directory_overture_private_row WHERE "scanId" = $1 AND "sourceFileRowNumber" = $2',
        [scanId, sourceFileRowNumber]
      );
    });
  }

  async commit(rows: Row[], next: Checkpoint): Promise<void> {
    if (
      !this.loaded ||
      !validCheckpoint(next) ||
      !Array.isArray(rows) ||
      !rows.length
    )
      throw Error('Invalid checkpoint or batch');
    next = { ...next };
    const expected = this.expected && { ...this.expected };
    if (this.scanId !== next.scanId) throw Error('Mismatched scan');
    let last = expected?.sourceFileRowNumber ?? -1;
    // Null (not an error) when no key is configured: that cohort is origin-only. An invalid key still throws.
    const identityKey =
      this.options.businessIdentityKey ?? businessIdentityKeyFromEnv();
    const sourceKeys = new Map<number, string>();
    const projected = rows.map((row) => {
      if (
        !row ||
        !Number.isSafeInteger(row.sourceFileRowNumber) ||
        row.sourceFileRowNumber <= last ||
        typeof row.regionId !== 'string' ||
        !row.regionId ||
        !row.outcome
      )
        throw Error('Invalid row');
      last = row.sourceFileRowNumber;
      if (row.outcome.status === 'quarantined')
        return [next.scanId, last, null, null];
      if (row.outcome.status !== 'eligible') throw Error('Invalid outcome');
      const l = row.outcome.listing;
      const c = l?.location?.coordinates;
      if (
        !l ||
        typeof l.name !== 'string' ||
        !l.name.trim() ||
        typeof l.category !== 'string' ||
        !l.category.trim() ||
        l.location?.type !== 'Point' ||
        !Array.isArray(c) ||
        c.length !== 2 ||
        !c.every(Number.isFinite) ||
        c[0] < -180 ||
        c[0] > 180 ||
        c[1] < -90 ||
        c[1] > 90 ||
        !strings(l.attribution) ||
        !l.attribution.length ||
        !strings(l.notices) ||
        !strings(l.termsUrls)
      )
        throw Error('Invalid listing');
      // Copy only the fields approved by the private projector, never arbitrary source data.
      const listing = {
        name: l.name,
        category: l.category,
        location: { type: 'Point', coordinates: [c[0], c[1]] },
        attribution: l.attribution,
        notices: l.notices,
        termsUrls: l.termsUrls,
      };
      if (l.adult === true) Object.assign(listing, { adult: true });
      if (l.assignmentChangeToken !== undefined) {
        if (
          typeof l.assignmentChangeToken !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            l.assignmentChangeToken
          )
        )
          throw Error('Invalid assignment token');
        Object.assign(listing, {
          assignmentChangeToken: l.assignmentChangeToken,
        });
      }
      if (this.options.includeContactFields === true) {
        const contact = (key: 'addresses' | 'websites' | 'phones') => {
          const value = (l as Listing)[key];
          if (value === undefined) return undefined;
          if (
            !Array.isArray(value) ||
            value.length > 20 ||
            !value.every(
              (entry) =>
                typeof entry === 'string' &&
                entry.trim().length > 0 &&
                entry.length <= 2048
            )
          )
            throw Error('Invalid private contact fields');
          return value.length ? [...value] : undefined;
        };
        const addresses = contact('addresses');
        const websites = contact('websites');
        const phones = contact('phones');
        if (addresses) Object.assign(listing, { addresses });
        if (websites) Object.assign(listing, { websites });
        if (phones) Object.assign(listing, { phones });
      }
      if (this.options.includeSourceProvenance === true) {
        const provenance = (l as any).sources;
        if (provenance !== undefined) {
          if (
            !Array.isArray(provenance) ||
            provenance.length > 20 ||
            !provenance.every(
              (source: any) =>
                source &&
                typeof source === 'object' &&
                !Array.isArray(source) &&
                typeof source.dataset === 'string' &&
                source.dataset.trim().length > 0 &&
                source.dataset.length <= 200 &&
                typeof source.license === 'string' &&
                source.license.trim().length > 0 &&
                source.license.length <= 200 &&
                (source.property === undefined ||
                  (typeof source.property === 'string' &&
                    source.property.length <= 500 &&
                    (source.property === '' ||
                      source.property.startsWith('/'))))
            )
          ) {
            throw Error('Invalid private source provenance');
          }
          Object.assign(listing, {
            sources: provenance.map((source: any) => ({
              ...(source.property !== undefined
                ? { property: source.property }
                : {}),
              dataset: source.dataset,
              license: source.license,
            })),
          });
        }
      }
      // The upstream id never enters `listing`; only its keyed hash is kept, and only for a usable id.
      const keyHash = identityKey
        ? upstreamKeyHash(identityKey, row.outcome.upstreamId)
        : null;
      if (keyHash) sourceKeys.set(last, keyHash);
      return [next.scanId, last, row.regionId, JSON.stringify(listing)];
    });
    if (last !== next.sourceFileRowNumber)
      throw Error('Checkpoint does not match batch');
    await this.dataSource.transaction(async (manager) => {
      // Also serializes creation of the first checkpoint, when no row exists to lock.
      await this.lockBoundScan(manager, next.scanId, this.policyId!);
      if (
        (
          await manager.query(
            'SELECT 1 FROM directory_overture_private_completion WHERE "scanId" = $1',
            [next.scanId]
          )
        ).length
      )
        throw Error('Private scan complete');
      const current = await manager.query(
        'SELECT "scanId", "sourceFileRowNumber" FROM directory_overture_private_checkpoint WHERE "scanId" = $1 FOR UPDATE',
        [next.scanId]
      );
      if (
        expected
          ? current.length !== 1 ||
            current[0].scanId !== expected.scanId ||
            current[0].sourceFileRowNumber !==
              String(expected.sourceFileRowNumber)
          : current.length !== 0
      )
        throw Error('Stale private scan checkpoint');
      for (const row of projected) {
        // The scan lock serializes this check with row withdrawal. A revoked row
        // stays absent while the checkpoint advances atomically past it.
        if (
          !(
            await manager.query(
              'SELECT 1 FROM directory_overture_private_row_revocation WHERE "scanId" = $1 AND "sourceFileRowNumber" = $2',
              [row[0], row[1]]
            )
          ).length
        ) {
          await manager.query(
            'INSERT INTO directory_overture_private_row ("scanId", "sourceFileRowNumber", "regionId", listing) VALUES ($1, $2, $3, $4::jsonb)',
            row
          );
          const keyHash = sourceKeys.get(row[1] as number);
          if (keyHash)
            await manager.query(
              'INSERT INTO directory_overture_source_key ("scanId", "sourceFileRowNumber", "upstreamKeyHash", "keyVersion") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
              [row[0], row[1], keyHash, BUSINESS_IDENTITY_KEY_VERSION]
            );
        }
      }
      await manager.query(
        'INSERT INTO directory_overture_private_checkpoint ("scanId", "sourceFileRowNumber") VALUES ($1, $2) ON CONFLICT ("scanId") DO UPDATE SET "sourceFileRowNumber" = EXCLUDED."sourceFileRowNumber"',
        [next.scanId, next.sourceFileRowNumber]
      );
    });
    this.expected = { ...next };
  }
}
