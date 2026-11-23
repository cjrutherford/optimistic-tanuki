import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { TAXONOMY_APPLY_CONFIRMATION } from '../../../libs/social/contracts/src/lib/directory';
import { ReviewConflictError, VERSION_TOKEN } from './review-version';

/**
 * Internal taxonomy routes (S7d), reached only by the Gateway with the local-evaluation secret. Every write
 * carries the acting profile id and a client-generated idempotency id. Responses are never cacheable.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hex64 = /^[0-9a-f]{64}$/;
const ACTIONS = ['assign', 'reject', 'defer', 'reopen'];

export interface TaxonomyRouteChecks {
  taxonomyMappings(): Promise<unknown>;
  taxonomyInstall(v: {
    version: string;
    activate: boolean;
    actorId: string;
  }): Promise<unknown>;
  taxonomyDeactivate(
    version: string,
    v: { actorId: string; reason: string }
  ): Promise<unknown>;
  taxonomyActivate(
    version: string,
    v: { actorId: string; reason?: string }
  ): Promise<unknown>;
  taxonomyCases(o: {
    status?: string;
    townId?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown>;
  taxonomyRaise(v: any): Promise<unknown>;
  taxonomyCase(id: string): Promise<unknown | null>;
  taxonomyDecide(caseId: string, v: any): Promise<unknown>;
  taxonomyDismiss(caseId: string, v: any): Promise<unknown>;
  taxonomyUndo(caseId: string, v: any): Promise<unknown>;
  taxonomyRuns(o: { limit?: number; offset?: number }): Promise<unknown>;
  taxonomyRunCreate(v: any): Promise<unknown>;
  taxonomyRun(id: string): Promise<unknown | null>;
  taxonomyRunCancel(id: string, v: any): Promise<unknown>;
  taxonomyRunRollback(id: string, v: any): Promise<unknown>;
}

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
const optionalText = (v: unknown, max = 100) =>
  v === undefined || (typeof v === 'string' && v.length > 0 && v.length <= max);

/** Returns true when it handled (or refused) the request. */
export async function handleTaxonomyRoute(
  req: IncomingMessage,
  res: ServerResponse,
  checks: TaxonomyRouteChecks,
  secret?: string
): Promise<boolean> {
  if (!req.url?.startsWith('/internal/taxonomy/')) return false;
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(
    /^\/internal\/taxonomy\/(mappings(?:\/(install)|\/([A-Za-z0-9][A-Za-z0-9._-]{0,99})\/(deactivate|activate))?|cases(?:\/([0-9a-f-]{36})(?:\/(decisions|dismiss|undo))?)?|runs(?:\/([0-9a-f-]{36})(?:\/(cancel|rollback))?)?)$/
  );
  if (!m) return false;
  const [, , install, mappingId, mappingSub, caseId, caseSub, runId, runSub] =
    m;
  const area = m[1].split('/')[0];
  const auth = authorized(req, secret);
  if (auth) return send(res, auth), true;
  if (active >= 32) return send(res, 503), true;
  active++;
  req.setTimeout?.(5000, () => req.destroy());
  try {
    const keysOk = (allowed: string[]) =>
      [...url.searchParams.keys()].every((k) => allowed.includes(k));
    if (req.method === 'GET') {
      if (area === 'mappings') {
        if (mappingId) return send(res, 405), true;
        if (url.search) return send(res, 400), true;
        return send(res, 200, await checks.taxonomyMappings()), true;
      }
      if (area === 'cases' && !caseId) {
        if (!keysOk(['status', 'townId', 'limit', 'offset']))
          return send(res, 400), true;
        const o: any = {};
        if (url.searchParams.has('status'))
          o.status = url.searchParams.get('status');
        if (url.searchParams.has('townId'))
          o.townId = url.searchParams.get('townId');
        if (url.searchParams.has('limit'))
          o.limit = Number(url.searchParams.get('limit'));
        if (url.searchParams.has('offset'))
          o.offset = Number(url.searchParams.get('offset'));
        return send(res, 200, await checks.taxonomyCases(o)), true;
      }
      if (area === 'cases' && caseId && !caseSub) {
        if (url.search) return send(res, 400), true;
        const found = await checks.taxonomyCase(caseId);
        return send(res, found ? 200 : 404, found ?? undefined), true;
      }
      if (area === 'runs' && !runId) {
        if (!keysOk(['limit', 'offset'])) return send(res, 400), true;
        const o: any = {};
        if (url.searchParams.has('limit'))
          o.limit = Number(url.searchParams.get('limit'));
        if (url.searchParams.has('offset'))
          o.offset = Number(url.searchParams.get('offset'));
        return send(res, 200, await checks.taxonomyRuns(o)), true;
      }
      if (area === 'runs' && runId && !runSub) {
        if (url.search) return send(res, 400), true;
        const found = await checks.taxonomyRun(runId);
        return send(res, found ? 200 : 404, found ?? undefined), true;
      }
      return send(res, 405), true;
    }
    if (req.method !== 'POST' || url.search) return send(res, 405), true;
    const v = await readJson(req);
    if (!v) return send(res, 400), true;
    if (!uuid.test(v.actorId || '')) return send(res, 400), true;

    if (install) {
      if (
        !only(v, ['version', 'activate', 'actorId']) ||
        !optionalText(v.version) ||
        v.version === undefined ||
        typeof v.activate !== 'boolean'
      )
        return send(res, 400), true;
      return (
        send(
          res,
          200,
          await checks.taxonomyInstall({
            version: v.version,
            activate: v.activate,
            actorId: v.actorId,
          })
        ),
        true
      );
    }
    if (mappingId && mappingSub === 'deactivate') {
      if (!only(v, ['actorId', 'reason']) || !text(v.reason))
        return send(res, 400), true;
      return (
        send(
          res,
          200,
          await checks.taxonomyDeactivate(mappingId, {
            actorId: v.actorId,
            reason: v.reason,
          })
        ),
        true
      );
    }
    if (mappingId && mappingSub === 'activate') {
      if (!only(v, ['actorId', 'reason']) || !optionalText(v.reason, 1024))
        return send(res, 400), true;
      return (
        send(
          res,
          200,
          await checks.taxonomyActivate(mappingId, {
            actorId: v.actorId,
            ...(v.reason === undefined ? {} : { reason: v.reason }),
          })
        ),
        true
      );
    }
    if (area === 'cases' && !caseId) {
      if (
        !only(v, ['caseId', 'townId', 'listingId', 'reason', 'actorId']) ||
        !uuid.test(v.caseId || '') ||
        !uuid.test(v.townId || '') ||
        !uuid.test(v.listingId || '') ||
        !text(v.reason)
      )
        return send(res, 400), true;
      return send(res, 200, await checks.taxonomyRaise(v)), true;
    }
    if (area === 'cases' && caseId && caseSub === 'decisions') {
      if (
        !only(v, [
          'decisionId',
          'actorId',
          'action',
          'reason',
          'expectedVersionToken',
          'categoryId',
          'placeTypeId',
        ]) ||
        !uuid.test(v.decisionId || '') ||
        !ACTIONS.includes(v.action) ||
        !text(v.reason) ||
        typeof v.expectedVersionToken !== 'string' ||
        !VERSION_TOKEN.test(v.expectedVersionToken) ||
        !optionalText(v.categoryId) ||
        !optionalText(v.placeTypeId) ||
        (v.action === 'assign') !== (v.categoryId !== undefined)
      )
        return send(res, 400), true;
      return send(res, 200, await checks.taxonomyDecide(caseId, v)), true;
    }
    if (area === 'cases' && caseId && caseSub === 'dismiss') {
      if (
        !only(v, ['decisionId', 'actorId', 'reason', 'expectedVersionToken']) ||
        !uuid.test(v.decisionId || '') ||
        !text(v.reason) ||
        typeof v.expectedVersionToken !== 'string' ||
        !VERSION_TOKEN.test(v.expectedVersionToken)
      )
        return send(res, 400), true;
      return send(res, 200, await checks.taxonomyDismiss(caseId, v)), true;
    }
    if (area === 'cases' && caseId && caseSub === 'undo') {
      if (
        !only(v, [
          'decisionId',
          'actorId',
          'undoOf',
          'reason',
          'expectedVersionToken',
        ]) ||
        !uuid.test(v.decisionId || '') ||
        !uuid.test(v.undoOf || '') ||
        !text(v.reason) ||
        typeof v.expectedVersionToken !== 'string' ||
        !VERSION_TOKEN.test(v.expectedVersionToken)
      )
        return send(res, 400), true;
      return send(res, 200, await checks.taxonomyUndo(caseId, v)), true;
    }
    if (area === 'runs' && !runId) {
      if (
        !only(v, [
          'id',
          'mappingVersion',
          'scope',
          'townId',
          'mode',
          'reason',
          'actorId',
          'expectedPlanHash',
          'confirm',
        ]) ||
        !uuid.test(v.id || '') ||
        !optionalText(v.mappingVersion) ||
        v.mappingVersion === undefined ||
        !['town', 'all'].includes(v.scope) ||
        (v.scope === 'town') !== (v.townId !== undefined) ||
        (v.townId !== undefined && !uuid.test(v.townId)) ||
        !['dry_run', 'apply'].includes(v.mode) ||
        !text(v.reason) ||
        (v.mode === 'apply' &&
          (!hex64.test(v.expectedPlanHash || '') ||
            v.confirm !== TAXONOMY_APPLY_CONFIRMATION)) ||
        (v.mode === 'dry_run' &&
          (v.expectedPlanHash !== undefined || v.confirm !== undefined))
      )
        return send(res, 400), true;
      return send(res, 200, await checks.taxonomyRunCreate(v)), true;
    }
    if (area === 'runs' && runId && runSub === 'cancel') {
      if (!only(v, ['actorId', 'reason']) || !text(v.reason))
        return send(res, 400), true;
      return send(res, 200, await checks.taxonomyRunCancel(runId, v)), true;
    }
    if (area === 'runs' && runId && runSub === 'rollback') {
      if (
        !only(v, ['actorId', 'reason', 'confirm']) ||
        !text(v.reason) ||
        v.confirm !== 'ROLLBACK'
      )
        return send(res, 400), true;
      return send(res, 200, await checks.taxonomyRunRollback(runId, v)), true;
    }
    return send(res, 405), true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (error instanceof ReviewConflictError)
      send(res, 409, {
        code: error.code,
        ...(error.detail ? { detail: error.detail } : {}),
      });
    else if (
      message === 'Case not found' ||
      message === 'Run not found' ||
      message === 'Mapping not found' ||
      message === 'Listing unavailable'
    )
      send(res, 404);
    else if (/^Invalid /.test(message)) send(res, 400);
    else send(res, 503);
    return true;
  } finally {
    active--;
  }
}
