import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';
import { SUPPRESSION_REASONS } from './listing-suppression';

/**
 * Public, anonymous listing reports and corrections (S6). A report never hides anything: it enters a reviewer
 * queue, and a reviewer may open a suppression from it (see `listing-suppression.ts`).
 *
 *  - The reporter gets a random receipt token once. Only its SHA-256 is stored; lookup by token returns the
 *    status, reason and creation time and nothing else.
 *  - The optional contact email is stored only as a keyed HMAC, never returned by any read, cleared when the
 *    report is closed, and cleared on any report older than `CONTACT_RETENTION_DAYS`.
 *  - Statuses: received -> under_review -> resolved | declined (received may also close directly).
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RECEIPT = /^[A-Za-z0-9_-]{32}$/;
const EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[^\s@<>]{2,63}$/;

export const REPORT_REASONS = SUPPRESSION_REASONS;
export const REPORT_STATUSES = [
  'received',
  'under_review',
  'resolved',
  'declined',
] as const;
export const REPORT_ACTIONS = ['review', 'decline', 'resolve'] as const;
export const PRIORITY_REASONS: readonly string[] = ['safety', 'rights-request'];
export const REPORT_NOTE_MAX = 1000;
export const CONTACT_RETENTION_DAYS = 180;
/** Per-town ceiling on reports created in one hour; a defence behind the gateway's per-IP limit. */
export const TOWN_HOURLY_CAP = 300;
export const REPORT_INVALID = 'Invalid listing report';
export const REPORT_NOT_FOUND = 'Report unavailable';
export const REPORT_CONFLICT = 'Report refused';
export const REPORT_BUSY = 'Reports busy';
const LIST_LIMIT = 200;

export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export interface ReportInput {
  readonly townId: string;
  readonly listingId: string;
  readonly reasonCode: ReportReason;
  readonly note?: string;
  readonly email?: string;
  /** Public listing name at report time, supplied by the caller from the served listing. */
  readonly listingName?: string | null;
}
export interface ReportReceiptStatus {
  readonly status: ReportStatus;
  readonly reasonCode: ReportReason;
  readonly createdAt: string;
}
export interface ReportRecord {
  readonly reportId: string;
  readonly listingId: string;
  readonly listingName: string | null;
  readonly reasonCode: ReportReason;
  readonly note: string | null;
  readonly status: ReportStatus;
  readonly priority: boolean;
  readonly createdAt: string;
  readonly decidedById: string | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
  readonly suppressionId: string | null;
}
export interface TransitionInput {
  readonly townId: string;
  readonly reportId: string;
  readonly action: ReportAction;
  readonly actorId: string;
  readonly note?: string;
  readonly suppressionId?: string;
}

const iso = (d: unknown) =>
  d === null || d === undefined ? null : new Date(d as string).toISOString();

export const receiptHash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** The key that hashes contact emails, derived from a service secret so no new configuration is needed. */
export const contactKeyFrom = (secret: string): string =>
  createHmac('sha256', secret)
    .update('directory-listing-report-contact-v1')
    .digest('hex');

export const normalizeEmail = (email: string): string | null => {
  const value = email.trim().toLowerCase();
  return value.length <= 254 && EMAIL.test(value) ? value : null;
};
const emailHash = (key: string, email: string): string =>
  createHmac('sha256', key).update(email).digest('hex');

function validNote(note: unknown): note is string {
  return (
    typeof note === 'string' &&
    note.trim().length > 0 &&
    note.length <= REPORT_NOTE_MAX
  );
}

export function validateReport(input: ReportInput): void {
  const ok =
    input &&
    UUID.test(input.townId ?? '') &&
    UUID.test(input.listingId ?? '') &&
    (REPORT_REASONS as readonly string[]).includes(input.reasonCode) &&
    (input.note === undefined || validNote(input.note)) &&
    (input.email === undefined ||
      (typeof input.email === 'string' && normalizeEmail(input.email)));
  if (!ok) throw Error(REPORT_INVALID);
}

