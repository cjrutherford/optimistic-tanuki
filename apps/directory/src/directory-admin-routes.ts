import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ReviewConflictError } from './review-version';

/**
 * Internal operator routes (S6d), reached only by the Gateway with the local-evaluation secret: the suspended
 * reviewed-binding list and its revalidation, the owner boundary lock, and guarded maintenance jobs. Every write
 * carries the acting profile id. Responses are never cacheable.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface DirectoryAdminChecks {
  suspendedBindings(o: {
    townId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<unknown>;
  bindingRevalidate(id: string, v: { actorId: string }): Promise<unknown>;
  boundaryLockRead(townId: string): Promise<unknown>;
  boundaryLock(
    townId: string,
    v: { actorId: string; reason: string }
  ): Promise<unknown>;
  boundaryUnlock(
    townId: string,
    v: { actorId: string; reason: string }
  ): Promise<unknown>;
  jobStartRenormalize(v: {
    actorId: string;
    townId?: string;
    dryRun?: boolean;
    reason?: string;
  }): Promise<unknown>;
  jobGet(id: string): Promise<unknown | null>;
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
export async function handleDirectoryAdminRoute(
  req: IncomingMessage,
  res: ServerResponse,
  checks: DirectoryAdminChecks,
  secret?: string
): Promise<boolean> {
  if (!req.url) return false;
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(
    /^\/internal\/(?:(reviewed-bindings)(?:\/([0-9a-f-]{36})\/(revalidate))?|towns\/([0-9a-f-]{36})\/(boundary-lock|boundary-unlock)|jobs\/(renormalize)|jobs\/([0-9a-f-]{36}))$/
  );
  if (!m) return false;
  const [, bindings, bindingId, , townId, lockSub, jobStart, jobId] = m;
  const auth = authorized(req, secret);
  if (auth) return send(res, auth), true;
  if (active >= 32) return send(res, 503), true;
  active++;
  req.setTimeout?.(5000, () => req.destroy());
  try {
    const keysOk = (allowed: string[]) =>
      [...url.searchParams.keys()].every((k) => allowed.includes(k));
    if (req.method === 'GET') {
      if (bindings && !bindingId) {
        if (!keysOk(['state', 'townId', 'limit', 'cursor']))
          return send(res, 400), true;
        // Only suspended bindings are listed today; the parameter is explicit so other states can follow.
        if (
          url.searchParams.has('state') &&
          url.searchParams.get('state') !== 'suspended'
        )
          return send(res, 400), true;
        const o: { townId?: string; limit?: number; cursor?: string } = {};
        if (url.searchParams.has('townId')) {
          o.townId = url.searchParams.get('townId') as string;
          if (!uuid.test(o.townId)) return send(res, 400), true;
        }
        if (url.searchParams.has('limit')) {
          o.limit = Number(url.searchParams.get('limit'));
          if (!Number.isSafeInteger(o.limit) || o.limit < 1 || o.limit > 100)
            return send(res, 400), true;
        }
        if (url.searchParams.has('cursor')) {
          o.cursor = url.searchParams.get('cursor') as string;
          if (!o.cursor || o.cursor.length > 512) return send(res, 400), true;
        }
        return send(res, 200, await checks.suspendedBindings(o)), true;
      }
      if (townId && lockSub === 'boundary-lock') {
        if (url.search) return send(res, 400), true;
        return send(res, 200, await checks.boundaryLockRead(townId)), true;
      }
      if (jobId) {
        if (url.search) return send(res, 400), true;
        const found = await checks.jobGet(jobId);
        return send(res, found ? 200 : 404, found ?? undefined), true;
      }
      return send(res, 405), true;
    }
    if (req.method !== 'POST' || url.search) return send(res, 405), true;
    const v = await readJson(req);
    if (!v || !uuid.test(v.actorId || '')) return send(res, 400), true;

    if (bindingId) {
      if (!only(v, ['actorId'])) return send(res, 400), true;
      return send(res, 200, await checks.bindingRevalidate(bindingId, v)), true;
    }
    if (townId) {
      if (!only(v, ['actorId', 'reason']) || !text(v.reason))
        return send(res, 400), true;
      const input = { actorId: v.actorId, reason: v.reason };
      return (
        send(
          res,
          200,
          lockSub === 'boundary-lock'
            ? await checks.boundaryLock(townId, input)
            : await checks.boundaryUnlock(townId, input)
        ),
        true
      );
    }
    if (jobStart) {
      if (
        !only(v, ['actorId', 'townId', 'dryRun', 'reason']) ||
        (v.townId !== undefined && !uuid.test(v.townId)) ||
        (v.dryRun !== undefined && typeof v.dryRun !== 'boolean') ||
        (v.reason !== undefined && !text(v.reason)) ||
        (v.dryRun === false && !text(v.reason))
      )
        return send(res, 400), true;
      const job = await checks.jobStartRenormalize(v);
      return send(res, 202, job), true;
    }
    return send(res, 405), true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (error instanceof ReviewConflictError)
      send(res, 409, {
        code: error.code,
        ...(error.detail ? { detail: error.detail } : {}),
      });
    else if (message === 'A job is already running')
      send(res, 409, { code: 'invalid_state', detail: 'job_running' });
    else if (message === 'Revalidation unavailable') send(res, 503);
    else if (message === 'Binding not found' || message === 'Town not found')
      send(res, 404);
    else if (/^Invalid /.test(message)) send(res, 400);
    else send(res, 503);
    return true;
  } finally {
    active--;
  }
}
