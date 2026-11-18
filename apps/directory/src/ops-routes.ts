import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  DirectoryOperatingControl,
  DirectoryOpsMetrics,
} from '../../../libs/social/contracts/src/lib/directory';
import { isControlKey, type SetControlResult } from './operating-controls';
import { toPrometheus } from './ops-metrics';

/**
 * Internal operations routes (S9a): restricted metrics and the operating controls. Reached only by the Gateway with the
 * local-evaluation secret; every response is `no-store`.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface OpsRouteChecks {
  opsMetrics(): Promise<DirectoryOpsMetrics>;
  opsControls(): Promise<DirectoryOperatingControl[]>;
  opsSetControl(v: {
    key: string;
    paused: boolean;
    reason: string | null;
    actorId: string;
    expectedVersion: number;
  }): Promise<SetControlResult>;
}

let active = 0;

function send(
  res: ServerResponse,
  status: number,
  body?: unknown,
  contentType = 'application/json'
): void {
  res
    .writeHead(status, {
      ...(body === undefined ? {} : { 'content-type': contentType }),
      'cache-control': 'no-store',
    })
    .end(
      body === undefined
        ? undefined
        : typeof body === 'string'
        ? body
        : JSON.stringify(body)
    );
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

/** The shape check for POST /internal/ops/controls/<key>; returns the normalised update or null when invalid. */
export function parseControlUpdate(v: any): {
  paused: boolean;
  reason: string | null;
  actorId: string;
  expectedVersion: number;
} | null {
  if (
    !v ||
    typeof v !== 'object' ||
    !Object.keys(v).every((k) =>
      ['paused', 'reason', 'actorId', 'expectedVersion'].includes(k)
    ) ||
    typeof v.paused !== 'boolean' ||
    (v.reason !== undefined &&
      v.reason !== null &&
      typeof v.reason !== 'string') ||
    typeof v.actorId !== 'string' ||
    !uuid.test(v.actorId) ||
    !Number.isSafeInteger(v.expectedVersion) ||
    v.expectedVersion < 0
  )
    return null;
  const reason = typeof v.reason === 'string' ? v.reason.trim() : '';
  if (reason.length > 500 || (v.paused && !reason)) return null;
  return {
    paused: v.paused,
    reason: reason || null,
    actorId: v.actorId,
    expectedVersion: v.expectedVersion,
  };
}

/** Returns true when it handled (or refused) the request. */
export async function handleOpsRoute(
  req: IncomingMessage,
  res: ServerResponse,
  checks: OpsRouteChecks,
  secret?: string
): Promise<boolean> {
  if (!req.url?.startsWith('/internal/ops/')) return false;
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(
    /^\/internal\/ops\/(metrics|controls(?:\/([A-Za-z0-9_-]{1,64}))?)$/
  );
  if (!match) return false;
  const [, target, key] = match;
  const auth = authorized(req, secret);
  if (auth) return send(res, auth), true;
  if (active >= 32) return send(res, 503), true;
  active++;
  req.setTimeout?.(5000, () => req.destroy());
  try {
    if (target === 'metrics') {
      if (req.method !== 'GET') return send(res, 405), true;
      const keys = [...url.searchParams.keys()];
      const format = url.searchParams.get('format');
      if (
        keys.length > 1 ||
        (keys.length === 1 &&
          (keys[0] !== 'format' ||
            url.searchParams.getAll('format').length !== 1 ||
            format !== 'prometheus'))
      )
        return send(res, 400), true;
      const metrics = await checks.opsMetrics();
      return format === 'prometheus'
        ? (send(
            res,
            200,
            toPrometheus(metrics),
            'text/plain; version=0.0.4; charset=utf-8'
          ),
          true)
        : (send(res, 200, metrics), true);
    }
    if (url.search) return send(res, 400), true;
    if (!key) {
      if (req.method !== 'GET') return send(res, 405), true;
      return send(res, 200, { controls: await checks.opsControls() }), true;
    }
    if (req.method !== 'POST') return send(res, 405), true;
    if (!isControlKey(key)) return send(res, 404), true;
    const update = parseControlUpdate(await readJson(req));
    if (!update) return send(res, 400), true;
    const result = await checks.opsSetControl({ key, ...update });
    if (result.ok === false) return send(res, 409, { code: result.code }), true;
    return send(res, 200, result.control), true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (res.headersSent) res.destroy();
    else if (/^Invalid /.test(message)) send(res, 400);
    else send(res, 503);
    return true;
  } finally {
    active--;
  }
}
