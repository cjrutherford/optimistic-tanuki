import { ConfigService } from '@nestjs/config';
import { createServer, Server } from 'node:net';
import { OwnerHealthService } from './owner-health.service';

const listen = (server: Server): Promise<number> =>
  new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve((server.address() as { port: number }).port)
    )
  );

const configWith = (services: unknown): ConfigService =>
  ({ get: () => services } as unknown as ConfigService);

describe('OwnerHealthService', () => {
  const server = createServer((socket) => socket.end());
  let port = 0;
  beforeAll(async () => {
    port = await listen(server);
  });
  afterAll(() => new Promise<void>((done) => server.close(() => done())));

  const env = { ...process.env };
  beforeEach(() => {
    // Keep the fixed extras (postgres, redis, ...) fast and local.
    process.env['POSTGRES_HOST'] = '127.0.0.1';
    process.env['REDIS_HOST'] = '127.0.0.1';
    process.env['CLAMAV_HOST'] = '127.0.0.1';
    delete process.env['DIRECTORY_INTERNAL_URL'];
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('reports a listening service up with a latency and a stamp', async () => {
    const service = new OwnerHealthService(
      configWith({ social: { host: '127.0.0.1', port } })
    );
    const result = await service.check();
    const social = result.find((r) => r.name === 'social');
    expect(social?.status).toBe('up');
    expect(typeof social?.latencyMs).toBe('number');
    expect(Number.isNaN(Date.parse(social?.checkedAt ?? ''))).toBe(false);
  });

  it('reports a closed port down with a null latency', async () => {
    const closed = createServer();
    const closedPort = await listen(closed);
    await new Promise<void>((done) => closed.close(() => done()));
    const service = new OwnerHealthService(
      configWith({ store: { host: '127.0.0.1', port: closedPort } })
    );
    const store = (await service.check()).find((r) => r.name === 'store');
    expect(store).toMatchObject({ status: 'down', latencyMs: null });
    expect(store?.detail).toBeDefined();
  });

  it('probes the stack extras, including ClamAV and both directory services', async () => {
    const names = new OwnerHealthService(configWith({}))
      .probes()
      .map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'postgres',
        'redis',
        'clamav',
        'directory',
        'directory-worker',
      ])
    );
  });

  it('reports directory down when it is not configured', async () => {
    const result = await new OwnerHealthService(configWith({})).check();
    expect(result.find((r) => r.name === 'directory')).toMatchObject({
      status: 'down',
      detail: 'Not configured',
    });
  });

  it('reports a service that answers non-2xx as degraded', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));
    process.env['DIRECTORY_INTERNAL_URL'] = 'http://directory:3120';
    const result = await new OwnerHealthService(configWith({})).check();
    expect(result.find((r) => r.name === 'directory')).toMatchObject({
      status: 'degraded',
      detail: 'Answered 503',
    });
    spy.mockRestore();
  });
});
