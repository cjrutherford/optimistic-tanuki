import { once } from 'node:events';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
import { mkdtemp, rm, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MemoryCacheProvider } from './cache/memory-cache.provider';
import { FileCacheProvider } from './cache/file-cache.provider';
import { PermissionsCacheService } from './permissions-cache.service';
const own = randomUUID(),
  other = randomUUID();
const key = (id: string) => `${id}:read:local-hub:null`;

it('purges exact owned profiles, preserves counterpart cache and permanently denies late grants', async () => {
  const provider = new MemoryCacheProvider();
  const service = new PermissionsCacheService(provider);
  await service.set(own, 'read', 'local-hub', true);
  await service.set(other, 'read', 'local-hub', true);
  await (service as any).purgeAccountProfiles([own]);
  expect(await (service as any).readbackAccountProfiles([own])).toBe(0);
  expect(await provider.get(key(own))).toBeNull();
  expect(await provider.get(key(other))).toBe(true);
  await expect(service.set(own, 'read', 'local-hub', true)).rejects.toThrow(
    'PERMISSION_PROFILE_DELETION_FENCED'
  );
  const load = jest.fn(async () => true);
  expect(
    await service.getOrLoad(own, 'read', 'local-hub', undefined, load)
  ).toBe(false);
  expect(load).not.toHaveBeenCalled();
});
it('drains an admitted write and does not accept a stale loader result after purge', async () => {
  const provider = new MemoryCacheProvider();
  const service = new PermissionsCacheService(provider);
  let finishWrite!: () => void;
  const original = provider.set.bind(provider);
  jest.spyOn(provider, 'set').mockImplementationOnce(async (...args) => {
    await new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    await original(...args);
  });
  const write = service.set(own, 'read', 'local-hub', true);
  let finishLoad!: (v: boolean) => void;
  const lookup = service.getOrLoad(
    own,
    'read',
    'local-hub',
    undefined,
    () =>
      new Promise((resolve) => {
        finishLoad = resolve;
      })
  );
  let complete = false;
  const purge = (service as any).purgeAccountProfiles([own]).then(() => {
    complete = true;
  });
  await Promise.resolve();
  expect(complete).toBe(false);
  finishWrite();
  finishLoad(true);
  await write;
  expect(await lookup).toBe(false);
  await purge;
  expect(await provider.get(key(own))).toBeNull();
});
it('uses actual file inventory and erases matching copies after provider reconstruction', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ot-d25-cache-'));
  try {
    const provider = new FileCacheProvider(dir);
    await provider.set(key(own), true);
    await provider.set(key(other), true);
    const restarted = new FileCacheProvider(dir);
    await (restarted as any).purgeProfiles([own]);
    expect(await (restarted as any).countProfiles([own])).toBe(0);
    expect(await restarted.get(key(other))).toBe(true);
    const foreign = join(dir, 'foreign-source');
    await writeFile(foreign, 'COUNTERPART');
    await symlink(
      foreign,
      join(dir, Buffer.from(key(own)).toString('hex') + '.json')
    );
    await expect((restarted as any).purgeProfiles([own])).rejects.toThrow();
    expect(await readFile(foreign, 'utf8')).toBe('COUNTERPART');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it('cannot use invalid identities, an unsupported provider or an uninstalled fence as proof', async () => {
  const service = new PermissionsCacheService({} as never);
  await expect(
    (service as any).purgeAccountProfiles([
      '00000000-0000-0000-0000-000000000000',
    ])
  ).rejects.toThrow();
  await expect((service as any).purgeAccountProfiles([own])).rejects.toThrow(
    'PERMISSION_DELETION_PROVIDER_UNSUPPORTED'
  );
  const supported = new PermissionsCacheService(new MemoryCacheProvider());
  await expect(
    (supported as any).readbackAccountProfiles([other])
  ).rejects.toThrow('PERMISSION_DELETION_FENCE_REQUIRED');
});

const privateDescribe =
  process.env.D25_PRIVATE_REDIS === 'd25-private-redis'
    ? describe
    : describe.skip;
privateDescribe('D25 real Redis permission cleanup', () => {
  it('drains two service instances and independently reads exact owned-key absence', async () => {
    const { RedisCacheProvider } = await import('./cache/redis-cache.provider');
    const { createClient } = await import('redis');
    const port = Number(process.env.D25_REDIS_PORT);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw Error('PRIVATE_REDIS_REQUIRED');
    const inspector = createClient({ socket: { host: '127.0.0.1', port } });
    const a = new RedisCacheProvider('127.0.0.1', port),
      b = new RedisCacheProvider('127.0.0.1', port);
    try {
      await inspector.connect();
      expect(await inspector.dbSize()).toBe(0);
      for (const provider of [a, b]) {
        const client = (provider as any).client;
        if (!client.isReady)
          await once(client, 'ready', { signal: AbortSignal.timeout(4000) });
      }
      const first = new PermissionsCacheService(a),
        second = new PermissionsCacheService(b);
      await first.set(own, 'read', 'local-hub', true);
      await second.set(other, 'read', 'local-hub', true);
      await Promise.all([
        first.purgeAccountProfiles([own]),
        second.purgeAccountProfiles([own]),
      ]);
      expect(await first.readbackAccountProfiles([own])).toBe(0);
      expect(await second.readbackAccountProfiles([own])).toBe(0);
      expect(await inspector.get('permissions:' + key(own))).toBeNull();
      expect(await inspector.get('permissions:' + key(other))).toBe('true');
      await expect(second.set(own, 'read', 'local-hub', true)).rejects.toThrow(
        'PERMISSION_PROFILE_DELETION_FENCED'
      );
      await b.onModuleDestroy();
      await expect(b.countProfiles([own])).rejects.toThrow(
        'PERMISSION_CACHE_UNAVAILABLE'
      );
    } finally {
      await a.onModuleDestroy();
      await b.onModuleDestroy();
      if (inspector.isOpen) await inspector.quit();
    }
  });
});

it('clears only the deleting account rate bucket and fences its late security writes', async () => {
  const { ChatGateway } = await import('../app/chat-gateway/chat.gateway');
  const logger = {
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
  const proxy = { send: jest.fn() };
  const gateway = new ChatGateway(
    logger as never,
    proxy as never,
    proxy as never,
    proxy as never,
    proxy as never,
    proxy as never,
    {} as never
  );
  (gateway as any).assertChatWriteAllowed(own);
  (gateway as any).assertChatWriteAllowed(other);
  gateway.purgeAccountSecurityState(own);
  expect(gateway.readbackAccountSecurityState(own)).toBe(0);
  expect((gateway as any).chatWriteBuckets.has(other)).toBe(true);
  expect(() => (gateway as any).assertChatWriteAllowed(own)).toThrow(
    'Account unavailable'
  );
});
