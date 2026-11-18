import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { ExportArtifactResult, ExportConflictError } from './export-job';
import {
  PUBLIC_EXPORT_FORMATS,
  type PublicExportFormat,
  type PublicExportResult,
} from './public-export';

/**
 * Internal operator-export routes (S8), reached only by the Gateway with the local-evaluation secret. Responses are
 * never cacheable and never carry a filesystem path. The artifact route streams a file whose SHA-256 was verified
 * against the job before the first byte.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface ExportRouteChecks {
  exportCreate(v: {
    id: string;
    actorId: string;
    releaseId: string;
    communityId?: string;
  }): Promise<unknown>;
  exportList(o: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown>;
  exportGet(id: string): Promise<unknown | null>;
  exportRetry(id: string, v: { actorId: string }): Promise<unknown | null>;
  exportArtifact(v: {
    id: string;
    actorId: string;
  }): Promise<ExportArtifactResult>;
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
const paging = (params: URLSearchParams) => {
  const out: { status?: string; limit?: number; offset?: number } = {};
  if (params.has('status')) out.status = params.get('status') as string;
  if (params.has('limit')) out.limit = Number(params.get('limit'));
  if (params.has('offset')) out.offset = Number(params.get('offset'));
  return out;
};

/** Returns true when it handled (or refused) the request. */
export async function handleExportRoute(
  req: IncomingMessage,
  res: ServerResponse,
  checks: ExportRouteChecks,
  secret?: string
): Promise<boolean> {
  if (!req.url?.startsWith('/internal/exports')) return false;
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(
    /^\/internal\/exports(?:\/([0-9a-f-]{36})(?:\/(retry|artifact))?)?$/
  );
  if (!match) return false;
  const [, id, sub] = match;
  const auth = authorized(req, secret);
  if (auth) return send(res, auth), true;
  if (active >= 32) return send(res, 503), true;
  active++;
  req.setTimeout?.(5000, () => req.destroy());
  try {
    if (req.method === 'GET' && !id) {
      if (
        [...url.searchParams.keys()].some(
          (k) => !['status', 'limit', 'offset'].includes(k)
        )
      )
        return send(res, 400), true;
      return (
        send(res, 200, await checks.exportList(paging(url.searchParams))), true
      );
    }
    if (req.method === 'GET' && id && !sub) {
      if (url.search) return send(res, 400), true;
      const found = await checks.exportGet(id);
      return send(res, found ? 200 : 404, found ?? undefined), true;
    }
    if (req.method === 'GET' && id && sub === 'artifact') {
      const actorId = url.searchParams.get('actorId') || '';
      if (
        [...url.searchParams.keys()].some((k) => k !== 'actorId') ||
        url.searchParams.getAll('actorId').length !== 1 ||
        !uuid.test(actorId)
      )
        return send(res, 400), true;
      const result = await checks.exportArtifact({ id, actorId });
      if ('code' in result) {
        const status =
          result.code === 'not_found'
            ? 404
            : result.code === 'not_ready'
            ? 409
            : result.code === 'integrity_failed'
            ? 503
            : 410;
        return send(res, status, { code: result.code }), true;
      }
      res.writeHead(200, {
        'content-type': 'application/x-ndjson',
        'content-length': String(result.byteCount),
        'x-content-sha256': result.sha256,
        'content-disposition': `attachment; filename="${result.filename}"`,
        'cache-control': 'no-store',
      });
      req.setTimeout?.(0);
      try {
        await pipeline(result.stream, res);
      } catch {
        res.destroy();
      }
      return true;
    }
    if (req.method !== 'POST' || url.search || (id && sub !== 'retry'))
      return send(res, 405), true;
    const v = await readJson(req);
    if (!v) return send(res, 400), true;
    if (id && sub === 'retry') {
      if (!only(v, ['actorId']) || !uuid.test(v.actorId || ''))
        return send(res, 400), true;
      const job = await checks.exportRetry(id, { actorId: v.actorId });
      return send(res, job ? 200 : 404, job ?? undefined), true;
    }
    if (
      !only(v, ['id', 'actorId', 'releaseId', 'communityId']) ||
      !uuid.test(v.id || '') ||
      !uuid.test(v.actorId || '') ||
      typeof v.releaseId !== 'string' ||
      !/^[A-Za-z0-9._-]{1,100}$/.test(v.releaseId) ||
      (v.communityId !== undefined && !uuid.test(v.communityId || ''))
    )
      return send(res, 400), true;
    return (
      send(
        res,
        200,
        await checks.exportCreate({
          id: v.id,
          actorId: v.actorId,
          releaseId: v.releaseId,
          ...(v.communityId ? { communityId: v.communityId } : {}),
        })
      ),
      true
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (res.headersSent) res.destroy();
    else if (error instanceof ExportConflictError)
      send(res, 409, { code: error.code });
    else if (/^Invalid /.test(message)) send(res, 400);
    else send(res, 503);
    return true;
  } finally {
    active--;
  }
}

export interface PublicExportRouteChecks {
  publicExport(v: {
    town: string;
    format: PublicExportFormat;
  }): Promise<PublicExportResult>;
}

/**
 * `GET /internal/public-export/<town>?format=csv|jsonl` (S8b), reached only by the Gateway's public route. The body
 * is generated from current data and never cacheable. Failures carry only a machine code.
 */
export async function handlePublicExportRoute(
  req: IncomingMessage,
  res: ServerResponse,
  checks: PublicExportRouteChecks,
  secret?: string
): Promise<boolean> {
  if (!req.url?.startsWith('/internal/public-export/')) return false;
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(
    /^\/internal\/public-export\/([0-9a-f-]{36})$/
  );
  if (!match || req.method !== 'GET') return false;
  const auth = authorized(req, secret);
  if (auth) return send(res, auth), true;
  const formats = url.searchParams.getAll('format');
  if (
    !uuid.test(match[1]) ||
    [...url.searchParams.keys()].some((k) => k !== 'format') ||
    formats.length !== 1 ||
    !(PUBLIC_EXPORT_FORMATS as readonly string[]).includes(formats[0])
  )
    return send(res, 400), true;
  if (active >= 8) return send(res, 503), true;
  active++;
  try {
    const result = await checks.publicExport({
      town: match[1],
      format: formats[0] as PublicExportFormat,
    });
    if ('code' in result) return send(res, 404, { code: result.code }), true;
    res
      .writeHead(200, {
        'content-type': result.contentType,
        'content-length': String(Buffer.byteLength(result.body)),
        'content-disposition': `attachment; filename="${result.filename}"`,
        'x-row-count': String(result.rowCount),
        'x-export-truncated': result.truncated ? '1' : '0',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      .end(result.body);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/^Town unavailable$|town-ineligible/.test(message)) send(res, 404);
    else if (
      error instanceof Error &&
      (error as any).kind === 'town-ineligible'
    )
      send(res, 404);
    else if (/^Invalid /.test(message)) send(res, 400);
    else send(res, 503);
    return true;
  } finally {
    active--;
  }
}