/** Opportunistic retention: contact hashes do not outlive the retention window on any report. */
export async function purgeReportContacts(
  q: Q,
  days = CONTACT_RETENTION_DAYS
): Promise<number> {
  const rows = await q.query(
    `WITH p AS (UPDATE directory_listing_report SET "contactEmailHash"=NULL
       WHERE "contactEmailHash" IS NOT NULL AND "createdAt" < CURRENT_TIMESTAMP - make_interval(days => $1::int)
       RETURNING 1) SELECT count(*)::int AS n FROM p`,
    [days]
  );
  return rows[0]?.n ?? 0;
}

/** The caller has already proved the listing is currently served in the town. Returns the receipt token, once. */
export async function createReport(
  db: Db,
  contactKey: string,
  input: ReportInput
): Promise<{ receipt: string }> {
  validateReport(input);
  if (typeof contactKey !== 'string' || contactKey.length < 32)
    throw Error(REPORT_BUSY);
  const email = input.email === undefined ? null : normalizeEmail(input.email);
  const token = randomBytes(24).toString('base64url');
  const result = await db.transaction(async (tx) => {
    await tx.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',
      [`directory-listing-report:${input.townId}`]
    );
    const recent = await tx.query(
      `SELECT count(*)::int AS n FROM directory_listing_report WHERE "communityId"=$1 AND "createdAt" > CURRENT_TIMESTAMP - interval '1 hour'`,
      [input.townId]
    );
    if ((recent[0]?.n ?? 0) >= TOWN_HOURLY_CAP) throw Error(REPORT_BUSY);
    await tx.query(
      `INSERT INTO directory_listing_report (id,"communityId","listingId","listingName","reasonCode",note,priority,"receiptTokenHash","contactEmailHash")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        randomUUID(),
        input.townId,
        input.listingId,
        typeof input.listingName === 'string'
          ? input.listingName.slice(0, 300)
          : null,
        input.reasonCode,
        input.note ?? null,
        PRIORITY_REASONS.includes(input.reasonCode),
        receiptHash(token),
        email === null ? null : emailHash(contactKey, email),
      ]
    );
    return { receipt: token };
  });
  try {
    await purgeReportContacts(db);
  } catch {
    /* retention is best effort and never fails a report */
  }
  return result;
}

/** Everything a reporter may learn from a receipt. */
export async function lookupReceipt(
  q: Q,
  token: string
): Promise<ReportReceiptStatus> {
  if (typeof token !== 'string' || !RECEIPT.test(token))
    throw Error(REPORT_NOT_FOUND);
  const rows = await q.query(
    'SELECT status,"reasonCode","createdAt" FROM directory_listing_report WHERE "receiptTokenHash"=$1',
    [receiptHash(token)]
  );
  if (rows.length !== 1) throw Error(REPORT_NOT_FOUND);
  return {
    status: rows[0].status,
    reasonCode: rows[0].reasonCode,
    createdAt: iso(rows[0].createdAt) as string,
  };
}

/** Reviewer queue: priority first, then oldest first. Open reports by default. */
export async function listReports(
  q: Q,
  town: string,
  status?: string
): Promise<{ reports: ReportRecord[] }> {
  if (
    !UUID.test(town) ||
    (status !== undefined &&
      status !== 'open' &&
      !(REPORT_STATUSES as readonly string[]).includes(status))
  )
    throw Error(REPORT_INVALID);
  const filter =
    status === undefined || status === 'open'
      ? `r.status IN ('received','under_review')`
      : `r.status=$2`;
  const rows = await q.query(
    `SELECT r.id,r."listingId",r."listingName",r."reasonCode",r.note,r.status,r.priority,r."createdAt",r."decidedById",r."decidedAt",r."decisionNote",r."suppressionId"
       FROM directory_listing_report r
      WHERE r."communityId"=$1 AND ${filter}
      ORDER BY r.priority DESC, r."createdAt" ASC, r.id
      LIMIT ${LIST_LIMIT}`,
    status === undefined || status === 'open' ? [town] : [town, status]
  );
  return {
    reports: rows.map((r) => ({
      reportId: r.id,
      listingId: r.listingId,
      listingName: typeof r.listingName === 'string' ? r.listingName : null,
      reasonCode: r.reasonCode,
      note: r.note ?? null,
      status: r.status,
      priority: r.priority === true,
      createdAt: iso(r.createdAt) as string,
      decidedById: r.decidedById ?? null,
      decidedAt: iso(r.decidedAt),
      decisionNote: r.decisionNote ?? null,
      suppressionId: r.suppressionId ?? null,
    })),
  };
}

const TARGET: Record<ReportAction, ReportStatus> = {
  review: 'under_review',
  decline: 'declined',
  resolve: 'resolved',
};
const FROM: Record<ReportAction, readonly ReportStatus[]> = {
  review: ['received'],
  decline: ['received', 'under_review'],
  resolve: ['received', 'under_review'],
};

export async function transitionReport(
  db: Db,
  input: TransitionInput
): Promise<{ replayed: boolean; reportId: string; status: ReportStatus }> {
  const ok =
    input &&
    UUID.test(input.townId ?? '') &&
    UUID.test(input.reportId ?? '') &&
    UUID.test(input.actorId ?? '') &&
    (REPORT_ACTIONS as readonly string[]).includes(input.action) &&
    (input.note === undefined || validNote(input.note)) &&
    (input.suppressionId === undefined ||
      (input.action === 'resolve' && UUID.test(input.suppressionId))) &&
    (input.action !== 'decline' || input.note !== undefined) &&
    (input.action !== 'review' || input.note === undefined);
  if (!ok) throw Error(REPORT_INVALID);
  return db.transaction(async (tx) => {
    await assertDirectoryIdentitiesUnfenced(tx, [input.actorId]);
    const found = await tx.query(
      'SELECT * FROM directory_listing_report WHERE id=$1 AND "communityId"=$2 FOR UPDATE',
      [input.reportId, input.townId]
    );
    if (found.length !== 1) throw Error(REPORT_NOT_FOUND);
    const r = found[0];
    const target = TARGET[input.action];
    if (r.status === target) {
      if (
        (r.decidedById ?? null) !== input.actorId ||
        (input.action !== 'review' &&
          ((r.decisionNote ?? null) !== (input.note ?? null) ||
            (r.suppressionId ?? null) !== (input.suppressionId ?? null)))
      )
        throw Error(REPORT_CONFLICT);
      return { replayed: true, reportId: r.id, status: target };
    }
    if (!FROM[input.action].includes(r.status)) throw Error(REPORT_CONFLICT);
    if (input.suppressionId) {
      const s = await tx.query(
        'SELECT 1 FROM directory_listing_suppression WHERE id=$1 AND "communityId"=$2 AND "listingId"=$3',
        [input.suppressionId, input.townId, r.listingId]
      );
      if (s.length !== 1) throw Error(REPORT_CONFLICT);
    }
    const closing = target === 'resolved' || target === 'declined';
    await tx.query(
      `UPDATE directory_listing_report SET status=$2,"decidedById"=$3,"decidedAt"=CURRENT_TIMESTAMP,"decisionNote"=$4,
              "suppressionId"=$5,"contactEmailHash"=CASE WHEN $6::boolean THEN NULL ELSE "contactEmailHash" END,"updatedAt"=CURRENT_TIMESTAMP
        WHERE id=$1`,
      [
        r.id,
        target,
        input.actorId,
        input.note ?? null,
        input.suppressionId ?? null,
        closing,
      ]
    );
    return { replayed: false, reportId: r.id, status: target };
  });
}
