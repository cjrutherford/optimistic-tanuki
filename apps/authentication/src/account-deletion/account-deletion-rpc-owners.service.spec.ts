import { of, throwError } from 'rxjs';
import { ClientProxyFactory } from '@nestjs/microservices';
import { AccountDeletionRpcOwnersService } from './account-deletion-rpc-owners.service';
import {
  ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND,
  ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND,
  ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND,
  ACCOUNT_DELETION_ENVIRONMENT_COMMAND,
} from '@optimistic-tanuki/models';
import { randomUUID } from 'node:crypto';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const grant = {
  owner: 'profile',
  action: 'fence',
  accountId: randomUUID(),
  operationId: randomUUID(),
} as never;
const replicas = [
  { host: '127.0.0.1', port: 15101 },
  { host: '127.0.0.1', port: 15102 },
];
function setup(inventory: unknown) {
  const calls: Array<{ port: number; cmd: string }> = [];
  const clients: Array<{ close: jest.Mock }> = [];
  let failedPort = 0;
  let alias = false;
  const instanceIds = new Map(replicas.map((v) => [v.port, randomUUID()]));
  jest
    .spyOn(ClientProxyFactory, 'create')
    .mockImplementation((options: any) => {
      const port = options.options.port;
      const client = {
        close: jest.fn(),
        send: jest.fn(({ cmd }, request) => {
          calls.push({ port, cmd });
          if (port === failedPort)
            return throwError(() => Error('PRIVATE_NODE_FAILURE'));
          if (cmd === ACCOUNT_DELETION_ENVIRONMENT_COMMAND)
            return of({
              owner: request.owner,
              logging: { policyVersion: 1, active: port !== failedPort },
              databaseLogging: {
                policyVersion: 1,
                active: port !== failedPort,
              },
            });
          if (port === failedPort)
            return throwError(() => Error('PRIVATE_NODE_FAILURE'));
          if (cmd === ACCOUNT_DELETION_RUNTIME_READBACK_COMMAND)
            return of({
              owner: 'profile',
              instanceId: instanceIds.get(alias ? replicas[0].port : port),
              remaining: 0,
              logging: { policyVersion: 1, active: true },
              databaseLogging: { policyVersion: 1, active: true },
            });
          return of(
            cmd === ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND
              ? { purged: true, remaining: 0 }
              : { fenced: true, profileCount: 0, legacyCount: 0 }
          );
        }),
      };
      clients.push(client);
      return client as never;
    });
  const config = {
    get: (key: string) =>
      key === 'deletion.owner_replicas' ? inventory : replicas[0],
  };
  const service = new AccountDeletionRpcOwnersService(
    config as never,
    {} as never
  );
  return {
    service,
    calls,
    clients,
    alias: () => {
      alias = true;
    },
    fail: (port: number) => {
      failedPort = port;
    },
  };
}
afterEach(() => jest.restoreAllMocks());
it('fences and purges every configured owner replica before returning one acknowledgement', async () => {
  const { service, calls, clients } = setup({ profile: replicas });
  await expect(service.ports.get('profile')!(grant)).resolves.toEqual({
    fenced: true,
    profileCount: 0,
    legacyCount: 0,
  });
  expect(
    calls
      .filter((c) => c.cmd === ACCOUNT_DELETION_SNAPSHOT_PURGE_COMMAND)
      .map((c) => c.port)
      .sort()
  ).toEqual([15101, 15102]);
  service.onModuleDestroy();
  expect(clients.every((c) => c.close.mock.calls.length === 1)).toBe(true);
});
it('does not accept partial replica success and permits a later full retry', async () => {
  const { service, fail } = setup({ profile: replicas });
  fail(15102);
  await expect(service.ports.get('profile')!(grant)).rejects.toThrow(
    'PRIVATE_NODE_FAILURE'
  );
  fail(0);
  await expect(service.ports.get('profile')!(grant)).resolves.toMatchObject({
    fenced: true,
  });
  service.onModuleDestroy();
});
it('preserves a declared singleton and rejects empty, duplicate or unknown inventories', async () => {
  const { service, calls } = setup(undefined);
  await service.ports.get('profile')!(grant);
  expect(calls).toHaveLength(3);
  service.onModuleDestroy();
  for (const invalid of [
    { profile: [] },
    { profile: [replicas[0], replicas[0]] },
    { unknown: replicas },
    { profile: [{ host: 'x', port: -1 }] },
  ])
    expect(() => setup(invalid)).toThrow('DELETION_REPLICA_INVENTORY_INVALID');
});

