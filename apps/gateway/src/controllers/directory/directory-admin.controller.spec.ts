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
import { AuthGuard } from '../../auth/auth.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { DirectoryAdminController } from './directory-admin.controller';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const actor = '11111111-1111-4111-8111-111111111111';
const town = '33333333-3333-4333-8333-333333333333';
const binding = '44444444-4444-4444-8444-444444444444';
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
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    })
  );
const call = (spy: jest.SpyInstance) => ({
  url: spy.mock.calls[0][0] as string,
  init: spy.mock.calls[0][1] as FetchInit,
});

describe('DirectoryAdminController', () => {
  const controller = new DirectoryAdminController();

  it('guards every route with auth, owner scope and the right permission', () => {
    const operate = [
      'bindings',
      'revalidate',
      'startRenormalize',
      'job',
    ] as const;
    const review = ['lockState', 'lock', 'unlock'] as const;
    for (const [names, permission] of [
      [operate, DIRECTORY_PERMISSIONS.operate],
      [review, DIRECTORY_PERMISSIONS.review],
    ] as const)
      for (const name of names) {
        const handler = controller[name];
        const guards = Reflect.getMetadata(GUARDS_METADATA, handler);
        expect(guards).toHaveLength(3);
        expect(guards.slice(0, 2)).toEqual([
          AuthGuard,
          DirectoryOwnerScopeGuard,
        ]);
        expect(
          Reflect.getMetadata(PERMISSIONS_KEY, handler).permissions
        ).toEqual([permission]);
      }
  });

  it('lists suspended bindings with a validated query', async () => {
    const spy = reply(200, { bindings: [], total: 0, nextCursor: null });
    await controller.bindings(
      { state: 'suspended', townId: town, limit: '20', cursor: 'abc' },
      req
    );
    const { url, init } = call(spy);
    expect(url).toBe(
      `http://directory:3120/internal/reviewed-bindings?state=suspended&townId=${town}&limit=20&cursor=abc`
    );
    expect(init.headers['authorization']).toBe(`Bearer ${secret}`);
    expect(init.redirect).toBe('error');
    for (const bad of [
      { state: 'active' },
      { townId: 'x' },
      { limit: '0' },
      { limit: '101' },
      { cursor: '' },
      { other: '1' },
    ])
      await expect(controller.bindings(bad, req)).rejects.toThrow(
        BadRequestException
      );
    await expect(controller.bindings({}, { user: {} })).rejects.toThrow(
      ForbiddenException
    );
  });

  it('revalidates one binding with the session actor and returns only a checked shape', async () => {
    const spy = reply(200, {
      bindingId: binding,
      outcome: 'confirmed',
      state: 'active',
      stateCause: null,
    });
    await controller.revalidate(binding, undefined, req);
    expect(JSON.parse(call(spy).init.body as string)).toEqual({
      actorId: actor,
    });
    await expect(
      controller.revalidate(binding, { actorId: 'evil' }, req)
    ).rejects.toThrow(BadRequestException);
    await expect(controller.revalidate('x', undefined, req)).rejects.toThrow(
      BadRequestException
    );
    spy.mockRestore();
    reply(200, { bindingId: 'other', outcome: 'confirmed' });
    await expect(
      controller.revalidate(binding, undefined, req)
    ).rejects.toThrow(ServiceUnavailableException);
    jest.restoreAllMocks();
    reply(503);
    await expect(
      controller.revalidate(binding, undefined, req)
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('locks and unlocks with a required reason and carries only known refusal details', async () => {
    const state = { locked: true, lock: { version: 1 } };
    let spy = reply(200, state);
    await controller.lock(town, { reason: ' pin it ' }, req);
    expect(call(spy).url).toBe(
      `http://directory:3120/internal/towns/${town}/boundary-lock`
    );
    expect(JSON.parse(call(spy).init.body as string)).toEqual({
      actorId: actor,
      reason: 'pin it',
    });
    spy.mockRestore();
    spy = reply(200, { locked: false, lock: null });
    await controller.unlock(town, { reason: 'wrong boundary' }, req);
    expect(call(spy).url).toBe(
      `http://directory:3120/internal/towns/${town}/boundary-unlock`
    );
    for (const bad of [
      undefined,
      {},
      { reason: ' ' },
      { reason: 'r', actorId: 'evil' },
    ]) {
      await expect(controller.lock(town, bad, req)).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.unlock(town, bad, req)).rejects.toThrow(
        BadRequestException
      );
    }
    await expect(controller.lock('x', { reason: 'r' }, req)).rejects.toThrow(
      BadRequestException
    );
    for (const detail of [
      'already_locked',
      'no_verified_boundary',
      'not_locked',
    ]) {
      jest.restoreAllMocks();
      reply(409, { code: 'invalid_state', detail });
      await expect(
        controller.lock(town, { reason: 'r' }, req)
      ).rejects.toMatchObject({ response: { code: 'invalid_state', detail } });
    }
    jest.restoreAllMocks();
    reply(409, { code: 'invalid_state', detail: 'secret internals' });
    const refused = await controller
      .lock(town, { reason: 'r' }, req)
      .catch((e) => e);
    expect(refused).toBeInstanceOf(ConflictException);
    expect(refused.response.detail).toBeUndefined();
    jest.restoreAllMocks();
    reply(200, { locked: false, lock: null });
    await expect(controller.lockState('x', req)).rejects.toThrow(
      BadRequestException
    );
    expect(await controller.lockState(town, req)).toEqual({
      locked: false,
      lock: null,
    });
  });

  it('starts a job as a dry run by default and requires a reason for a real run', async () => {
    const job = { id: binding, status: 'running' };
    const spy = reply(202, job);
    await controller.startRenormalize({}, req);
    expect(JSON.parse(call(spy).init.body as string)).toEqual({
      actorId: actor,
      dryRun: true,
    });
    spy.mockRestore();
    const real = reply(202, job);
    await controller.startRenormalize(
      { townId: town, dryRun: false, reason: ' cutover ' },
      req
    );
    expect(JSON.parse(call(real).init.body as string)).toEqual({
      actorId: actor,
      townId: town,
      dryRun: false,
      reason: 'cutover',
    });
    for (const bad of [
      { dryRun: false },
      { dryRun: 'no' },
      { townId: 'x' },
      { actorId: 'evil' },
      undefined,
    ])
      await expect(controller.startRenormalize(bad, req)).rejects.toThrow(
        BadRequestException
      );
    jest.restoreAllMocks();
    reply(409, { code: 'invalid_state', detail: 'job_running' });
    await expect(controller.startRenormalize({}, req)).rejects.toMatchObject({
      response: { detail: 'job_running' },
    });
  });

  it('reads a job and maps unknown ids to 404', async () => {
    reply(200, { id: binding, status: 'succeeded' });
    expect(await controller.job(binding, req)).toMatchObject({
      status: 'succeeded',
    });
    await expect(controller.job('x', req)).rejects.toThrow(BadRequestException);
    jest.restoreAllMocks();
    reply(404);
    await expect(controller.job(binding, req)).rejects.toThrow(
      NotFoundException
    );
  });

  it('is unavailable when Directory is not configured', async () => {
    delete process.env['DIRECTORY_LOCAL_EVALUATION'];
    const spy = jest.spyOn(globalThis, 'fetch');
    await expect(controller.bindings({}, req)).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
