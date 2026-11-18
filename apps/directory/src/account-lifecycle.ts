import {
  validateDeletionGrantShape,
  validateDeletionIdentityDomains,
} from '../../../libs/models/src/lib/libs/account-deletion/account-deletion.contract';
import { installDeletionWriteFence } from '../../../libs/storage/src/lib/account-deletion-write-fence';
import {
  DIRECTORY_ACCOUNT_LIFECYCLE_INVENTORY,
  validateDirectoryPhysicalCatalog,
} from './account-lifecycle-dispositions';

/**
 * Directory participant for account deletion (fence / erase / readback).
 *
 * Disposition is N04-style: history rows are kept, matched identities are
 * cleared, and free-form fields the actor supplied are cleared with them.
 * Directory's identity columns are bare UUIDs written from two domains
 * (account ids and profile ids), so a match is erased only when the column's
 * domain is known and equals the domain of the matched identifier. Every other
 * match is reported as blocked and nothing is erased.
 */
export const DIRECTORY_DELETION_OWNER = 'directory' as const;
export type DirectoryDeletionAction = 'fence' | 'erase' | 'readback';
const ACTIONS: readonly string[] = ['fence', 'erase', 'readback'];
export const DIRECTORY_DELETION_ROW_LIMIT = 10000;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_ANY_CASE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Manager = { query(sql: string, params?: unknown[]): Promise<any[]> };
export type DirectoryDeletionStore = {
  transaction<T>(work: (manager: any) => Promise<T>): Promise<T>;
};

export interface DirectoryDeletionScope {
  operationId: string;
  accountId: string;
  /** Profiles Authentication established as currently owned by the account. */
  profileIds: readonly string[];
  /** Legacy storage keys. Their namespace is not the profile UUID namespace. */
  legacyProfileIds: readonly string[];
}

export interface DirectoryDeletionReport {
  /** Rows still carrying an identifier in the domain it was written in. */
  remaining: number;
  /** Rows carrying a scope identifier whose domain cannot be established. */
  blocked: number;
}

export interface DirectoryDeletionResult extends DirectoryDeletionReport {
  verified: boolean;
}

/** Structural view of AccountDeletionAuthorityClient. */
export interface DirectoryDeletionAuthority {
  validate(
    value: unknown,
    owner: any,
    action: any
  ): Promise<{ accountId: string; scope: unknown }>;
}

export class DirectoryDeletionBlockedError extends Error {
  constructor(readonly report: DirectoryDeletionReport) {
    super('DIRECTORY_DELETION_BLOCKED_AMBIGUOUS_IDENTITY');
  }
}

/**
 * Columns matched for erasure, with the only domain each may be matched in.
 * `tagged` columns carry their domain per row in another column.
 */
export const DIRECTORY_DELETION_IDENTITIES = Object.freeze({
  directory_business_link_request: [['ownerId', 'account']],
  directory_business_link_event: [['actorId', 'tagged:actorDomain']],
  directory_business_identity_decision: [['actorId', 'tagged:actorDomain']],
  directory_boundary_decision: [['reviewerId', 'profile']],
  directory_address_review_decision: [['actorId', 'profile']],
  directory_rights_event: [['actorId', 'profile']],
  directory_withdrawal_request: [['actorId', 'profile']],
  directory_export_job: [['actorId', 'profile']],
  directory_export_download: [['actorId', 'profile']],
  directory_taxonomy_mapping_version: [['installedById', 'profile']],
  directory_taxonomy_event: [['actorId', 'profile']],
  directory_taxonomy_run: [
    ['actorId', 'profile'],
    ['canceledById', 'profile'],
    ['rollbackById', 'profile'],
  ],
  directory_acquisition_run: [['startedById', 'profile']],
  directory_acquisition_run_event: [['actorId', 'profile']],
  directory_acquisition_town_request: [['actorId', 'profile']],
  directory_operating_control: [['updatedBy', 'profile']],
  directory_operating_control_event: [['actorId', 'profile']],
  directory_duplicate_case_event: [['actorId', 'profile']],
  directory_duplicate_sample: [['createdById', 'profile']],
  directory_duplicate_sample_item: [['judgedById', 'profile']],
  directory_listing_suppression: [
    ['actorId', 'profile'],
    ['liftedById', 'profile'],
  ],
  directory_listing_report: [['decidedById', 'profile']],
} as const);