it('requires a separate process identity and successful runtime custody check from every replica', async () => {
  const f = setup({ profile: replicas });
  const capability = { ...(grant as any), action: 'readback' };
  const replies = await f.service.runtimeReadbacks(capability);
  expect(replies).toHaveLength(2);
  expect(new Set(replies.map((v) => v.instanceId)).size).toBe(2);
  f.fail(15102);
  await expect(f.service.runtimeReadbacks(capability)).rejects.toThrow(
    'PRIVATE_NODE_FAILURE'
  );
  f.fail(0);
  f.alias();
  await expect(f.service.runtimeReadbacks(capability)).rejects.toThrow(
    'DELETION_REPLICA_ALIAS_UNVERIFIED'
  );
  f.service.onModuleDestroy();
});

it('refuses mismatched live artifact custody before starting Auth cleanup', async () => {
  const local = {
    runtimeCustody: jest.fn(
      async (_grant: unknown, probe: { nonce: string; mode: string }) => ({
        owner: 'authentication',
        storeId: 'local:11111111-1111-4111-8111-111111111111',
      })
    ),
    fence: jest.fn(async () => ({ fenced: true })),
  };
  const send = jest.fn(({ cmd }: { cmd: string }) =>
    of(
      cmd === ACCOUNT_DELETION_RUNTIME_CUSTODY_COMMAND
        ? {
            owner: 'authentication',
            storeId: 'local:22222222-2222-4222-8222-222222222222',
          }
        : { fenced: true }
    )
  );
  jest
    .spyOn(ClientProxyFactory, 'create')
    .mockReturnValue({ send, close: jest.fn() } as never);
  const config = {
    get: (key: string) =>
      key === 'deletion.owner_replicas'
        ? { authentication: [replicas[1]] }
        : replicas[0],
  };
  const service = new AccountDeletionRpcOwnersService(
    config as never,
    local as never
  );
  await expect(
    service.ports.get('authentication')!({
      ...(grant as unknown as Record<string, unknown>),
      owner: 'authentication',
    } as never)
  ).rejects.toThrow('DELETION_SHARED_STORE_UNVERIFIED');
  expect(local.fence).not.toHaveBeenCalled();
  expect(
    local.runtimeCustody.mock.calls.map(([, probe]) => probe.mode)
  ).toEqual(['write', 'remove']);
  service.onModuleDestroy();
});
it('rejects an unsafe source diagnostic environment before issuing a mutation RPC', async () => {
  const f = setup({ profile: replicas });
  let mutated = false;
  jest.spyOn(ClientProxyFactory, 'create').mockImplementation(
    () =>
      ({
        close: jest.fn(),
        send: ({ cmd }: { cmd: string }) => {
          if (cmd === ACCOUNT_DELETION_ENVIRONMENT_COMMAND)
            return of({
              owner: 'profile',
              logging: { policyVersion: 1, active: true },
              databaseLogging: { policyVersion: 1, active: false },
            });
          mutated = true;
          return of({ fenced: true });
        },
      } as never)
  );
  await expect(f.service.ports.get('profile')!(grant)).rejects.toThrow(
    'DELETION_ENVIRONMENT_UNVERIFIED'
  );
  expect(mutated).toBe(false);
  f.service.onModuleDestroy();
});
