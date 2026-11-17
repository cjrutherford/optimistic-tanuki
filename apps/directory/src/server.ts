import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { createClient } from 'redis';
import { DataSource } from 'typeorm';
import dataSource from './data-source';
import { checkReadiness } from './readiness';

const READINESS_DEADLINE_MS = 2500;

export function createReadinessCheck(checks: Array<() => Promise<boolean>>, deadlineMs = READINESS_DEADLINE_MS): () => Promise<boolean> {
  let pending: Promise<boolean> | undefined;
  return async () => {
    // Keep the underlying attempt shared even after a deadline, so a hung driver
    // cannot create an unbounded number of connections on subsequent requests.
    if (!pending) {
      pending = checkReadiness(...checks).finally(() => { pending = undefined; });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending,
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), deadlineMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

export function createReadinessServer(ready: () => Promise<boolean>, townStatus?: (id: string) => Promise<void>, lifecycle?: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>): Server {
  return createServer(async (request, response) => {
    if (lifecycle && request.url?.startsWith('/internal/account-') && await lifecycle(request, response)) return;
    const match = request.method === 'GET' && request.url?.match(/^\/internal\/towns\/([0-9a-f-]{36})\/status$/i);
    if (match && townStatus) {
      try {
        await townStatus(match[1]);
        // Until S3 tracks every privacy transition, no stored geometry is safe to serve.
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ status: 'pending' }));
      } catch {
        response.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ status: 'unavailable' }));
      }
      return;
    }
    if (request.url !== '/health/ready' || request.method !== 'GET') { response.writeHead(404).end(); return; }
    let ok = false;
    try { ok = await ready(); } catch { /* Fail closed on unexpected probe errors. */ }
    response.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ ready: ok }));
  });
}

export function createDependencyChecks(
  database: Pick<DataSource, 'isInitialized' | 'initialize' | 'query'>,
  redis: { isOpen: boolean; connect: () => Promise<unknown>; ping: () => Promise<unknown> },
): Array<() => Promise<boolean>> {
  return [
    async () => {
      if (!database.isInitialized) await database.initialize();
      const rows = await database.query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AND to_regclass('directory_installation') IS NOT NULL AS installed");
      return rows[0].installed === true;
    },
    async () => { if (!redis.isOpen) await redis.connect(); return await redis.ping() === 'PONG'; },
  ];
}

export function start(port: number, additionalChecks: Array<() => Promise<boolean>> = [], lifecycle?: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>): void {
  const redisUrl = process.env.DIRECTORY_REDIS_URL;
  const databaseUrl = process.env.DIRECTORY_DATABASE_URL;
  if (!redisUrl || !databaseUrl || !process.env.DIRECTORY_QUEUE_PREFIX) {
    throw new Error('DIRECTORY_DATABASE_URL, DIRECTORY_REDIS_URL and DIRECTORY_QUEUE_PREFIX are required');
  }
  const redis = createClient({ url: redisUrl, socket: { connectTimeout: 2000, reconnectStrategy: false } });
  redis.on('error', () => undefined);
  const ready = createReadinessCheck([...createDependencyChecks(dataSource, redis), ...additionalChecks]);
  createReadinessServer(ready, async (id) => {
    if (!await ready()) throw new Error('Directory unavailable');
    await dataSource.query('SELECT "communityId" FROM directory_town WHERE "communityId" = $1', [id]);
  }, lifecycle).listen(port, '0.0.0.0');
}
