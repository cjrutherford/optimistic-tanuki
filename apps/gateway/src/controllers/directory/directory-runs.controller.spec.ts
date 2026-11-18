import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { DirectoryRunsController } from './directory-runs.controller';

const actor = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';
const decisionId = '33333333-3333-4333-8333-333333333333';
const town = '44444444-4444-4444-8444-444444444444';
const token = 'a'.repeat(64);
const secret = 'x'.repeat(32);
const req = { user: { profileId: actor } };

interface FetchInit {
  method?: string;
  headers: Record<string, string>;
  body?: string;
  redirect?: string;
}

const original = {
  mode: process.env['DIRECTORY_LOCAL_EVALUATION'],
  base: process.env['DIRECTORY_INTERNAL_URL'],
  secret: process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'],
};
beforeEach(() => {
  process.env['DIRECTORY_LOCAL_EVALUATION'] = 'true';
  process.env['DIRECTORY_INTERNAL_URL'] = 'http://directory:3120/';
  process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'] = secret;
});
afterEach(() => {
  jest.restoreAllMocks();
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore('DIRECTORY_LOCAL_EVALUATION', original.mode);
  restore('DIRECTORY_INTERNAL_URL', original.base);
  restore('DIRECTORY_LOCAL_EVALUATION_SECRET', original.secret);
});

const reply = (status: number, body?: unknown) =>
  jest.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      })
  );
const call = (spy: jest.SpyInstance) => {
  const last = spy.mock.calls[spy.mock.calls.length - 1];
  return { url: last[0] as string, init: last[1] as FetchInit };
};