function count(rows: unknown): number {
  const n = Array.isArray(rows) && rows.length === 1 ? rows[0]?.n : undefined;
  if (
    typeof n !== 'string' ||
    !/^\d+$/.test(n) ||
    Number(n) > DIRECTORY_DELETION_ROW_LIMIT
  )
    throw Error('DIRECTORY_DELETION_ROW_BOUND');
  return Number(n);
}

function canonicalScope(scope: DirectoryDeletionScope) {
  const ok = (id: unknown): id is string =>
    typeof id === 'string' && UUID.test(id);
  if (
    !scope ||
    !ok(scope.operationId) ||
    !ok(scope.accountId) ||
    !Array.isArray(scope.profileIds) ||
    !Array.isArray(scope.legacyProfileIds) ||
    scope.profileIds.length + scope.legacyProfileIds.length > 999 ||
    scope.profileIds.some((id) => !ok(id)) ||
    new Set(scope.profileIds).size !== scope.profileIds.length ||
    scope.profileIds.includes(scope.accountId)
  )
    throw Error('DIRECTORY_DELETION_SCOPE_INVALID');
  const profiles = [...scope.profileIds];
  // Only a UUID-shaped legacy key can equal a Directory column. It is never erased by, only blocked on.
  const legacy = [
    ...new Set(
      scope.legacyProfileIds
        .filter((id) => typeof id === 'string' && UUID_ANY_CASE.test(id))
        .map((id) => id.toLowerCase())
    ),
  ].filter((id) => id !== scope.accountId && !profiles.includes(id));
  return {
    operationId: scope.operationId,
    account: scope.accountId,
    profiles,
    legacy,
    all: [scope.accountId, ...profiles, ...legacy],
  };
}
type Canonical = ReturnType<typeof canonicalScope>;

