import { DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '../../../libs/constants/src/lib/libs/directory';

/**
 * Export capture for the Directory account lifecycle.
 *
 * Structurally the same as `AccountExportPostgresSource` in `libs/storage`; it
 * is declared here so this module needs no workspace path alias and can be
 * loaded by the plain node test runner.
 *
 * Scope rules are the ones erase uses: a row belongs to the account only when
 * the identifier matches in the domain its column is known to hold (account id
 * in `ownerId` and in `actorDomain='account'` events, a current profile id in
 * the profile columns and in `actorDomain='profile'` events). Any other match of
 * the account or a current profile id is ambiguous. Ambiguous rows are never
 * exported; they are counted in the coverage row, which marks the receipt
 * incomplete. Identifier columns themselves are never exported.
 *
 * Every source query takes ($1 account id, $2 cursor, $3 limit) and pages by a
 * text `id` in "C" collation. `profileTable` is the temp table of current
 * profile ids the shared capture service fills from the Profile snapshot.
 */
export interface DirectoryExportSource {
  source: (typeof DIRECTORY_ACCOUNT_EXPORT_CAPTURE_SOURCES)[number];
  sql: string;
  project(
    row: Record<string, unknown>,
    accountId: string
  ): Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string => {
  if (typeof value !== 'string' || !UUID.test(value))
    throw Error('DIRECTORY_EXPORT_INVALID_ID');
  return value.toLowerCase();
};
const text = (value: unknown, max: number, nullable = false): string | null => {
  if (value == null && nullable) return null;
  if (typeof value !== 'string' || Array.from(value).length > max)
    throw Error('DIRECTORY_EXPORT_INVALID_TEXT');
  return value;
};
const timestamp = (value: unknown, nullable = false): string | null => {
  if (value == null && nullable) return null;
  if (typeof value !== 'string' || value.length > 40)
    throw Error('DIRECTORY_EXPORT_INVALID_TIMESTAMP');
  const date = new Date(
    /[zZ]|[+-]\d\d(:?\d\d)?$/.test(value)
      ? value.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')
      : `${value.replace(' ', 'T')}Z`
  );
  if (!Number.isFinite(date.getTime()))
    throw Error('DIRECTORY_EXPORT_INVALID_TIMESTAMP');
  return date.toISOString();
};
const url = (value: unknown) => text(value, 8192, true);
const enumValue = (value: unknown, allowed: readonly string[]): string => {
  if (typeof value !== 'string' || !allowed.includes(value))
    throw Error('DIRECTORY_EXPORT_UNKNOWN_ENUM');
  return value;
};
const jsonObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('DIRECTORY_EXPORT_INVALID_JSON');
  if (JSON.stringify(value).length > 65536)
    throw Error('DIRECTORY_EXPORT_INVALID_JSON');
  return value as Record<string, unknown>;
};

const page = (select: string, from: string, where: string, key: string) =>
  `SELECT ${select} FROM ${from} WHERE ${where} AND ${key}::text COLLATE "C" > $2::text COLLATE "C" ORDER BY ${key}::text COLLATE "C" LIMIT $3`;

export function createDirectoryAccountExportSources(
  profileTable: string
): DirectoryExportSource[] {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(profileTable))
    throw Error('DIRECTORY_EXPORT_INVALID_PROFILE_TABLE');
  const profiles = `SELECT id FROM "${profileTable}"`;
  const owned = `SELECT "requestId" FROM directory_business_link_request WHERE "ownerId"=$1::uuid`;
  const withheld = [
    // An owner column holding a current profile id.
    `(SELECT count(*) FROM directory_business_link_request WHERE "ownerId" IN (${profiles}))`,
    // Link events whose actor matches a scope identifier outside its recorded domain, or with none.
    `(SELECT count(*) FROM directory_business_link_event WHERE ("actorId"=$1::uuid OR "actorId" IN (${profiles})) AND (("actorDomain"='account' AND "actorId"=$1::uuid) OR ("actorDomain"='profile' AND "actorId" IN (${profiles}))) IS NOT TRUE)`,
    // The account id in a profile column.
    `(SELECT count(*) FROM directory_boundary_decision WHERE "reviewerId"=$1::uuid)`,
    `(SELECT count(*) FROM directory_address_review_decision WHERE "actorId"=$1::uuid)`,
  ].join(' + ');
  return [
    {
      source: 'DirectoryBusinessLinkRequest',
      sql: page(
        `r."requestId"::text AS id,r."townId"::text AS "townId",r."listingId"::text AS "listingId",r."businessCommunityId"::text AS "businessCommunityId",r.status,r."createdAt"::text AS "createdAt"`,
        'directory_business_link_request r',
        'r."ownerId"=$1::uuid',
        'r."requestId"'
      ),
      project: (row) => ({
        id: id(row['id']),
        townId: id(row['townId']),
        listingId: id(row['listingId']),
        businessCommunityId: id(row['businessCommunityId']),
        status: enumValue(row['status'], [
          'pending',
          'approved',
          'rejected',
          'revoked',
        ]),
        createdAt: timestamp(row['createdAt']),
      }),
    },
    {
      source: 'DirectoryBusinessLinkEvent',
      sql: page(
        `e.id::text AS id,CASE WHEN e."requestId" IN (${owned}) THEN e."requestId"::text END AS "requestId",e.action,e."actorDomain",e."evidenceUrl",e."createdAt"::text AS "createdAt"`,
        'directory_business_link_event e',
        `(e."requestId" IN (${owned}) OR (e."actorDomain"='account' AND e."actorId"=$1::uuid) OR (e."actorDomain"='profile' AND e."actorId" IN (${profiles})))`,
        'e.id'
      ),
      project: (row) => ({
        id: id(row['id']),
        // Only the owner's own requests are named; a decision on someone else's request carries none.
        requestId: row['requestId'] == null ? null : id(row['requestId']),
        action: enumValue(row['action'], [
          'request',
          'approve',
          'reject',
          'revoke',
          'carry_pending',
          'carry_restore',
          'carry_confirm',
          'carry_close',
        ]),
        // The domain says whether the actor was an account, a profile or the system; never who.
        actorDomain:
          row['actorDomain'] == null
            ? null
            : enumValue(row['actorDomain'], ['account', 'profile', 'system']),
        evidenceUrl: url(row['evidenceUrl']),
        createdAt: timestamp(row['createdAt']),
      }),
    },
    {
      source: 'DirectoryBoundaryDecision',
      sql: page(
        `d."requestId"::text AS id,d."communityId"::text AS "communityId",d.decision,d."sourceUrl",d."createdAt"::text AS "createdAt"`,
        'directory_boundary_decision d',
        `$1::uuid IS NOT NULL AND d."reviewerId" IN (${profiles})`,
        'd."requestId"'
      ),
      project: (row) => ({
        id: id(row['id']),
        communityId: id(row['communityId']),
        decision: text(row['decision'], 64),
        sourceUrl: url(row['sourceUrl']),
        createdAt: timestamp(row['createdAt']),
      }),
    },
    {
      source: 'DirectoryAddressReviewDecision',
      sql: page(
        `a.id::text AS id,a."candidateId"::text AS "candidateId",a."actorKind",a.decision,a.reason,a.checks,a."evidenceUrl",a."evidenceHash",a."policyVersion",a."createdAt"::text AS "createdAt",a."appliedAt"::text AS "appliedAt"`,
        'directory_address_review_decision a',
        `$1::uuid IS NOT NULL AND a."actorId" IN (${profiles})`,
        'a.id'
      ),
      project: (row) => ({
        id: id(row['id']),
        candidateId: id(row['candidateId']),
        actorKind: text(row['actorKind'], 64),
        decision: text(row['decision'], 64),
        reason: text(row['reason'], 4096, true),
        checks: jsonObject(row['checks']),
        evidenceUrl: url(row['evidenceUrl']),
        evidenceHash: text(row['evidenceHash'], 128, true),
        policyVersion: text(row['policyVersion'], 64, true),
        createdAt: timestamp(row['createdAt']),
        appliedAt: timestamp(row['appliedAt'], true),
      }),
    },
    {
      source: 'DirectoryExportCoverage',
      sql: `SELECT 'coverage' AS id,(${withheld})::text AS withheld WHERE 'coverage' COLLATE "C" > $2::text COLLATE "C" LIMIT $3`,
      project: (row) => {
        const withheldRows = row['withheld'];
        if (typeof withheldRows !== 'string' || !/^\d{1,9}$/.test(withheldRows))
          throw Error('DIRECTORY_EXPORT_INVALID_COUNT');
        const count = Number(withheldRows);
        // Counts only: the rows themselves and their identifiers are not described.
        return {
          id: 'coverage',
          withheldAmbiguousRows: count,
          complete: count === 0,
        };
      },
    },
  ];
}
