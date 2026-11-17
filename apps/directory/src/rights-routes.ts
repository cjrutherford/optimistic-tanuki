import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ReviewConflictError, VERSION_TOKEN } from './review-version';
import { RIGHTS_ACTIONS } from './rights-case';
import { WITHDRAWAL_KINDS } from './withdrawal-request';

/**
 * Internal rights-case and withdrawal routes (S7c), reached only by the Gateway with the local-evaluation secret.
 * Every write carries the acting profile id, a client-generated idempotency id and (for decisions) the case's
 * version token. Responses are never cacheable.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hex64 = /^[0-9a-f]{64}$/;

export interface RightsRouteChecks {
  rightsList(o: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown>;
  rightsDetail(id: string): Promise<unknown | null>;
  rightsSync(v: {
    syncId: string;
    actorId: string;
    releaseId: string;
    operation?: string;
  }): Promise<unknown>;
  rightsDecide(caseId: string, v: any): Promise<unknown>;
  rightsUndo(caseId: string, v: any): Promise<unknown>;
  withdrawalCreate(v: any): Promise<unknown>;
  withdrawalList(o: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown>;
  withdrawalGet(id: string): Promise<unknown | null>;
}

const OPERATIONS = [
  'ingest',
  'retain',
  'privateDisplay',
  'publicDisplay',
  'export',
  'enrich',
];
let active = 0;

function send(res: ServerResponse, status: number, body?: unknown): void {
  res
    .writeHead(status, {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      'cache-control': 'no-store',
    })
    .end(body === undefined ? undefined : JSON.stringify(body));
}

function authorized(req: IncomingMessage, secret?: string): 0 | 401 | 503 {
  const expected = Buffer.from(secret || '');
  if (expected.length < 32) return 503;
  const provided = Buffer.from(
    req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : ''
  );
  return provided.length === expected.length &&
    timingSafeEqual(provided, expected)
    ? 0
    : 401;
}

async function readJson(req: IncomingMessage): Promise<any | undefined> {
  let body = Buffer.alloc(0);
  for await (const chunk of req) {
    body = Buffer.concat([body, Buffer.from(chunk)]);
    if (body.length > 16384) return undefined;
  }
  try {
    const value = JSON.parse(body.toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

const only = (value: any, allowed: string[]) =>
  Object.keys(value).every((k) => allowed.includes(k));
const text = (v: unknown, max = 1024) =>
  typeof v === 'string' && !!v.trim() && v.length <= max;
const paging = (params: URLSearchParams) => {
  const out: { status?: string; limit?: number; offset?: number } = {};
  if (params.has('status')) out.status = params.get('status') as string;
  if (params.has('limit')) out.limit = Number(params.get('limit'));
  if (params.has('offset')) out.offset = Number(params.get('offset'));
  return out;
};

/** Returns true when it handled (or refused) the request. */
export async function handleRightsRoute(
  req: IncomingMessage,
  res: ServerResponse,
  checks: RightsRouteChecks,
  secret?: string
): Promise<boolean> {
  if (
    !req.url?.startsWith('/internal/rights/') &&
    !req.url?.startsWith('/internal/withdrawals')
  )
    return false;
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const caseMatch = path.match(
    /^\/internal\/rights\/cases(?:\/([0-9a-f-]{36})(?:\/(decisions|undo))?|\/(sync))?$/
  );
  const withdrawalMatch = path.match(
    /^\/internal\/withdrawals(?:\/([0-9a-f-]{36}))?$/
  );
  if (!caseMatch && !withdrawalMatch) return false;
  const auth = authorized(req, secret);
  if (auth) return send(res, auth), true;
  if (active >= 32) return send(res, 503), true;
  active++;
  req.setTimeout?.(5000, () => req.destroy());
  try {
    if (caseMatch) {
      const [, id, sub, sync] = caseMatch;
      if (!id && !sync && req.method === 'GET') {
        const o = paging(url.searchParams);
        if (
          [...url.searchParams.keys()].some(
            (k) => !['status', 'limit', 'offset'].includes(k)
          )
        )
          return send(res, 400), true;
        return send(res, 200, await checks.rightsList(o)), true;
      }
      if (id && !sub && req.method === 'GET') {
        if (url.search) return send(res, 400), true;
        const found = await checks.rightsDetail(id);
        return send(res, found ? 200 : 404, found ?? undefined), true;
      }
      if (req.method !== 'POST' || url.search) return send(res, 405), true;
      const v = await readJson(req);
      if (!v) return send(res, 400), true;
      if (sync) {
        if (
          !only(v, ['syncId', 'actorId', 'releaseId', 'operation']) ||
          !uuid.test(v.syncId || '') ||
          !uuid.test(v.actorId || '') ||
          typeof v.releaseId !== 'string' ||
          !/^[A-Za-z0-9._-]{1,100}$/.test(v.releaseId) ||
          (v.operation !== undefined && !OPERATIONS.includes(v.operation))
        )
          return send(res, 400), true;
        return (
          send(
            res,
            200,
            await checks.rightsSync({
              syncId: v.syncId,
              actorId: v.actorId,
              releaseId: v.releaseId,
              ...(v.operation ? { operation: v.operation } : {}),
            })
          ),
          true
        );
      }
      if (sub === 'decisions') {
        if (
          !only(v, [
            'decisionId',
            'actorId',
            'action',
            'reason',
            'expectedVersionToken',
            'termsUrl',
            'termsSha256',
          ]) ||
          !uuid.test(v.decisionId || '') ||
          !uuid.test(v.actorId || '') ||
          !(RIGHTS_ACTIONS as readonly string[]).includes(v.action) ||
          !text(v.reason) ||
          typeof v.expectedVersionToken !== 'string' ||
          !VERSION_TOKEN.test(v.expectedVersionToken) ||
          (v.termsUrl !== undefined && !text(v.termsUrl, 2048)) ||
          (v.termsSha256 !== undefined && !hex64.test(v.termsSha256 || ''))
        )
          return send(res, 400), true;
        return (
          send(
            res,
            200,
            await checks.rightsDecide(id, {
              decisionId: v.decisionId,
              actorId: v.actorId,
              action: v.action,
              reason: v.reason,
              expectedVersionToken: v.expectedVersionToken,
              termsUrl: v.termsUrl,
              termsSha256: v.termsSha256,
            })
          ),
          true
        );
      }
      if (sub === 'undo') {
        if (
          !only(v, [
            'decisionId',
            'actorId',
            'undoOf',
            'reason',
            'expectedVersionToken',
          ]) ||
          !uuid.test(v.decisionId || '') ||
          !uuid.test(v.actorId || '') ||
          !uuid.test(v.undoOf || '') ||
          !text(v.reason) ||
          typeof v.expectedVersionToken !== 'string' ||
          !VERSION_TOKEN.test(v.expectedVersionToken)
        )
          return send(res, 400), true;
        return (
          send(
            res,
            200,
            await checks.rightsUndo(id, {
              decisionId: v.decisionId,
              actorId: v.actorId,
              undoOf: v.undoOf,
              reason: v.reason,
              expectedVersionToken: v.expectedVersionToken,
            })
          ),
          true
        );
      }
      return send(res, 405), true;
    }
    const [, wid] = withdrawalMatch!;
    if (req.method === 'GET') {
      if (wid) {
        if (url.search) return send(res, 400), true;
        const found = await checks.withdrawalGet(wid);
        return send(res, found ? 200 : 404, found ?? undefined), true;
      }
      if (
        [...url.searchParams.keys()].some(
          (k) => !['status', 'limit', 'offset'].includes(k)
        )
      )
        return send(res, 400), true;
      return (
        send(res, 200, await checks.withdrawalList(paging(url.searchParams))),
        true
      );
    }
    if (req.method !== 'POST' || wid || url.search) return send(res, 405), true;
    const v = await readJson(req);
    if (
      !v ||
      !only(v, [
        'id',
        'kind',
        'target',
        'reason',
        'actorId',
        'confirm',
        'rightsCaseId',
      ]) ||
      !uuid.test(v.id || '') ||
      !uuid.test(v.actorId || '') ||
      !(WITHDRAWAL_KINDS as readonly string[]).includes(v.kind) ||
      typeof v.target !== 'string' ||
      !text(v.reason) ||
      typeof v.confirm !== 'string' ||
      (v.rightsCaseId !== undefined && !uuid.test(v.rightsCaseId))
    )
      return send(res, 400), true;
    return send(res, 200, await checks.withdrawalCreate(v)), true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (error instanceof ReviewConflictError)
      send(res, 409, { code: error.code });
    else if (message === 'Case not found') send(res, 404);
    else if (/^Invalid /.test(message)) send(res, 400);
    else send(res, 503);
    return true;
  } finally {
    active--;
  }
}
