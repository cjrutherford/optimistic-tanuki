import { createServer, IncomingMessage, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  DirectoryOwnerBlockedError,
  DirectoryOwnerHttpClient,
} from './directory-owner-http.client';

interface Seen {
  method?: string;
  url?: string;
  authorization?: string;
  body: unknown;
}
interface Reply {
  status: number;
  body?: unknown;
  raw?: string;
}

const SECRET = 'directory-lifecycle-secret-0123456789';
const grant = { owner: 'directory', action: 'erase', accountId: 'a' };

describe('DirectoryOwnerHttpClient', () => {
  let server: Server;
  let origin: string;
  let seen: Seen[];
  let reply: Reply;

  beforeEach(async () => {
    seen = [];
    reply = { status: 200, body: {} };
    server = createServer(async (req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      seen.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
      });
      res.writeHead(reply.status, { 'content-type': 'application/json' });
      res.end(reply.raw ?? JSON.stringify(reply.body));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const client = () =>
    new DirectoryOwnerHttpClient({ baseUrl: origin, secret: SECRET });

  it('is unconfigured when neither setting exists and then refuses every call', async () => {
    const unconfigured = new DirectoryOwnerHttpClient({});
    expect(unconfigured.configured).toBe(false);
    await expect(unconfigured.deletion('fence', grant)).rejects.toThrow(
      'DELETION_OWNER_ENDPOINT_REQUIRED'
    );
    await expect(unconfigured.environment(grant)).rejects.toThrow(
      'DELETION_OWNER_ENDPOINT_REQUIRED'
    );
    expect(seen).toEqual([]);
  });

  it.each([
    [{ baseUrl: 'http://127.0.0.1:3120' }],
    [{ secret: SECRET }],
    [{ baseUrl: 'http://127.0.0.1:3120', secret: 'short' }],
    [{ baseUrl: 'http://127.0.0.1:3120', secret: `${SECRET} with space` }],
    [{ baseUrl: 'http://127.0.0.1:3120/internal', secret: SECRET }],
    [{ baseUrl: 'http://127.0.0.1:3120?x=1', secret: SECRET }],
    [{ baseUrl: 'ftp://directory:21', secret: SECRET }],
    [{ baseUrl: 'http://user:pass@directory:3120', secret: SECRET }],
  ])('rejects a half-set or unsafe configuration %#', (options) => {
    expect(() => new DirectoryOwnerHttpClient(options)).toThrow(
      'DIRECTORY_ACCOUNT_LIFECYCLE_CONFIG_INVALID'
    );
  });

  it('posts the grant with the bearer secret and returns counts', async () => {
    reply = {
      status: 200,
      body: { owner: 'directory', verified: true, remaining: 2, blocked: 0 },
    };
    await expect(client().deletion('erase', grant)).resolves.toEqual({
      verified: true,
      remaining: 2,
      blocked: 0,
    });
    expect(seen).toEqual([
      {
        method: 'POST',
        url: '/internal/account-deletion/erase',
        authorization: `Bearer ${SECRET}`,
        body: grant,
      },
    ]);
  });

  it('turns a 409 blocked reply into an error, never a result', async () => {
    reply = {
      status: 409,
      body: {
        owner: 'directory',
        verified: false,
        status: 'blocked',
        remaining: 3,
        blocked: 1,
      },
    };
    const error = await client()
      .deletion('erase', grant)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DirectoryOwnerBlockedError);
    expect(error).toMatchObject({
      message: 'DELETION_DIRECTORY_BLOCKED',
      remaining: 3,
      blocked: 1,
    });
  });

  it.each([
    ['a 409 with the wrong shape', 409, { owner: 'directory', blocked: 1 }],
    [
      'a 409 that claims to be verified',
      409,
      {
        owner: 'directory',
        verified: true,
        status: 'blocked',
        remaining: 0,
        blocked: 0,
      },
    ],
    [
      'a 200 with an extra key',
      200,
      { owner: 'directory', verified: true, remaining: 0, blocked: 0, id: 'x' },
    ],
    [
      'a 200 for another owner',
      200,
      { owner: 'social', verified: true, remaining: 0, blocked: 0 },
    ],
    [
      'a negative count',
      200,
      { owner: 'directory', verified: true, remaining: -1, blocked: 0 },
    ],
    [
      'a fractional count',
      200,
      { owner: 'directory', verified: true, remaining: 1.5, blocked: 0 },
    ],
    [
      'a string verified flag',
      200,
      { owner: 'directory', verified: 'true', remaining: 0, blocked: 0 },
    ],
    ['a 401', 401, undefined],
    ['a 403', 403, undefined],
    ['a 404', 404, undefined],
    ['a 503', 503, undefined],
  ])('treats %s as unavailable', async (_name, status, body) => {
    reply = { status, body, raw: body === undefined ? '' : undefined };
    await expect(client().deletion('readback', grant)).rejects.toThrow(
      'DELETION_DIRECTORY_UNAVAILABLE'
    );
  });

  it('treats a non-JSON or oversized body as unavailable', async () => {
    reply = { status: 200, raw: '<html>' };
    await expect(client().deletion('fence', grant)).rejects.toThrow(
      'DELETION_DIRECTORY_UNAVAILABLE'
    );
    reply = { status: 200, raw: JSON.stringify({ pad: 'x'.repeat(600000) }) };
    await expect(client().environment(grant)).rejects.toThrow(
      'DELETION_DIRECTORY_UNAVAILABLE'
    );
  });

  it('refuses an unknown deletion action before any request', async () => {
    await expect(client().deletion('finalize' as never, grant)).rejects.toThrow(
      'DELETION_OWNER_ACTION_INVALID'
    );
    expect(seen).toEqual([]);
  });

  it('reaches the environment, purge, runtime and export routes', async () => {
    reply = { status: 200, body: { ok: true } };
    const c = client();
    await c.environment(grant);
    await c.purgeSnapshots(grant);
    await c.runtimeReadback(grant);
    await c.exportCapture('open', { a: 1 }, 5000);
    await c.exportCapture('read', { a: 2 }, 5000);
    await c.exportCapture('release', { a: 3 }, 5000);
    expect(seen.map((request) => request.url)).toEqual([
      '/internal/account-deletion/environment',
      '/internal/account-deletion/purge-snapshots',
      '/internal/account-deletion/runtime-readback',
      '/internal/account-export/open',
      '/internal/account-export/read',
      '/internal/account-export/release',
    ]);
    expect(seen.every((request) => request.authorization === `Bearer ${SECRET}`)).toBe(true);
    expect(() => c.exportCapture('delete' as never, {}, 1)).toThrow(
      'DIRECTORY_EXPORT_OPERATION_INVALID'
    );
  });

  it('never surfaces the secret or the address in a failure', async () => {
    const dead = new DirectoryOwnerHttpClient({
      baseUrl: 'http://127.0.0.1:1',
      secret: SECRET,
    });
    const error = await dead.environment(grant).catch((e: Error) => e);
    expect((error as Error).message).toBe('DELETION_DIRECTORY_UNAVAILABLE');
    expect(JSON.stringify(error)).not.toContain(SECRET);
    reply = { status: 200, body: [] };
    await expect(client().purgeSnapshots(grant)).rejects.toThrow(
      'DELETION_DIRECTORY_UNAVAILABLE'
    );
  });

  it('reads its settings from the environment only when no options are given', async () => {
    const saved = { ...process.env };
    try {
      process.env['DIRECTORY_ACCOUNT_LIFECYCLE_URL'] = origin;
      process.env['DIRECTORY_ACCOUNT_LIFECYCLE_SECRET'] = SECRET;
      const fromEnv = new DirectoryOwnerHttpClient();
      expect(fromEnv.configured).toBe(true);
      reply = {
        status: 200,
        body: { owner: 'directory', verified: true, remaining: 0, blocked: 0 },
      };
      await expect(fromEnv.deletion('fence', grant)).resolves.toMatchObject({
        verified: true,
      });
      delete process.env['DIRECTORY_ACCOUNT_LIFECYCLE_URL'];
      delete process.env['DIRECTORY_ACCOUNT_LIFECYCLE_SECRET'];
      expect(new DirectoryOwnerHttpClient().configured).toBe(false);
    } finally {
      process.env = saved;
    }
  });
});
