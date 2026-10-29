import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { of, throwError } from 'rxjs';
import { AddressInfo } from 'node:net';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { AccountDeletionHttpController } from './account-deletion.controller';
const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  OP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  KEY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECEIPT =
  Buffer.from(
    JSON.stringify({ v: 1, operationId: OP, appId: 'local-hub' })
  ).toString('base64url') +
  '.' +
  'a'.repeat(64);
describe('U02 deletion HTTP authority boundary', () => {
  let app: INestApplication,
    base: string,
    reply: any,
    send: jest.Mock,
    guard: jest.Mock;
  beforeAll(async () => {
    send = jest.fn(() => of(reply));
    guard = jest.fn((ctx: any) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = { userId: ACCOUNT, appId: 'local-hub' };
      req.credential = 'private-session';
      return true;
    });
    const module = await Test.createTestingModule({
      controllers: [AccountDeletionHttpController],
      providers: [
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: { send } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: guard })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    await app.listen(0, '127.0.0.1');
    base =
      'http://127.0.0.1:' +
      (app.getHttpServer().address() as AddressInfo).port +
      '/authentication/account-deletion';
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    guard.mockClear();
    send.mockClear();
    send.mockImplementation(() => of(reply));
    reply = {
      operationId: OP,
      appId: 'local-hub',
      state: 'fencing',
      canRetry: false,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      privateScope: 'PRIVATE_SCOPE',
    };
  });
  const post = (
    path: string,
    body: unknown,
    headers: Record<string, string> = {}
  ) =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ot-appscope': 'local-hub',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  it('requires normal authentication for preparation and acceptance', () => {
    for (const method of ['prepare', 'accept'] as const)
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          AccountDeletionHttpController.prototype[method]
        )
      ).toContain(AuthGuard);
  });
  it('prepares the receipt without accepting deletion and never forwards a supplied account as authority', async () => {
    reply = { receipt: RECEIPT };
    const response = await post('/prepare', {
      accountId: ACCOUNT,
      idempotencyKey: KEY,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(send).toHaveBeenCalledWith(
      { cmd: AuthCommands.PreparePublicAccountDeletion },
      { token: 'private-session', appId: 'local-hub', idempotencyKey: KEY }
    );
    expect((await response.json()).receipt).toBe(RECEIPT);
  });
  it('rejects stale account state and added authority fields before RPC', async () => {
    expect(
      (await post('/prepare', { accountId: OP, idempotencyKey: KEY })).status
    ).toBe(409);
    expect(
      (
        await post('/prepare', {
          accountId: ACCOUNT,
          idempotencyKey: KEY,
          grant: {},
        })
      ).status
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('requires exact confirmation and projects only minimal accepted status', async () => {
    expect(
      (
        await post('/accept', {
          accountId: ACCOUNT,
          receipt: RECEIPT,
          confirmation: 'yes',
        })
      ).status
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
    const response = await post('/accept', {
      accountId: ACCOUNT,
      receipt: RECEIPT,
      confirmation: 'delete-account',
    });
    expect(response.status).toBe(201);
    expect(await response.text()).not.toContain('PRIVATE_SCOPE');
    expect(send).toHaveBeenCalledWith(
      { cmd: AuthCommands.AcceptPublicAccountDeletion },
      {
        token: 'private-session',
        appId: 'local-hub',
        receipt: RECEIPT,
        confirmation: 'delete-account',
      }
    );
  });
  it('checks status without a normal session and never interprets another account cookie as deletion authority', async () => {
    const response = await fetch(base + '/status', {
      headers: {
        'x-ot-appscope': 'local-hub',
        'x-ot-deletion-receipt': RECEIPT,
        cookie: 'ot_session=newer-account-session',
      },
    });
    expect(response.status).toBe(200);
    expect(guard).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      { cmd: AuthCommands.ReadPublicAccountDeletion },
      { appId: 'local-hub', receipt: RECEIPT }
    );
  });
  it('does not accept receipt credentials from URLs or allow injected retry scope', async () => {
    expect(
      (
        await fetch(base + '/status?receipt=' + RECEIPT, {
          headers: { 'x-ot-appscope': 'local-hub' },
        })
      ).status
    ).toBe(400);
    expect(
      (
        await post(
          '/retry',
          { accountId: OP },
          { 'x-ot-deletion-receipt': RECEIPT }
        )
      ).status
    ).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('routes receipt-only retry and refuses inconsistent status', async () => {
    reply = { ...reply, state: 'blocked', canRetry: true };
    expect(
      (await post('/retry', {}, { 'x-ot-deletion-receipt': RECEIPT })).status
    ).toBe(201);
    expect(guard).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(
      { cmd: AuthCommands.RetryPublicAccountDeletion },
      { receipt: RECEIPT, appId: 'local-hub' }
    );
    reply = { ...reply, state: 'complete', canRetry: true };
    expect(
      (
        await fetch(base + '/status', {
          headers: {
            'x-ot-appscope': 'local-hub',
            'x-ot-deletion-receipt': RECEIPT,
          },
        })
      ).status
    ).toBe(502);
  });
  it('maps receipt expiry without exposing private downstream errors', async () => {
    send.mockImplementation(() =>
      throwError(() => ({ statusCode: 401, message: 'PRIVATE_TOKEN_OR_SQL' }))
    );
    const response = await fetch(base + '/status', {
      headers: {
        'x-ot-appscope': 'local-hub',
        'x-ot-deletion-receipt': RECEIPT,
      },
    });
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('PRIVATE_TOKEN_OR_SQL');
  });
});
