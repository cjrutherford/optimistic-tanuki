import { createServer, Server } from 'node:http';
import { once } from 'node:events';
import { ACCOUNT_DELETION_BROWSER_BOUNDARY } from '@optimistic-tanuki/models';
import {
  AccountDeletionBrowserBoundaryAdapter,
  deletionBrowserOrigins,
} from './account-deletion-browser-boundary.adapter';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const servers: Server[] = [];
const previous = process.env['ACCOUNT_DELETION_BROWSER_ORIGINS'];
let invalid = false;
async function endpoint() {
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify(
        invalid
          ? { ...ACCOUNT_DELETION_BROWSER_BOUNDARY, contractVersion: 0 }
          : ACCOUNT_DELETION_BROWSER_BOUNDARY
      )
    );
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('PRIVATE_PORT');
  return 'http://127.0.0.1:' + address.port;
}
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (previous === undefined)
    delete process.env['ACCOUNT_DELETION_BROWSER_ORIGINS'];
  else process.env['ACCOUNT_DELETION_BROWSER_ORIGINS'] = previous;
  invalid = false;
});
it('requires explicit OT and TS origins and rejects unsafe or incomplete inventories', () => {
  expect(deletionBrowserOrigins(undefined)).toEqual([]);
  for (const value of [
    {},
    { 'client-interface': ['http://127.0.0.1:1'] },
    {
      'client-interface': ['file:///tmp/x'],
      'local-hub': ['https://ts.example'],
    },
    {
      'client-interface': ['https://same.example'],
      'local-hub': ['https://same.example'],
    },
  ])
    expect(() => deletionBrowserOrigins(JSON.stringify(value))).toThrow(
      'DELETION_BROWSER_INVENTORY_INVALID'
    );
});
it('checks both delivered declarations and revocation/readback before verifying the session boundary', async () => {
  process.env['ACCOUNT_DELETION_BROWSER_ORIGINS'] = JSON.stringify({
    'client-interface': [await endpoint()],
    'local-hub': [await endpoint()],
  });
  const gateway = {
    purge: jest.fn(async () => {}),
    readback: jest.fn(async () => 0),
  };
  const adapter = new AccountDeletionBrowserBoundaryAdapter(gateway as never);
  expect(adapter.verificationMode).toBe('session-boundary');
  await adapter.purge({} as never);
  expect(await adapter.readback({} as never)).toBe(0);
  expect(gateway.purge).toHaveBeenCalledTimes(1);
  expect(gateway.readback).toHaveBeenCalledTimes(1);
  invalid = true;
  await expect(adapter.readback({} as never)).rejects.toThrow(
    'DELETION_BROWSER_BOUNDARY_INVALID'
  );
  expect(gateway.readback).toHaveBeenCalledTimes(1);
});
it('never verifies absent frontend inventory or failed session revocation', async () => {
  delete process.env['ACCOUNT_DELETION_BROWSER_ORIGINS'];
  const gateway = {
    purge: jest.fn(async () => {
      throw Error('REVOCATION_FAILED');
    }),
    readback: jest.fn(),
  };
  await expect(
    new AccountDeletionBrowserBoundaryAdapter(gateway as never).purge(
      {} as never
    )
  ).rejects.toThrow('DELETION_BROWSER_INVENTORY_REQUIRED');
  process.env['ACCOUNT_DELETION_BROWSER_ORIGINS'] = JSON.stringify({
    'client-interface': [await endpoint()],
    'local-hub': [await endpoint()],
  });
  await expect(
    new AccountDeletionBrowserBoundaryAdapter(gateway as never).purge(
      {} as never
    )
  ).rejects.toThrow('REVOCATION_FAILED');
  expect(gateway.readback).not.toHaveBeenCalled();
});