/** Counts only; never returns row contents or identifiers. */
async function inspect(
  manager: Manager,
  s: Canonical
): Promise<DirectoryDeletionReport> {
  const one = async (sql: string, params: unknown[]) =>
    count(
      await manager.query(`SELECT count(*)::text AS n FROM ${sql}`, params)
    );
  const exact = [
    await one('directory_business_link_request WHERE "ownerId"=$1::uuid', [
      s.account,
    ]),
    await one(
      `directory_business_link_event WHERE ("actorDomain"='account' AND "actorId"=$1::uuid) OR ("actorDomain"='profile' AND "actorId"=ANY($2::uuid[]))`,
      [s.account, s.profiles]
    ),
    await one(
      'directory_boundary_decision WHERE "reviewerId"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one(
      'directory_address_review_decision WHERE "actorId"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one('directory_rights_event WHERE "actorId"=ANY($1::uuid[])', [
      s.profiles,
    ]),
    await one('directory_withdrawal_request WHERE "actorId"=ANY($1::uuid[])', [
      s.profiles,
    ]),
    await one('directory_export_job WHERE "actorId"=ANY($1::uuid[])', [
      s.profiles,
    ]),
    await one('directory_export_download WHERE "actorId"=ANY($1::uuid[])', [
      s.profiles,
    ]),
    await one(
      'directory_taxonomy_mapping_version WHERE "installedById"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one('directory_taxonomy_event WHERE "actorId"=ANY($1::uuid[])', [
      s.profiles,
    ]),
    await one(
      'directory_taxonomy_run WHERE "actorId"=ANY($1::uuid[]) OR "canceledById"=ANY($1::uuid[]) OR "rollbackById"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one('directory_acquisition_run WHERE "startedById"=ANY($1::uuid[])', [
      s.profiles,
    ]),
    await one(
      'directory_acquisition_town_request WHERE "actorId"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one(
      'directory_acquisition_run_event WHERE "actorId"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one('directory_operating_control WHERE "updatedBy"=ANY($1::uuid[])', [
      s.profiles,
    ]),
    await one(
      'directory_operating_control_event WHERE "actorId"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one(
      'directory_duplicate_case_event WHERE "actorId"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one(
      'directory_duplicate_sample WHERE "createdById"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one(
      'directory_duplicate_sample_item WHERE "judgedById"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one(
      `directory_business_identity_decision WHERE ("actorDomain"='account' AND "actorId"=$1::uuid) OR ("actorDomain"='profile' AND "actorId"=ANY($2::uuid[]))`,
      [s.account, s.profiles]
    ),
    await one(
      'directory_listing_suppression WHERE "actorId"=ANY($1::uuid[]) OR "liftedById"=ANY($1::uuid[])',
      [s.profiles]
    ),
    await one('directory_listing_report WHERE "decidedById"=ANY($1::uuid[])', [
      s.profiles,
    ]),
  ];
  // Every match of a scope identifier that the exact-domain rules above do not cover.
  // A legacy NULL domain makes the comparison NULL, so the test is IS NOT TRUE rather than NOT.
  const ambiguous = [
    await one(
      'directory_business_link_request WHERE "ownerId"=ANY($1::uuid[]) AND "ownerId"<>$2::uuid',
      [s.all, s.account]
    ),
    await one(
      `directory_business_link_event WHERE "actorId"=ANY($1::uuid[]) AND (("actorDomain"='account' AND "actorId"=$2::uuid) OR ("actorDomain"='profile' AND "actorId"=ANY($3::uuid[]))) IS NOT TRUE`,
      [s.all, s.account, s.profiles]
    ),
    await one(
      `directory_business_identity_decision WHERE "actorId"=ANY($1::uuid[]) AND (("actorDomain"='account' AND "actorId"=$2::uuid) OR ("actorDomain"='profile' AND "actorId"=ANY($3::uuid[]))) IS NOT TRUE`,
      [s.all, s.account, s.profiles]
    ),
    await one(
      'directory_boundary_decision WHERE "reviewerId"=ANY($1::uuid[]) AND NOT ("reviewerId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_address_review_decision WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_rights_event WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_withdrawal_request WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_export_job WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_export_download WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_taxonomy_mapping_version WHERE "installedById"=ANY($1::uuid[]) AND NOT ("installedById"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_taxonomy_event WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_taxonomy_run WHERE ("actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))) OR ("canceledById"=ANY($1::uuid[]) AND NOT ("canceledById"=ANY($2::uuid[]))) OR ("rollbackById"=ANY($1::uuid[]) AND NOT ("rollbackById"=ANY($2::uuid[])))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_acquisition_run WHERE "startedById"=ANY($1::uuid[]) AND NOT ("startedById"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_acquisition_town_request WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_acquisition_run_event WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_operating_control WHERE "updatedBy"=ANY($1::uuid[]) AND NOT ("updatedBy"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_operating_control_event WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_duplicate_case_event WHERE "actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_duplicate_sample WHERE "createdById"=ANY($1::uuid[]) AND NOT ("createdById"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_duplicate_sample_item WHERE "judgedById"=ANY($1::uuid[]) AND NOT ("judgedById"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_listing_suppression WHERE ("actorId"=ANY($1::uuid[]) AND NOT ("actorId"=ANY($2::uuid[]))) OR ("liftedById"=ANY($1::uuid[]) AND NOT ("liftedById"=ANY($2::uuid[])))',
      [s.all, s.profiles]
    ),
    await one(
      'directory_listing_report WHERE "decidedById"=ANY($1::uuid[]) AND NOT ("decidedById"=ANY($2::uuid[]))',
      [s.all, s.profiles]
    ),
  ];
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  return { remaining: sum(exact), blocked: sum(ambiguous) };
}

