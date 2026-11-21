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
import {
  DirectoryRightsCasesController,
  DirectoryWithdrawalsController,
} from './directory-rights.controller';

const actor = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const decisionId = '33333333-3333-4333-8333-333333333333';
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
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), { status })
    );
const call = (spy: jest.SpyInstance) => ({
  url: spy.mock.calls[0][0] as string,
  init: spy.mock.calls[0][1] as FetchInit,
});

describe('DirectoryRightsCasesController', () => {
  const controller = new DirectoryRightsCasesController();
  const summary = () => ({
    id: caseId,
    status: 'review',
    versionToken: token,
  });

  it('guards every route with directory.rights', () => {
    for (const name of ['list', 'sync', 'detail', 'decide', 'undo'] as const) {
      const handler = controller[name];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toHaveLength(3);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler).permissions).toEqual(
        [DIRECTORY_PERMISSIONS.rights]
      );
    }
  });

  it('lists with a validated query and bearer auth', async () => {
    const spy = reply(200, { cases: [summary()] });
    const out = await controller.list({ status: 'review', limit: '10' }, req);
    expect(out.cases).toHaveLength(1);
    const { url, init } = call(spy);
    expect(url).toBe(
      'http://directory:3120/internal/rights/cases?status=review&limit=10'
    );
    expect(init.headers['authorization']).toBe(`Bearer ${secret}`);
    expect(init.redirect).toBe('error');
    await expect(controller.list({ status: 'bogus' }, req)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.list({ limit: '1000' }, req)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.list({ other: '1' }, req)).rejects.toThrow(
      BadRequestException
    );
  });

  it('requires a verified operator profile', async () => {
    await expect(controller.list({}, { user: {} })).rejects.toThrow(
      ForbiddenException
    );
  });

  it('sends the session actor, never a body-supplied one', async () => {
    const spy = reply(200, { created: 3, existing: 0, lineages: 2 });
    const out = await controller.sync(
      { syncId: decisionId, releaseId: '2026-01-01.0', actorId: 'evil' },
      req
    );
    expect(out).toEqual({
      created: 3,
      existing: 0,
      lineages: 2,
      resolved: 0,
    });
    expect(JSON.parse(call(spy).init.body as string)).toEqual({
      syncId: decisionId,
      releaseId: '2026-01-01.0',
      actorId: actor,
    });
    await expect(
      controller.sync({ syncId: 'x', releaseId: 'r' }, req)
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses malformed decisions before calling Directory', async () => {
    const spy = reply(200, {});
    const good = {
      decisionId,
      action: 'defer',
      reason: 'wait',
      expectedVersionToken: token,
    };
    for (const bad of [
      { ...good, action: 'approve' },
      { ...good, reason: ' ' },
      { ...good, expectedVersionToken: 'short' },
      { ...good, decisionId: 'nope' },
      { ...good, termsSha256: 'zz' },
    ])
      await expect(controller.decide(caseId, bad, req)).rejects.toThrow(
        BadRequestException
      );
    await expect(controller.decide('nope', good, req)).rejects.toThrow(
      BadRequestException
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('records a decision and maps 409 to a machine code', async () => {
    const good = {
      decisionId,
      action: 'exclude_field',
      reason: 'rights holder asked',
      expectedVersionToken: token,
    };
    let spy = reply(200, { replayed: false, status: 'excluded' });
    expect(await controller.decide(caseId, good, req)).toEqual({
      recorded: true,
      replayed: false,
      status: 'excluded',
    });
    expect(call(spy).url).toBe(
      `http://directory:3120/internal/rights/cases/${caseId}/decisions`
    );
    expect(JSON.parse(call(spy).init.body as string).actorId).toBe(actor);
    jest.restoreAllMocks();
    spy = reply(409, { code: 'stale_decision', leak: 'x' });
    await expect(controller.decide(caseId, good, req)).rejects.toMatchObject({
      response: { code: 'stale_decision' },
    });
    await expect(controller.decide(caseId, good, req)).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('undoes with the version token and maps failures', async () => {
    const body = {
      decisionId,
      undoOf: '44444444-4444-4444-8444-444444444444',
      reason: 'mistake',
      expectedVersionToken: token,
    };
    reply(200, { replayed: true, status: 'review' });
    expect(await controller.undo(caseId, body, req)).toEqual({
      recorded: true,
      replayed: true,
      status: 'review',
    });
    jest.restoreAllMocks();
    reply(404);
    await expect(controller.detail(caseId, req)).rejects.toThrow(
      NotFoundException
    );
    jest.restoreAllMocks();
    reply(500);
    await expect(controller.detail(caseId, req)).rejects.toThrow(
      ServiceUnavailableException
    );
    delete process.env['DIRECTORY_LOCAL_EVALUATION'];
    await expect(controller.list({}, req)).rejects.toThrow(
      ServiceUnavailableException
    );
  });
});

describe('DirectoryWithdrawalsController', () => {
  const controller = new DirectoryWithdrawalsController();
  const record = () => ({
    id: decisionId,
    kind: 'row',
    status: 'pending',
  });
  const body = {
    id: decisionId,
    kind: 'row',
    target: `${'a'.repeat(64)}:1`,
    reason: 'owner asked',
    confirm: 'WITHDRAW',
  };

  it('requires the typed confirmation', async () => {
    const spy = reply(200, {});
    for (const bad of [
      { ...body, confirm: 'withdraw' },
      { ...body, confirm: undefined },
      { ...body, kind: 'everything' },
      { ...body, reason: '' },
      { ...body, id: 'nope' },
    ])
      await expect(controller.create(bad, req)).rejects.toThrow(
        BadRequestException
      );
    expect(spy).not.toHaveBeenCalled();
  });

  it('creates with the session actor and is replay-aware', async () => {
    const spy = reply(200, { replayed: false, request: record() });
    const out = await controller.create({ ...body, actorId: 'evil' }, req);
    expect(out.replayed).toBe(false);
    expect(JSON.parse(call(spy).init.body as string).actorId).toBe(actor);
    expect(call(spy).url).toBe('http://directory:3120/internal/withdrawals');
  });

  it('lists and reads with validation', async () => {
    reply(200, { requests: [record()] });
    expect(
      (await controller.list({ status: 'running' }, req)).requests
    ).toHaveLength(1);
    await expect(controller.list({ status: 'x' }, req)).rejects.toThrow(
      BadRequestException
    );
    jest.restoreAllMocks();
    reply(200, record());
    expect((await controller.detail(decisionId, req))['id']).toBe(decisionId);
    await expect(controller.detail('nope', req)).rejects.toThrow(
      BadRequestException
    );
    jest.restoreAllMocks();
    reply(200, { id: decisionId, kind: 'row', status: 'weird' });
    await expect(controller.detail(decisionId, req)).rejects.toThrow(
      ServiceUnavailableException
    );
  });
});
