// Loopback-only, short-lived range proxy. Every upstream request is conditional
// on the previously reviewed S3 ETag. The caller must separately authorize use.
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const anonymousFetch = globalThis.fetch;
export async function openPinnedRangeProxy({
  asset,
  etag,
  upstream = anonymousFetch,
  maxBytes = 256 * 1024 * 1024,
  reserveAttempt,
  requestTimeoutMs = 30000,
  onVerified,
}) {
  let url;
  try {
    url = new URL(asset);
  } catch {
    throw Error('Invalid pinned asset');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'overturemaps-us-west-2.s3.us-west-2.amazonaws.com' ||
    url.port ||
    !/^\/release\/\d{4}-\d{2}-\d{2}\.\d+\/theme=places\/type=place\/[^/]+\.parquet$/.test(
      url.pathname
    ) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    typeof etag !== 'string' ||
    !/^[A-Za-z0-9-]{1,100}$/.test(etag) ||
    typeof upstream !== 'function' ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1
  )
    throw Error('Invalid pinned asset');
  if (typeof reserveAttempt !== 'function')
    throw Error('Independent budget reservation required');
  if (
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1000 ||
    requestTimeoutMs > 3600000
  )
    throw Error('Invalid request timeout');
  const path = `/${randomBytes(24).toString('hex')}/object`;
  if (onVerified !== undefined && typeof onVerified !== 'function')
    throw Error('Invalid verification callback');
  let bytesAllocated = 0,
    captured = null;
  const server = createServer(async (request, response) => {
    if (request.url !== path) {
      response.writeHead(404).end();
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    const range = request.headers.range;
    if (
      request.method === 'GET' &&
      (typeof range !== 'string' || !/^bytes=\d+-\d*$/.test(range))
    ) {
      response.writeHead(400).end();
      return;
    }
    if (request.method === 'GET') {
      const parts = /^bytes=(\d+)-(\d*)$/.exec(range),
        start = Number(parts[1]),
        end = parts[2] ? Number(parts[2]) : null;
      if (
        !Number.isSafeInteger(start) ||
        (end !== null && (!Number.isSafeInteger(end) || end < start))
      ) {
        response.writeHead(400).end();
        return;
      }
      if (end !== null && end - start + 1 > maxBytes - bytesAllocated) {
        response.writeHead(429).end();
        return;
      }
    }
    try {
      const signal = AbortSignal.timeout(5000);
      const attempt = Object.freeze({
        attemptId: randomUUID(),
        method: request.method,
        asset: url.href,
        etag,
        range: range ?? null,
      });
      const reservation = await Promise.race([
        Promise.resolve().then(() => reserveAttempt(attempt)),
        new Promise((_, reject) =>
          signal.addEventListener(
            'abort',
            () => reject(Error('Reservation unavailable')),
            { once: true }
          )
        ),
      ]);
      const permitted =
        reservation?.state === 'reserved' ||
        (reservation?.state === 'authorized-free' &&
          upstream === anonymousFetch);
      if (
        !reservation ||
        !['state', 'attemptId', 'period'].every((key) =>
          Object.hasOwn(reservation, key)
        ) ||
        !permitted ||
        reservation.attemptId !== attempt.attemptId ||
        reservation.period !== new Date().toISOString().slice(0, 7)
      ) {
        response.writeHead(429).end();
        return;
      }
      const headers = { 'If-Match': `"${etag}"` };
      if (request.method === 'GET') headers.Range = range;
      const result = await upstream(url.href, {
        method: request.method,
        headers,
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      const received = result.headers.get('etag')?.replace(/^"|"$/g, '');
      if (result.status === 412) {
        await result.body?.cancel();
        response.writeHead(412).end();
        return;
      }
      if (
        result.status !== (request.method === 'HEAD' ? 200 : 206) ||
        received !== etag
      ) {
        await result.body?.cancel();
        response.writeHead(502).end();
        return;
      }
      if (request.method === 'GET') {
        const requested = /^bytes=(\d+)-(\d*)$/.exec(range);
        const returned = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
          result.headers.get('content-range') ?? ''
        );
        const start = Number(requested[1]),
          requestedEnd = requested[2] ? Number(requested[2]) : null;
        const actualStart = Number(returned?.[1]),
          actualEnd = Number(returned?.[2]),
          total = Number(returned?.[3]);
        if (
          !returned ||
          ![start, actualStart, actualEnd, total].every(Number.isSafeInteger) ||
          (requestedEnd !== null && !Number.isSafeInteger(requestedEnd)) ||
          start !== actualStart ||
          actualEnd < start ||
          total <= actualEnd ||
          (requestedEnd !== null &&
            actualEnd !== Math.min(requestedEnd, total - 1)) ||
          (requestedEnd === null && actualEnd !== total - 1) ||
          Number(result.headers.get('content-length')) !==
            actualEnd - actualStart + 1
        ) {
          await result.body?.cancel();
          response.writeHead(502).end();
          return;
        }
        const bytes = actualEnd - actualStart + 1;
        if (bytes > maxBytes - bytesAllocated) {
          await result.body?.cancel();
          response.writeHead(429).end();
          return;
        }
        bytesAllocated += bytes;
      }
      if (!captured) {
        // Only a response that already passed the status, ETag and range checks above counts.
        const total =
          request.method === 'GET'
            ? Number(
                /\/(\d+)$/.exec(result.headers.get('content-range') ?? '')?.[1]
              )
            : Number(result.headers.get('content-length'));
        captured = Object.freeze({
          asset: url.href,
          etag: received,
          lastModified: result.headers.get('last-modified') || null,
          contentRangeTotal:
            Number.isSafeInteger(total) && total > 0 ? total : null,
          at: Date.now(),
        });
        try {
          onVerified?.(captured);
        } catch {}
      }
      const out = {};
      for (const name of [
        'content-length',
        'content-range',
        'accept-ranges',
        'etag',
        'last-modified',
      ]) {
        const value = result.headers.get(name);
        if (value) out[name] = value;
      }
      response.writeHead(result.status, out);
      if (request.method === 'HEAD' || !result.body) {
        response.end();
        return;
      }
      await pipeline(Readable.fromWeb(result.body), response);
    } catch {
      if (!response.headersSent) response.writeHead(502).end();
      else response.destroy();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw Error('Loopback listener unavailable');
  }
  return {
    url: `http://127.0.0.1:${address.port}${path}`,
    evidence: () => captured,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
}
