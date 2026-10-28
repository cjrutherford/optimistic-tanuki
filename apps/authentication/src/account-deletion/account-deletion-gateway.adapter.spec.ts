import { createServer, Server } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import {
  AccountDeletionGatewayAdapter,
  deletionGatewayOrigins,
} from './account-deletion-gateway.adapter';
import { DeletionNonOrmSubject } from './account-deletion-non-orm.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const grant = {
  contractVersion: 1,
  accountId: randomUUID(),
  operationId: randomUUID(),
  appId: 'local-hub',
  owner: 'authentication' as const,
  action: 'readback' as const,
  attempt: 1,
  leaseOwner: randomUUID(),
  expiresAt: new Date(Date.now() + 30000).toISOString(),
  signature: 'a'.repeat(64),
};
const subject: DeletionNonOrmSubject = {
  accountId: grant.accountId,
  operationId: grant.operationId,
  profileIds: [],
  grant: grant as DeletionNonOrmSubject['grant'],
};
const previous = process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'];
const servers: Server[] = [];
const calls: Array<{ url: string; body: unknown }> = [];
let malformed = false;
let alias = false;
let loggingActive = true;
const aliasId = randomUUID();
async function endpoint() {
  const instanceId = randomUUID();
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const data of req) chunks.push(data);
    calls.push({
      url: req.url || '',
      body: JSON.parse(Buffer.concat(chunks).toString()),
    });
    res.setHeader('content-type', 'application/json');
    const store = req.url?.includes('/oauth/')
      ? 'oauth-callback-state'
      : req.url?.includes('/permissions/')
      ? 'permission-caches'
      : req.url?.includes('/runtime/')
      ? 'gateway-runtime'
      : 'socket-sessions';
    res.end(
      JSON.stringify({
        store,
        remaining: malformed ? 1 : 0,
        fenced: true,
        ...(store === 'gateway-runtime'
          ? {
              instanceId: alias ? aliasId : instanceId,
              logging: { policyVersion: 1, active: loggingActive },
            }
          : {}),
      })
    );
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('PRIVATE_PORT');
  return `http://127.0.0.1:${address.port}`;
}
beforeEach(() => {
  calls.length = 0;
  malformed = false;
  alias = false;
  loggingActive = true;
  delete process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'];
});
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (previous === undefined)
    delete process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'];
  else process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'] = previous;
});
it('requires an explicit bounded replica inventory and rejects ambiguous or unsafe URLs', async () => {
  expect(deletionGatewayOrigins(undefined)).toEqual([]);
  expect(deletionGatewayOrigins('["http://gateway:3000"]')).toEqual([
    'http://gateway:3000',
  ]);
  for (const raw of [
    '',
    '[]',
    '{}',
    '["ftp://remote.example"]',
    '["file:///tmp/a"]',
    '["http://127.0.0.1/path"]',
    '["http://name:secret@127.0.0.1"]',
    '["http://127.0.0.1?secret=x"]',
    '["http://127.0.0.1","http://127.0.0.1/"]',
  ])
    expect(() => deletionGatewayOrigins(raw)).toThrow(
      'DELETION_GATEWAY_INVENTORY_INVALID'
    );
  const adapter = new AccountDeletionGatewayAdapter({
    readback: jest.fn(),
  } as never);
  await expect(adapter.purge(subject)).rejects.toThrow(
    'DELETION_GATEWAY_INVENTORY_REQUIRED'
  );
});
it('purges and independently reads both OAuth and sessions on every declared HTTP replica', async () => {
  process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'] = JSON.stringify([
    await endpoint(),
    await endpoint(),
  ]);
  const owner = {
    readback: jest.fn(async () => ({
      complete: true,
      unresolvedAttribution: [],
    })),
  };
  const adapter = new AccountDeletionGatewayAdapter(owner as never);
  await adapter.purge(subject);
  expect(await adapter.readback(subject)).toBe(0);
  expect(calls).toHaveLength(8);
  for (const action of ['purge', 'readback'])
    for (const store of ['oauth', 'sessions'])
      expect(
        calls.filter(
          (c) => c.url === `/api/internal/account-deletion/${store}/${action}`
        )
      ).toHaveLength(2);
  expect(
    calls.every((c) => JSON.stringify(c.body) === JSON.stringify(grant))
  ).toBe(true);
  expect(owner.readback).toHaveBeenCalledTimes(3);
});
it('rejects nonzero replica readback and incomplete owner proof, then allows retry', async () => {
  process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'] = JSON.stringify([
    await endpoint(),
  ]);
  const owner = {
    readback: jest.fn(async () => ({
      complete: true,
      unresolvedAttribution: [],
    })),
  };
  const adapter = new AccountDeletionGatewayAdapter(owner as never);
  malformed = true;
  await expect(adapter.purge(subject)).rejects.toThrow(
    'DELETION_GATEWAY_REPLY_INVALID'
  );
  malformed = false;
  expect(await adapter.readback(subject)).toBe(0);
  owner.readback.mockResolvedValueOnce({
    complete: false,
    unresolvedAttribution: [],
  });
  await expect(adapter.readback(subject)).rejects.toThrow(
    'DELETION_GATEWAY_OWNER_READBACK'
  );
  await expect(
    adapter.purge({ ...subject, accountId: randomUUID() })
  ).rejects.toThrow('DELETION_GATEWAY_GRANT_INVALID');
});

it('invokes permission cleanup/readback on every declared replica as a distinct family', async () => {
  process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'] = JSON.stringify([
    await endpoint(),
    await endpoint(),
  ]);
  const owner = {
    readback: jest.fn(async () => ({
      complete: true,
      unresolvedAttribution: [],
    })),
  };
  const adapter = new AccountDeletionGatewayAdapter(
    owner as never
  ).permissionAdapter();
  await adapter.purge(subject);
  expect(await adapter.readback(subject)).toBe(0);
  expect(calls).toHaveLength(4);
  expect(
    calls.filter((c) => c.url.endsWith('/permissions/purge'))
  ).toHaveLength(2);
  expect(
    calls.filter((c) => c.url.endsWith('/permissions/readback'))
  ).toHaveLength(2);
});

it('requires distinct Gateway runtime processes and current logging proof for diagnostics', async () => {
  process.env['ACCOUNT_DELETION_GATEWAY_ORIGINS'] = JSON.stringify([
    await endpoint(),
    await endpoint(),
  ]);
  const adapter = new AccountDeletionGatewayAdapter({
    readback: jest.fn(async () => ({
      complete: true,
      unresolvedAttribution: [],
    })),
  } as never);
  const runtime = adapter.runtimeAdapter();
  await runtime.purge(subject);
  expect(await runtime.readback(subject)).toBe(0);
  alias = true;
  await expect(runtime.readback(subject)).rejects.toThrow(
    'DELETION_GATEWAY_REPLICA_ALIAS'
  );
  alias = false;
  loggingActive = false;
  await expect(adapter.runtimeAdapter(true).readback(subject)).rejects.toThrow(
    'DELETION_GATEWAY_LOGGING_UNVERIFIED'
  );
});
