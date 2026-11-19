import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ReviewConflictError, VERSION_TOKEN } from './review-version';

/**
 * Internal acquisition-run routes (S7e), reached only by the Gateway with the local-evaluation secret. Every write
 * carries the acting profile id and a client-generated decision id. Responses are never cacheable.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const unit = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const CONFIRM: Record<string, string> = {
  cancel: 'CANCEL',
  resume: 'RESUME',
  retry: 'RETRY',
};

export interface AcquisitionRouteChecks {
  acquisitionRuns(o: {
    status?: string;
    townId?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown>;
  acquisitionLatest(): Promise<unknown | null>;
  acquisitionBudget(): Promise<unknown>;
  acquisitionRun(id: string): Promise<unknown | null>;
  acquisitionAction(
    action: 'cancel' | 'resume' | 'retry',
    id: string,
    v: any
  ): Promise<unknown>;
  acquisitionImportHistory(v: any): Promise<unknown>;
  /** "Run this town now": records a pending request the next sweep puts first. */
  acquisitionTownRun(townId: string, v: any): Promise<unknown>;
  /** The active Overture release and the newest candidate releases (D29). */
  acquisitionReleases(): Promise<unknown>;
  /** Operator retry or reject of a held candidate release. */
  acquisitionReleaseAction(
    action: 'retry' | 'reject',
    release: string,
    v: any
  ): Promise<unknown>;
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

/** Returns true when it handled (or refused) the request. */
export async function handleAcquisitionRoute(
  req: IncomingMessage,
  res: ServerResponse,
  checks: AcquisitionRouteChecks,
  secret?: string
): Promise<boolean> {
  if (!req.url?.startsWith('/internal/acquisition/')) return false;
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(
    /^\/internal\/acquisition\/(budget|releases(?:\/\d{4}-\d{2}-\d{2}\.\d+\/(?:retry|reject))?|history\/import|towns\/[0-9a-f-]{36}\/run|runs(?:\/(latest|[0-9a-f-]{36})(?:\/(cancel|resume|retry))?)?)$/
  );
  if (!m) return false;
  const [, whole, runPart, sub] = m;
  const area = whole.startsWith('releases')
    ? 'releases'
    : whole.startsWith('runs')
    ? 'runs'
    : whole.startsWith('towns/')
    ? 'town-run'
    : whole;
  const auth = authorized(req, secret);
  if (auth) return send(res, auth), true;
  if (active >= 32) return send(res, 503), true;
  active++;
  req.setTimeout?.(5000, () => req.destroy());
  try {
    if (req.method === 'GET') {
      const keysOk = (allowed: string[]) =>
        [...url.searchParams.keys()].every((k) => allowed.includes(k));
      if (area === 'budget') {
        if (url.search) return send(res, 400), true;
        return send(res, 200, await checks.acquisitionBudget()), true;
      }
      if (area === 'releases' && whole === 'releases') {
        if (url.search) return send(res, 400), true;
        return send(res, 200, await checks.acquisitionReleases()), true;
      }
      if (area === 'runs' && !runPart) {
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
        return send(res, 200, await checks.acquisitionRuns(o)), true;
      }
      if (area === 'runs' && runPart && !sub) {
        if (url.search) return send(res, 400), true;
        const found =
          runPart === 'latest'
            ? await checks.acquisitionLatest()
            : await checks.acquisitionRun(runPart);
        return send(res, found ? 200 : 404, found ?? undefined), true;
      }
      return send(res, 405), true;
    }
    if (req.method !== 'POST' || url.search) return send(res, 405), true;
    const v = await readJson(req);
    if (!v) return send(res, 400), true;
    if (!uuid.test(v.actorId || '') || !uuid.test(v.decisionId || ''))
      return send(res, 400), true;
    if (area === 'releases') {
      const [, release, action] = whole.split('/');
      if (
        !release ||
        !only(v, ['actorId', 'decisionId', 'reason', 'confirm']) ||
        !text(v.reason) ||
        v.confirm !== (action === 'retry' ? 'RETRY' : 'REJECT')
      )
        return send(res, 400), true;
      const { confirm: _confirm, ...rest } = v;
      return (
        send(
          res,
          200,
          await checks.acquisitionReleaseAction(
            action as 'retry' | 'reject',
            release,
            rest
          )
        ),
        true
      );
    }
    if (area === 'town-run') {
      const townId = whole.split('/')[1];
      if (
        !uuid.test(townId) ||
        !only(v, ['actorId', 'decisionId', 'reason', 'confirm']) ||
        !text(v.reason) ||
        v.confirm !== 'RUN'
      )
        return send(res, 400), true;
      const { confirm: _confirm, ...rest } = v;
      return (
        send(res, 200, await checks.acquisitionTownRun(townId, rest)), true
      );
    }
    if (area === 'history/import') {
      if (
        !only(v, ['actorId', 'decisionId', 'reason', 'release']) ||
        !text(v.reason) ||
        (v.release !== undefined &&
          (typeof v.release !== 'string' ||
            !/^[A-Za-z0-9._-]{1,100}$/.test(v.release)))
      )
        return send(res, 400), true;
      return send(res, 200, await checks.acquisitionImportHistory(v)), true;
    }
    if (area === 'runs' && runPart && uuid.test(runPart) && sub) {
      if (
        !only(v, [
          'actorId',
          'decisionId',
          'reason',
          'expectedVersionToken',
          'unitKey',
          'confirm',
        ]) ||
        !text(v.reason) ||
        typeof v.expectedVersionToken !== 'string' ||
        !VERSION_TOKEN.test(v.expectedVersionToken) ||
        v.confirm !== CONFIRM[sub] ||
        (sub === 'retry') !== (v.unitKey !== undefined) ||
        (v.unitKey !== undefined &&
          (typeof v.unitKey !== 'string' || !unit.test(v.unitKey)))
      )
        return send(res, 400), true;
      const { confirm: _confirm, ...rest } = v;
      return (
        send(
          res,
          200,
          await checks.acquisitionAction(
            sub as 'cancel' | 'resume' | 'retry',
            runPart,
            rest
          )
        ),
        true
      );
    }
    return send(res, 405), true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (error instanceof ReviewConflictError)
      send(res, 409, {
        code: error.code,
        ...(error.detail ? { reason: error.detail } : {}),
      });
    else if (
      message === 'Run not found' ||
      message === 'Town not found' ||
      message === 'Release not found'
    )
      send(res, 404);
    else if (/^Invalid /.test(message)) send(res, 400);
    else send(res, 503);
    return true;
  } finally {
    active--;
  }
}
