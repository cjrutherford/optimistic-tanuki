import { recordOperatorEvent } from './operator-audit';
import {
  revalidateBinding,
  type BindingResult,
} from './reviewed-binding-revalidate';

/**
 * Operator view of suspended reviewed bindings. Bindings are suspended and resumed only by revalidation (the sweep or
 * the push after a stage withdrawal); this adds no resume semantics. `revalidateOne` runs that same revalidation for a
 * single binding and reports the state it ended in.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const SUSPENDED_PAGE_DEFAULT = 50;
export const SUSPENDED_PAGE_MAX = 100;

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<any[]>;
}

export interface SuspendedBinding {
  id: string;
  townId: string;
  townName: string | null;
  /** The staged listing the binding pins: scan and source row. */
  listing: { scanId: string; sourceFileRowNumber: string };
  provenance: string;
  stateCause: string | null;
  suspendedAt: string | null;
}
export interface SuspendedBindingPage {
  bindings: SuspendedBinding[];
  total: number;
  nextCursor: string | null;
}

const iso = (v: unknown) =>
  v === null || v === undefined
    ? null
    : v instanceof Date
    ? v.toISOString()
    : String(v);

export function encodeCursor(at: string | null, id: string): string {
  return Buffer.from(JSON.stringify([at, id])).toString('base64url');
}
export function decodeCursor(cursor: string): [string | null, string] {
  let v: unknown;
  try {
    v = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw Error('Invalid binding cursor');
  }
  if (
    !Array.isArray(v) ||
    v.length !== 2 ||
    !(
      v[0] === null ||
      (typeof v[0] === 'string' && !isNaN(Date.parse(v[0])))
    ) ||
    typeof v[1] !== 'string' ||
    !UUID.test(v[1])
  )
    throw Error('Invalid binding cursor');
  return [v[0], v[1]];
}

/** Newest suspension first; `total` counts every match, not just the page. */
export async function listSuspendedBindings(
  db: Queryable,
  options: { townId?: string; limit?: number; cursor?: string }
): Promise<SuspendedBindingPage> {
  const limit = options.limit ?? SUSPENDED_PAGE_DEFAULT;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > SUSPENDED_PAGE_MAX ||
    (options.townId !== undefined && !UUID.test(options.townId))
  )
    throw Error('Invalid binding query');
  const after = options.cursor ? decodeCursor(options.cursor) : null;
  const town = options.townId ?? null;
  const [{ total }] = await db.query(
    `SELECT count(*)::int AS total FROM directory_reviewed_binding b
      WHERE b.state='suspended' AND ($1::uuid IS NULL OR b."communityId"=$1)`,
    [town]
  );
  // NULL suspendedAt sorts last, with the id as the tiebreak, so the keyset is total.
  const rows = await db.query(
    `SELECT b.id,b."communityId",t.name AS "townName",b."scanId",b."sourceFileRowNumber"::text AS "sourceFileRowNumber",
            b.provenance,b."stateCause",b."suspendedAt"
       FROM directory_reviewed_binding b LEFT JOIN directory_town t ON t."communityId"=b."communityId"
      WHERE b.state='suspended' AND ($1::uuid IS NULL OR b."communityId"=$1)
        AND ($2::boolean IS FALSE OR (COALESCE(b."suspendedAt",'-infinity'::timestamptz),b.id)
             < (COALESCE($3::timestamptz,'-infinity'::timestamptz),$4::uuid))
      ORDER BY COALESCE(b."suspendedAt",'-infinity'::timestamptz) DESC,b.id DESC LIMIT ${
        limit + 1
      }`,
    [town, after !== null, after?.[0] ?? null, after?.[1] ?? null]
  );
  const page = rows.slice(0, limit);
  return {
    bindings: page.map((r: any) => ({
      id: r.id,
      townId: r.communityId,
      townName: r.townName ?? null,
      listing: { scanId: r.scanId, sourceFileRowNumber: r.sourceFileRowNumber },
      provenance: r.provenance,
      stateCause: r.stateCause ?? null,
      suspendedAt: iso(r.suspendedAt),
    })),
    total: Number(total),
    nextCursor:
      rows.length > limit
        ? encodeCursor(
            iso(page[page.length - 1].suspendedAt),
            page[page.length - 1].id
          )
        : null,
  };
}

export class RevalidationUnavailableError extends Error {
  constructor() {
    super('Revalidation unavailable');
  }
}

export interface RevalidateOneResult {
  bindingId: string;
  outcome: BindingResult['outcome'];
  cause?: string;
  /** The binding's state after the pass. */
  state: string | null;
  stateCause: string | null;
}

/**
 * Runs revalidation for one binding with the same `revalidateBinding` the sweep uses. The stage connection and key are
 * injected by the runtime (they exist only when the stage is configured); without them nothing is attempted.
 */
export async function revalidateOne(
  deps: {
    db: Queryable;
    run: ((id: string) => Promise<BindingResult>) | null;
  },
  bindingId: string,
  actorId: string
): Promise<RevalidateOneResult> {
  if (!UUID.test(bindingId || '') || !UUID.test(actorId || ''))
    throw Error('Invalid binding revalidation');
  if (!deps.run) throw new RevalidationUnavailableError();
  const [before] = await deps.db.query(
    'SELECT state FROM directory_reviewed_binding WHERE id=$1',
    [bindingId]
  );
  if (!before) throw Error('Binding not found');
  const result = await deps.run(bindingId);
  const [after] = await deps.db.query(
    'SELECT state,"stateCause" FROM directory_reviewed_binding WHERE id=$1',
    [bindingId]
  );
  await recordOperatorEvent(deps.db, {
    kind: 'reviewed_binding',
    subjectId: bindingId,
    action: 'revalidate',
    actorId,
    detail: {
      outcome: result.outcome,
      from: before.state,
      to: after?.state ?? null,
    },
  });
  return {
    bindingId,
    outcome: result.outcome,
    ...(result.cause ? { cause: result.cause } : {}),
    state: after?.state ?? null,
    stateCause: after?.stateCause ?? null,
  };
}

/** The production `run`: a read-only stage session per call, as the sweep does. Null when the stage is not configured. */
export function stageRevalidator(
  live: Parameters<typeof revalidateBinding>[0],
  env: NodeJS.ProcessEnv,
  open: (url: string) => {
    initialize(): Promise<unknown>;
    destroy(): Promise<unknown>;
    query(sql: string, params?: unknown[]): Promise<any[]>;
  }
): ((id: string) => Promise<BindingResult>) | null {
  const url = (env.DIRECTORY_CONTACT_STAGE_DATABASE_URL ?? '').trim();
  const label = (env.DIRECTORY_CONTACT_STAGE_LABEL ?? '').trim();
  const key = env.DIRECTORY_REVIEWED_BINDING_HMAC_KEY ?? '';
  if (!url || !label || key.length < 32) return null;
  return async (id) => {
    const stage = open(url);
    try {
      await stage.initialize();
    } catch {
      throw new RevalidationUnavailableError();
    }
    try {
      return await revalidateBinding(live, stage, key, id, {
        apply: true,
        stageInstallationId: label,
      });
    } finally {
      await stage.destroy();
    }
  };
}
