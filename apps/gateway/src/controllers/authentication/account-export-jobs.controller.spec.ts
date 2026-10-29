import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { of, throwError } from 'rxjs';
import { AddressInfo } from 'node:net';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { AccountExportJobsController } from './account-export-jobs.controller';
const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  JOB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  KEY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
describe('U01 export job HTTP boundary', () => {
  let app: INestApplication, base: string, reply: unknown;
  let send: jest.Mock;
  beforeAll(async () => {
    send = jest.fn(() => of(reply));
    const module = await Test.createTestingModule({
      controllers: [AccountExportJobsController],
      providers: [
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: { send } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = {
            userId: ACCOUNT,
            appId: req.headers['x-fixture-app'] ?? 'local-hub',
          };
          req.credential = 'server-only-credential';
          return true;
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    await app.listen(0, '127.0.0.1');
    base =
      'http://127.0.0.1:' +
      (app.getHttpServer().address() as AddressInfo).port +
      '/authentication/account-export';
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    send.mockClear();
    send.mockImplementation(() => of(reply));
    reply = {
      jobId: JOB,
      accountId: ACCOUNT,
      appId: 'local-hub',
      state: 'running',
      coverageSummary: {
        privateArtifact: 'PRIVATE_DESCRIPTOR',
        artifactAvailable: false,
      },
      artifactUrl: null,
    };
  });
  const post = (path: string, body: unknown) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  it('keeps AuthGuard on every route and derives account, scope and credential from it', async () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AccountExportJobsController)
    ).toContain(AuthGuard);
    const response = await post('', {
      accountId: ACCOUNT,
      idempotencyKey: KEY,
    });
    expect(response.status).toBe(201);
    expect(send).toHaveBeenCalledWith(
      { cmd: AuthCommands.CreateAccountExportJob },
      {
        accountId: ACCOUNT,
        appId: 'local-hub',
        token: 'server-only-credential',
        idempotencyKey: KEY,
      }
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
    const body = await response.text();
    expect(body).not.toContain('PRIVATE_DESCRIPTOR');
    expect(body).not.toContain('credential');
  });
  it('rejects a stale account confirmation before making an RPC', async () => {
    expect(
      (await post('', { accountId: JOB, idempotencyKey: KEY })).status
    ).toBe(409);
    expect(send).not.toHaveBeenCalled();
  });
  it('does not accept submitted tokens or unsupported product scope', async () => {
    expect(
      (
        await post('', {
          accountId: ACCOUNT,
          idempotencyKey: KEY,
          token: 'injected',
        })
      ).status
    ).toBe(400);
    expect(
      (
        await fetch(base + '?accountId=' + ACCOUNT, {
          headers: { 'x-fixture-app': 'another-product' },
        })
      ).status
    ).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });
  it('restores scoped status, preserves an empty state and validates job IDs', async () => {
    reply = null;
    expect(
      (await (await fetch(base + '?accountId=' + ACCOUNT)).json()).job
    ).toBeNull();
    expect(send).toHaveBeenCalledWith(
      { cmd: AuthCommands.GetLatestAccountExportJob },
      {
        accountId: ACCOUNT,
        appId: 'local-hub',
        token: 'server-only-credential',
      }
    );
    send.mockClear();
    expect((await fetch(base + '/not-a-job?accountId=' + ACCOUNT)).status).toBe(
      400
    );
    expect(send).not.toHaveBeenCalled();
  });
  it('never publishes another account response or a forged artifact URL', async () => {
    reply = { ...(reply as object), accountId: JOB };
    expect((await fetch(base + '?accountId=' + ACCOUNT)).status).toBe(502);
    reply = {
      ...(reply as object),
      accountId: ACCOUNT,
      state: 'complete',
      coverageSummary: { artifactAvailable: true },
      artifactUrl: 'https://attacker.example/archive',
    };
    expect(
      (await (await fetch(base + '?accountId=' + ACCOUNT)).json()).job
        .downloadUrl
    ).toBeNull();
  });
  it('only exposes a ready same-job download and routes explicit retry/cancel commands', async () => {
    reply = {
      ...(reply as object),
      state: 'complete',
      coverageSummary: { artifactAvailable: true },
      artifactUrl: `/api/authentication/account-export/${JOB}/download`,
    };
    expect(
      (await (await fetch(base + '/' + JOB + '?accountId=' + ACCOUNT)).json())
        .downloadUrl
    ).toBe(`/api/authentication/account-export/${JOB}/download`);
    for (const [action, cmd] of [
      ['retry', AuthCommands.ResumeAccountExportJob],
      ['cancel', AuthCommands.CancelAccountExportJob],
    ]) {
      expect(
        (await post('/' + JOB + '/' + action, { accountId: ACCOUNT })).status
      ).toBe(201);
      expect(send).toHaveBeenLastCalledWith(
        { cmd },
        {
          jobId: JOB,
          accountId: ACCOUNT,
          appId: 'local-hub',
          token: 'server-only-credential',
        }
      );
    }
  });
  it('maps bounded service errors without returning their private payload', async () => {
    send.mockImplementation(() =>
      throwError(() => ({ statusCode: 409, message: 'PRIVATE_SQL' }))
    );
    const response = await post('', {
      accountId: ACCOUNT,
      idempotencyKey: KEY,
    });
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain('PRIVATE_SQL');
  });
});
