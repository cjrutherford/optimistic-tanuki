import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { deletionIdentityKey } from '@optimistic-tanuki/storage';
import { AccountDeletionPublicController } from './account-deletion-public.controller';
import { AccountDeletionReceiptService } from './account-deletion-receipt.service';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const ACCOUNT = randomUUID(),
  OTHER = randomUUID(),
  KEY = randomUUID(),
  APP = 'local-hub';
describe('U02 authenticated acceptance and independent receipt recovery', () => {
  let row: any,
    controller: AccountDeletionPublicController,
    receipts: AccountDeletionReceiptService;
  let auth: { validateToken: jest.Mock },
    authority: { accept: jest.Mock; status: jest.Mock },
    runner: { run: jest.Mock };
  beforeEach(() => {
    row = null;
    auth = {
      validateToken: jest.fn(async () => ({
        isValid: true,
        data: { userId: ACCOUNT, appId: APP },
      })),
    };
    receipts = new AccountDeletionReceiptService(
      new ConfigService({
        auth: { jwt_secret: 'public-receipt-unit-secret-with-strong-length' },
      })
    );
    authority = {
      accept: jest.fn(async (account, app, key, id) => {
        row = {
          id,
          appId: app,
          idempotencyKey: key,
          fenceKey: deletionIdentityKey('account', account),
          state: 'fencing',
          privateScope: { must: 'never be returned' },
        };
        return row;
      }),
      status: jest.fn(async () => ({
        state: row.state,
        accountId: ACCOUNT,
        privateScope: 'PRIVATE_SCOPE',
      })),
    };
    runner = { run: jest.fn(async () => {}) };
    const db = { getRepository: () => ({ findOne: jest.fn(async () => row) }) };
    controller = new AccountDeletionPublicController(
      auth as never,
      authority as never,
      receipts,
      runner as never,
      db as never
    );
  });
  async function prepare() {
    return (await controller.prepare({
      token: 'live-session',
      appId: APP,
      idempotencyKey: KEY,
    }))!.receipt;
  }
  it('prepares recovery before mutation and preserves it over a lost acceptance response', async () => {
    const receipt = await prepare();
    expect(authority.accept).not.toHaveBeenCalled();
    expect(runner.run).not.toHaveBeenCalled();
    expect((await controller.read({ receipt, appId: APP })).state).toBe(
      'not-accepted'
    );
    const binding = receipts.verify(receipt, APP);
    await controller.accept({
      receipt,
      appId: APP,
      token: 'live-session',
      confirmation: 'delete-account',
    });
    expect(authority.accept).toHaveBeenCalledWith(
      ACCOUNT,
      APP,
      KEY,
      binding.operationId
    );
    auth.validateToken.mockRejectedValue(Error('session revoked'));
    const calls = auth.validateToken.mock.calls.length;
    expect((await controller.read({ receipt, appId: APP })).state).toBe(
      'fencing'
    );
    expect(auth.validateToken).toHaveBeenCalledTimes(calls);
  });
  it('reads completion after root removal and only returns minimal receipt fields', async () => {
    const receipt = await prepare();
    await controller.accept({
      receipt,
      appId: APP,
      token: 'live-session',
      confirmation: 'delete-account',
    });
    row.state = 'complete';
    row.idempotencyKey = '00000000-0000-0000-0000-000000000000';
    const result = await controller.read({ receipt, appId: APP });
    expect(result.state).toBe('complete');
    expect(Object.keys(result).sort()).toEqual([
      'appId',
      'canRetry',
      'expiresAt',
      'operationId',
      'state',
    ]);
    expect(JSON.stringify(result)).not.toContain(ACCOUNT);
  });
  it('rejects a valid preparation presented by another account and requires explicit confirmation', async () => {
    const receipt = await prepare();
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: OTHER, appId: APP },
    });
    await expect(
      controller.accept({
        receipt,
        appId: APP,
        token: 'other-session',
        confirmation: 'delete-account',
      })
    ).rejects.toBeTruthy();
    await expect(
      controller.accept({
        receipt,
        appId: APP,
        token: 'other-session',
        confirmation: 'yes',
      })
    ).rejects.toBeTruthy();
    expect(authority.accept).not.toHaveBeenCalled();
  });
  it('cannot begin deletion or accept caller-selected accounts/grants with a receipt alone', async () => {
    const receipt = await prepare();
    await controller.retry({ receipt, appId: APP });
    expect(runner.run).not.toHaveBeenCalled();
    await expect(
      controller.accept({ receipt, appId: APP, confirmation: 'delete-account' })
    ).rejects.toBeTruthy();
    await expect(
      controller.accept({
        receipt,
        appId: APP,
        token: 'live-session',
        confirmation: 'delete-account',
        accountId: OTHER,
      })
    ).rejects.toBeTruthy();
    expect(authority.accept).not.toHaveBeenCalled();
  });
  it('only retries an accepted blocked operation, without a live session', async () => {
    const receipt = await prepare();
    await controller.accept({
      receipt,
      appId: APP,
      token: 'live-session',
      confirmation: 'delete-account',
    });
    runner.run.mockClear();
    row.state = 'blocked';
    auth.validateToken.mockRejectedValue(Error('revoked'));
    expect((await controller.retry({ receipt, appId: APP })).canRetry).toBe(
      true
    );
    expect(runner.run).toHaveBeenCalledWith(row.id);
    row.state = 'complete';
    runner.run.mockClear();
    await controller.retry({ receipt, appId: APP });
    expect(runner.run).not.toHaveBeenCalled();
  });
  it('reuses a saved preparation only for its original account/app', async () => {
    const receipt = await prepare();
    expect(
      (await controller.prepare({
        token: 'live-session',
        appId: APP,
        idempotencyKey: randomUUID(),
        priorReceipt: receipt,
      }))!.receipt
    ).toBe(receipt);
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: OTHER, appId: APP },
    });
    const another = (await controller.prepare({
      token: 'other-session',
      appId: APP,
      idempotencyKey: randomUUID(),
      priorReceipt: receipt,
    }))!.receipt;
    expect(another).not.toBe(receipt);
    expect(receipts.matchesAccount(receipts.verify(another, APP), OTHER)).toBe(
      true
    );
  });
  it('rejects unrelated record bindings and unsupported app scope', async () => {
    const receipt = await prepare();
    await controller.accept({
      receipt,
      appId: APP,
      token: 'live-session',
      confirmation: 'delete-account',
    });
    row.fenceKey = '0'.repeat(64);
    await expect(controller.read({ receipt, appId: APP })).rejects.toBeTruthy();
    await expect(
      controller.read({ receipt, appId: 'other-product' })
    ).rejects.toBeTruthy();
  });
});