async function erase(manager: Manager, s: Canonical): Promise<void> {
  const owned = await manager.query(
    `SELECT "requestId",status FROM directory_business_link_request WHERE "ownerId"=$1::uuid ORDER BY "requestId" LIMIT ${
      DIRECTORY_DELETION_ROW_LIMIT + 1
    } FOR UPDATE`,
    [s.account]
  );
  if (!Array.isArray(owned) || owned.length > DIRECTORY_DELETION_ROW_LIMIT)
    throw Error('DIRECTORY_DELETION_ROW_BOUND');
  const requests = owned.map((row) => String(row.requestId));
  const live = owned
    .filter((row) => row.status === 'pending' || row.status === 'approved')
    .map((row) => String(row.requestId));
  // A deleted owner cannot keep a page attached to a listing or a claim waiting for review.
  await manager.query(
    'DELETE FROM directory_business_link_active WHERE "requestId"=ANY($1::uuid[])',
    [requests]
  );
  await manager.query(
    `UPDATE directory_business_link_request SET status='revoked' WHERE "requestId"=ANY($1::uuid[])`,
    [live]
  );
  await manager.query(
    `INSERT INTO directory_business_link_event ("requestId","actorId",action,"actorDomain") SELECT r,NULL,'revoke','system' FROM unnest($1::uuid[]) r`,
    [live]
  );
  // A carry proposed for this owner's link must not restore it after the owner is gone.
  await manager.query(
    `UPDATE directory_business_link_carry SET state='closed',"updatedAt"=now() WHERE "requestId"=ANY($1::uuid[]) AND state='awaiting_confirmation'`,
    [requests]
  );
  // Evidence on the owner's own claims may describe the owner; the event itself is kept.
  await manager.query(
    'UPDATE directory_business_link_event SET "evidenceUrl"=NULL WHERE "requestId"=ANY($1::uuid[]) AND "evidenceUrl" IS NOT NULL',
    [requests]
  );
  await manager.query(
    'UPDATE directory_business_link_request SET "ownerId"=NULL WHERE "requestId"=ANY($1::uuid[])',
    [requests]
  );
  await manager.query(
    `UPDATE directory_business_link_event SET "actorId"=NULL WHERE ("actorDomain"='account' AND "actorId"=$1::uuid) OR ("actorDomain"='profile' AND "actorId"=ANY($2::uuid[]))`,
    [s.account, s.profiles]
  );
  await manager.query(
    `UPDATE directory_business_identity_decision SET "actorId"=NULL,reason='' WHERE ("actorDomain"='account' AND "actorId"=$1::uuid) OR ("actorDomain"='profile' AND "actorId"=ANY($2::uuid[]))`,
    [s.account, s.profiles]
  );
  await manager.query(
    `UPDATE directory_listing_suppression SET note=CASE WHEN "actorId"=ANY($1::uuid[]) THEN NULL ELSE note END,"actorId"=CASE WHEN "actorId"=ANY($1::uuid[]) THEN NULL ELSE "actorId" END,"liftedById"=CASE WHEN "liftedById"=ANY($1::uuid[]) THEN NULL ELSE "liftedById" END WHERE "actorId"=ANY($1::uuid[]) OR "liftedById"=ANY($1::uuid[])`,
    [s.profiles]
  );
  await manager.query(
    `UPDATE directory_listing_report SET "decisionNote"=NULL,"decidedById"=NULL WHERE "decidedById"=ANY($1::uuid[])`,
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_boundary_decision SET "reviewerId"=NULL WHERE "reviewerId"=ANY($1::uuid[])',
    [s.profiles]
  );
  // A human reviewer's free text and checklist are unreviewed input; automated rows hold system values.
  await manager.query(
    `UPDATE directory_address_review_decision SET "actorId"=NULL,reason=CASE WHEN "actorKind"='human' THEN NULL ELSE reason END,checks=CASE WHEN "actorKind"='human' THEN '{}'::jsonb ELSE checks END WHERE "actorId"=ANY($1::uuid[])`,
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_rights_event SET "actorId"=NULL,reason=\'\' WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_withdrawal_request SET "actorId"=NULL,reason=\'\' WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_export_job SET "actorId"=NULL WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_export_download SET "actorId"=NULL WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_taxonomy_mapping_version SET "installedById"=NULL WHERE "installedById"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_taxonomy_event SET "actorId"=NULL,reason=\'\' WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  // Each actor column and its free text are cleared independently: a run can be created by one operator and canceled by another.
  await manager.query(
    `UPDATE directory_taxonomy_run SET reason=CASE WHEN "actorId"=ANY($1::uuid[]) THEN '' ELSE reason END,
       "cancelReason"=CASE WHEN "canceledById"=ANY($1::uuid[]) THEN NULL ELSE "cancelReason" END,
       "rollbackReason"=CASE WHEN "rollbackById"=ANY($1::uuid[]) THEN NULL ELSE "rollbackReason" END,
       "actorId"=CASE WHEN "actorId"=ANY($1::uuid[]) THEN NULL ELSE "actorId" END,
       "canceledById"=CASE WHEN "canceledById"=ANY($1::uuid[]) THEN NULL ELSE "canceledById" END,
       "rollbackById"=CASE WHEN "rollbackById"=ANY($1::uuid[]) THEN NULL ELSE "rollbackById" END
     WHERE "actorId"=ANY($1::uuid[]) OR "canceledById"=ANY($1::uuid[]) OR "rollbackById"=ANY($1::uuid[])`,
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_acquisition_run SET "startedById"=NULL,reason=\'\' WHERE "startedById"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_acquisition_town_request SET "actorId"=NULL,reason=\'\' WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_acquisition_run_event SET "actorId"=NULL,reason=\'\' WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  // The control's own reason is the pause's operational justification (a paused row must keep one), so only the actor goes.
  await manager.query(
    'UPDATE directory_operating_control SET "updatedBy"=NULL WHERE "updatedBy"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_operating_control_event SET "actorId"=NULL,reason=NULL WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_duplicate_case_event SET "actorId"=NULL,note=NULL WHERE "actorId"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_duplicate_sample SET "createdById"=NULL WHERE "createdById"=ANY($1::uuid[])',
    [s.profiles]
  );
  await manager.query(
    'UPDATE directory_duplicate_sample_item SET "judgedById"=NULL WHERE "judgedById"=ANY($1::uuid[])',
    [s.profiles]
  );
}

/**
 * One bounded transaction per action. Every action (re)installs the durable
 * fence first, so erase and readback never run for an unfenced identity.
 * `erase` changes nothing when any ambiguous row exists.
 */
export async function runDirectoryDeletion(
  db: DirectoryDeletionStore,
  scope: DirectoryDeletionScope,
  action: DirectoryDeletionAction,
  beforeWrite: () => Promise<void> = async () => undefined
): Promise<DirectoryDeletionReport> {
  if (!ACTIONS.includes(action))
    throw Error('DIRECTORY_DELETION_ACTION_INVALID');
  const s = canonicalScope(scope);
  return db.transaction(async (manager: Manager) => {
    await manager.query("SET LOCAL lock_timeout='5s'");
    await manager.query("SET LOCAL statement_timeout='12s'");
    const catalog = await manager.query(
      `SELECT t.table_name::text AS "table",array_agg(c.column_name::text ORDER BY c.ordinal_position) AS columns FROM information_schema.tables t JOIN information_schema.columns c ON c.table_schema=t.table_schema AND c.table_name=t.table_name WHERE t.table_schema=current_schema() AND t.table_type='BASE TABLE' GROUP BY t.table_name`
    );
    if (
      validateDirectoryPhysicalCatalog(
        DIRECTORY_ACCOUNT_LIFECYCLE_INVENTORY,
        catalog
      ).length
    )
      throw Error('DIRECTORY_DELETION_CATALOG_DRIFT');
    await installDeletionWriteFence(manager as any, s.operationId, [
      { kind: 'account', id: s.account },
      ...s.profiles.map((id) => ({ kind: 'profile' as const, id })),
      ...s.legacy.map((id) => ({ kind: 'legacy-profile' as const, id })),
    ]);
    await beforeWrite();
    const before = await inspect(manager, s);
    if (action !== 'erase') return before;
    if (before.blocked) throw new DirectoryDeletionBlockedError(before);
    await erase(manager, s);
    const after = await inspect(manager, s);
    if (after.remaining || after.blocked)
      throw Error('DIRECTORY_DELETION_READBACK_NONEMPTY');
    return after;
  });
}

export interface DirectoryDeletionDeps {
  db: DirectoryDeletionStore;
  authority: DirectoryDeletionAuthority;
}

/** Grant-authorized entry point. Authentication remains the only authority for scope. */
export async function executeDirectoryAccountDeletion(
  deps: DirectoryDeletionDeps,
  value: unknown,
  action: DirectoryDeletionAction
): Promise<DirectoryDeletionResult> {
  const candidate = value as Record<string, unknown> | null;
  if (
    !ACTIONS.includes(action) ||
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate) ||
    candidate['owner'] !== DIRECTORY_DELETION_OWNER ||
    candidate['action'] !== action ||
    !validateDeletionGrantShape(candidate)
  )
    throw Error('DIRECTORY_DELETION_GRANT_INVALID');
  const grant = Object.freeze({ ...candidate });
  const read = async () => {
    const reply = await deps.authority.validate(
      grant,
      DIRECTORY_DELETION_OWNER,
      action
    );
    if (
      !reply ||
      reply.accountId !== grant['accountId'] ||
      !validateDeletionIdentityDomains(reply.scope)
    )
      throw Error('DIRECTORY_DELETION_SCOPE_INVALID');
    return reply.scope;
  };
  const scope = await read();
  const fresh = async () => {
    if (JSON.stringify(await read()) !== JSON.stringify(scope))
      throw Error('DIRECTORY_DELETION_SCOPE_CHANGED');
  };
  const report = await runDirectoryDeletion(
    deps.db,
    {
      operationId: String(grant['operationId']),
      accountId: String(grant['accountId']),
      profileIds: scope.currentProfileIds,
      legacyProfileIds: scope.legacyProfileIds,
    },
    action,
    fresh
  );
  await fresh();
  return {
    verified: action === 'fence' || (!report.remaining && !report.blocked),
    ...report,
  };
}
