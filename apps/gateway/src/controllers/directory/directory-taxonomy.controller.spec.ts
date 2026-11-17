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
import { DirectoryTaxonomyController } from './directory-taxonomy.controller';

const actor = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
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
const call = (spy: jest.SpyInstance) => ({
  url: spy.mock.calls[0][0] as string,
  init: spy.mock.calls[0][1] as FetchInit,
});

describe('DirectoryTaxonomyController', () => {
  const controller = new DirectoryTaxonomyController();
  const summary = () => ({ id: caseId, status: 'open', versionToken: token });
  const run = () => ({ id: caseId, status: 'pending', mode: 'dry_run' });

  it('guards every route with directory.operate', () => {
    for (const name of [
      'mappings',
      'install',
      'cases',
      'raise',
      'caseDetail',
      'decide',
      'undo',
      'runs',
      'createRun',
      'runDetail',
      'cancelRun',
      'rollbackRun',
    ] as const) {
      const handler = controller[name];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toHaveLength(3);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler).permissions).toEqual(
        [DIRECTORY_PERMISSIONS.operate]
      );
    }
  });

  it('lists cases with a validated query and bearer auth', async () => {
    const spy = reply(200, { cases: [summary()] });
    const out = await controller.cases(
      { status: 'open', townId: town, limit: '10' },
      req
    );
    expect(out.cases).toHaveLength(1);
    const { url, init } = call(spy);
    expect(url).toBe(
      `http://directory:3120/internal/taxonomy/cases?status=open&townId=${town}&limit=10`
    );
    expect(init.headers['authorization']).toBe(`Bearer ${secret}`);
    expect(init.redirect).toBe('error');
    for (const bad of [
      { status: 'bogus' },
      { townId: 'x' },
      { limit: '1000' },
      { other: '1' },
    ])
      await expect(controller.cases(bad, req)).rejects.toThrow(
        BadRequestException
      );
    await expect(controller.runs({ status: 'open' }, req)).rejects.toThrow(
      BadRequestException
    );
  });

  it('requires a verified operator profile', async () => {
    await expect(controller.cases({}, { user: {} })).rejects.toThrow(
      ForbiddenException
    );
  });

  it('installs a mapping with the session actor only', async () => {
    const spy = reply(200, { replayed: false, version: { id: 'v' } });
    await controller.install(
      { version: 'v1', activate: true, actorId: 'evil' },
      req
    );
    expect(JSON.parse(call(spy).init.body as string)).toEqual({
      version: 'v1',
      activate: true,
      actorId: actor,
    });
    await expect(controller.install({ version: 'v1' }, req)).rejects.toThrow(
      BadRequestException
    );
    await expect(
      controller.install({ version: '../x', activate: true }, req)
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses malformed decisions before calling Directory', async () => {
    const spy = reply(200, {});
    const good = {
      decisionId,
      action: 'assign',
      categoryId: 'services',
      reason: 'fix',
      expectedVersionToken: token,
    };
    for (const bad of [
      { ...good, action: 'nuke' },
      { ...good, categoryId: undefined },
      { ...good, action: 'defer' },
      { ...good, reason: ' ' },
      { ...good, expectedVersionToken: 'short' },
      { ...good, decisionId: 'x' },
      { ...good, placeTypeId: 5 },
    ])
      await expect(controller.decide(caseId, bad, req)).rejects.toThrow(
        BadRequestException
      );
    await expect(controller.decide('x', good, req)).rejects.toThrow(
      BadRequestException
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('decides and undoes, returning only the checked shape', async () => {
    const spy = reply(200, { replayed: false, status: 'assigned', leak: 1 });
    const out = await controller.decide(
      caseId,
      {
        decisionId,
        action: 'assign',
        categoryId: 'services',
        reason: 'fix',
        expectedVersionToken: token,
      },
      req
    );
    expect(out).toEqual({
      recorded: true,
      replayed: false,
      status: 'assigned',
    });
    expect(JSON.parse(call(spy).init.body as string).actorId).toBe(actor);
    reply(200, { replayed: true, status: 'open' });
    expect(
      await controller.undo(
        caseId,
        {
          decisionId,
          undoOf: decisionId,
          reason: 'oops',
          expectedVersionToken: token,
        },
        req
      )
    ).toEqual({ recorded: true, replayed: true, status: 'open' });
    reply(200, { replayed: true, status: 'nonsense' });
    await expect(
      controller.undo(
        caseId,
        {
          decisionId,
          undoOf: decisionId,
          reason: 'oops',
          expectedVersionToken: token,
        },
        req
      )
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('maps Directory statuses', async () => {
    const body = {
      decisionId,
      action: 'defer',
      reason: 'wait',
      expectedVersionToken: token,
    };
    reply(409, { code: 'stale_decision' });
    await expect(controller.decide(caseId, body, req)).rejects.toThrow(
      ConflictException
    );
    reply(404);
    await expect(controller.caseDetail(caseId, req)).rejects.toThrow(
      NotFoundException
    );
    reply(500);
    await expect(controller.caseDetail(caseId, req)).rejects.toThrow(
      ServiceUnavailableException
    );
  });

  it('creates runs with strict mode rules', async () => {
    const dry = {
      id: caseId,
      mappingVersion: 'v1',
      scope: 'town',
      townId: town,
      mode: 'dry_run',
      reason: 'plan',
    };
    const spy = reply(200, { replayed: false, run: run() });
    expect((await controller.createRun(dry, req)).run).toEqual(run());
    expect(JSON.parse(call(spy).init.body as string)).toEqual({
      ...dry,
      actorId: actor,
    });
    const apply = {
      ...dry,
      mode: 'apply',
      expectedPlanHash: token,
      confirm: 'APPLY',
    };
    for (const bad of [
      { ...dry, expectedPlanHash: token },
      { ...dry, scope: 'all' },
      { ...dry, townId: undefined },
      { ...apply, confirm: 'yes' },
      { ...apply, expectedPlanHash: 'abc' },
      { ...dry, mode: 'other' },
    ])
      await expect(controller.createRun(bad, req)).rejects.toThrow(
        BadRequestException
      );
    reply(200, { replayed: false, run: { ...run(), mode: 'apply' } });
    await controller.createRun(apply, req);
    const all = { ...apply, scope: 'all', townId: undefined };
    await controller.createRun(all, req);
  });

  it('cancels and rolls back with confirmation', async () => {
    const spy = reply(200, { replayed: false, run: run() });
    await controller.cancelRun(caseId, { reason: 'stop' }, req);
    expect(call(spy).url).toBe(
      `http://directory:3120/internal/taxonomy/runs/${caseId}/cancel`
    );
    await expect(
      controller.rollbackRun(caseId, { reason: 'undo' }, req)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.rollbackRun(caseId, { reason: 'undo', confirm: 'APPLY' }, req)
    ).rejects.toThrow(BadRequestException);
    reply(200, { replayed: false, run: run() });
    const out = await controller.rollbackRun(
      caseId,
      { reason: 'undo', confirm: 'ROLLBACK' },
      req
    );
    expect(out.replayed).toBe(false);
  });

  it('is unavailable without configuration', async () => {
    process.env['DIRECTORY_LOCAL_EVALUATION'] = 'false';
    await expect(controller.mappings({}, req)).rejects.toThrow(
      ServiceUnavailableException
    );
  });
});