describe('DirectoryRunsController', () => {
  const controller = new DirectoryRunsController();
  const summary = () => ({
    id: runId,
    status: 'blocked',
    kind: 'overture-stage',
    blockedReason: 'acquisition_unauthorized',
  });
  const detail = () => ({
    ...summary(),
    jobs: [],
    events: [],
    versionToken: token,
    resumeCommand: null,
  });
  const action = (extra: Record<string, unknown> = {}) => ({
    decisionId,
    reason: 'operator request',
    expectedVersionToken: token,
    ...extra,
  });

  it('guards every route with directory.operate', () => {
    for (const name of [
      'list',
      'latest',
      'budget',
      'importHistory',
      'runDetail',
      'cancel',
      'resume',
      'retry',
    ] as const) {
      const handler = controller[name];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toHaveLength(3);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler).permissions).toEqual(
        [DIRECTORY_PERMISSIONS.operate]
      );
    }
  });

  it('lists runs with a validated query and bearer auth', async () => {
    const spy = reply(200, { runs: [summary()], total: 1 });
    const out = await controller.list(
      { status: 'blocked', townId: town, limit: '10' },
      req
    );
    expect(out).toEqual({ runs: [summary()], total: 1 });
    const { url, init } = call(spy);
    expect(url).toBe(
      `http://directory:3120/internal/acquisition/runs?status=blocked&townId=${town}&limit=10`
    );
    expect(init.headers['authorization']).toBe(`Bearer ${secret}`);
    expect(init.redirect).toBe('error');
    for (const bad of [
      { status: 'bogus' },
      { townId: 'x' },
      { limit: '1000' },
      { other: '1' },
    ])
      await expect(controller.list(bad, req)).rejects.toThrow(
        BadRequestException
      );
  });

  it('requires a verified operator profile and configuration', async () => {
    await expect(controller.list({}, { user: {} })).rejects.toThrow(
      ForbiddenException
    );
    delete process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'];
    await expect(controller.list({}, req)).rejects.toThrow(
      ServiceUnavailableException
    );
  });

  it('reads latest, detail and the budget panel through checked shapes', async () => {
    reply(200, detail());
    expect((await controller.latest(req)).id).toBe(runId);
    reply(200, detail());
    expect((await controller.runDetail(runId, req)).id).toBe(runId);
    await expect(controller.runDetail('nope', req)).rejects.toThrow(
      BadRequestException
    );
    reply(404);
    await expect(controller.runDetail(runId, req)).rejects.toThrow(
      NotFoundException
    );
    reply(200, { ...detail(), versionToken: 'short' });
    await expect(controller.runDetail(runId, req)).rejects.toThrow(
      ServiceUnavailableException
    );
    const budget = {
      period: '2026-11',
      ceilingCents: 2500,
      reservedCents: 0,
      usedCents: 0,
      remainingCents: 2500,
      anonymousAttempts: 0,
      hardStop: false,
      acquisitionAuthorized: false,
    };
    const spy = reply(200, budget);
    expect(await controller.budget({}, req)).toEqual(budget);
    expect(call(spy).url).toBe(
      'http://directory:3120/internal/acquisition/budget'
    );
    await expect(controller.budget({ x: '1' }, req)).rejects.toThrow(
      BadRequestException
    );
  });

  it('sends cancel, resume and retry with the session actor and exact confirmation', async () => {
    const spy = reply(200, {
      replayed: false,
      run: detail(),
      resumeCommand:
        'DIRECTORY_LOCAL_EVALUATION=true node scripts/x.cjs --resume y',
    });
    const out = await controller.resume(
      runId,
      action({ confirm: 'RESUME' }),
      req
    );
    expect(out.resumeCommand).toContain('--resume');
    const { url, init } = call(spy);
    expect(url).toBe(
      `http://directory:3120/internal/acquisition/runs/${runId}/resume`
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      actorId: actor,
      decisionId,
      confirm: 'RESUME',
    });
    reply(200, { replayed: true, run: detail(), resumeCommand: null });
    expect(
      (await controller.cancel(runId, action({ confirm: 'CANCEL' }), req))
        .replayed
    ).toBe(true);
    const retry = reply(200, { replayed: false, run: detail() });
    await controller.retry(
      runId,
      action({ confirm: 'RETRY', unitKey: 'asset-1' }),
      req
    );
    expect(JSON.parse(call(retry).init.body as string).unitKey).toBe('asset-1');
  });

  it('refuses malformed action bodies before any network call', async () => {
    const spy = reply(200, {});
    const bad: Array<[Promise<unknown>]> = [
      [controller.cancel(runId, action({ confirm: 'RESUME' }), req)],
      [controller.cancel(runId, action(), req)],
      [
        controller.cancel(
          runId,
          action({ confirm: 'CANCEL', unitKey: 'a' }),
          req
        ),
      ],
      [controller.retry(runId, action({ confirm: 'RETRY' }), req)],
      [
        controller.retry(
          runId,
          action({ confirm: 'RETRY', unitKey: 'bad key!' }),
          req
        ),
      ],
      [controller.resume(runId, { confirm: 'RESUME' }, req)],
      [
        controller.resume(
          runId,
          action({ confirm: 'RESUME', expectedVersionToken: 'x' }),
          req
        ),
      ],
      [
        controller.resume(
          runId,
          action({ confirm: 'RESUME', extra: true }),
          req
        ),
      ],
      [controller.resume('nope', action({ confirm: 'RESUME' }), req)],
    ];
    for (const [p] of bad) await expect(p).rejects.toThrow(BadRequestException);
    expect(spy).not.toHaveBeenCalled();
  });

  it('maps a 409 to a machine code and passes only a known blocked reason', async () => {
    reply(409, { code: 'run_blocked', reason: 'quota_exhausted' });
    await expect(
      controller.resume(runId, action({ confirm: 'RESUME' }), req)
    ).rejects.toMatchObject({
      response: { code: 'run_blocked', reason: 'quota_exhausted' },
    });
    reply(409, { code: 'stale_decision', reason: 'https://secret.example/x' });
    const error = await controller
      .cancel(runId, action({ confirm: 'CANCEL' }), req)
      .catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toEqual({
      code: 'stale_decision',
      message: 'Request refused',
    });
  });

  it('imports history with an idempotent decision id and nothing else', async () => {
    const spy = reply(200, { replayed: false, created: 3, existing: 1 });
    expect(
      await controller.importHistory({ decisionId, reason: 'backfill' }, req)
    ).toEqual({ replayed: false, created: 3, existing: 1 });
    expect(JSON.parse(call(spy).init.body as string)).toEqual({
      decisionId,
      reason: 'backfill',
      actorId: actor,
    });
    for (const body of [
      {},
      { decisionId, reason: '' },
      { decisionId: 'x', reason: 'r' },
      { decisionId, reason: 'r', actorId: actor },
      { decisionId, reason: 'r', release: 'has space' },
      { decisionId, reason: 'r', release: 7 },
    ])
      await expect(controller.importHistory(body, req)).rejects.toThrow(
        BadRequestException
      );
  });

  it('forwards a declared release on history import', async () => {
    const spy = reply(200, { replayed: false, created: 0, existing: 11 });
    await controller.importHistory(
      { decisionId, reason: 'record release', release: '2026-10-21.0' },
      req
    );
    expect(JSON.parse(call(spy).init.body as string)).toEqual({
      decisionId,
      reason: 'record release',
      release: '2026-10-21.0',
      actorId: actor,
    });
  });

  it('never leaks upstream failures', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('10.0.0.5'));
    await expect(controller.list({}, req)).rejects.toThrow(
      ServiceUnavailableException
    );
    reply(500, { error: 'boom' });
    await expect(controller.list({}, req)).rejects.toThrow(
      ServiceUnavailableException
    );
  });
});
