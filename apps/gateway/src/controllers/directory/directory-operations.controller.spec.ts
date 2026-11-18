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
import { DirectoryOperationsController } from './directory-operations.controller';

const actor = '11111111-1111-4111-8111-111111111111';
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
      new Response(
        body === undefined
          ? null
          : typeof body === 'string'
          ? body
          : JSON.stringify(body),
        { status }
      )
    );
const call = (spy: jest.SpyInstance) => ({
  url: spy.mock.calls[0][0] as string,
  init: spy.mock.calls[0][1] as FetchInit,
});
const control = {
  key: 'export_worker',
  paused: true,
  reason: 'maintenance',
  version: 2,
  updatedBy: actor,
  updatedAt: '2026-11-17T00:00:00.000Z',
};

describe('DirectoryOperationsController', () => {
  const controller = new DirectoryOperationsController();

  it('guards every route with the operate permission', () => {
    for (const name of ['metrics', 'prometheus', 'controls', 'setControl']) {
      const handler = (
        DirectoryOperationsController.prototype as unknown as Record<
          string,
          () => void
        >
      )[name];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toHaveLength(3);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual({
        permissions: [DIRECTORY_PERMISSIONS.operate],
      });
    }
  });

  it('relays metrics with the bearer secret', async () => {
    const spy = reply(200, { generatedAt: 'now', errors: [] });
    await expect(controller.metrics(req)).resolves.toMatchObject({
      generatedAt: 'now',
    });
    const { url, init } = call(spy);
    expect(url).toBe('http://directory:3120/internal/ops/metrics');
    expect(init.headers['authorization']).toBe(`Bearer ${secret}`);
    expect(init.redirect).toBe('error');
  });

  it('passes the prometheus text through', async () => {
    const spy = reply(200, 'directory_up 1\n');
    await expect(controller.prometheus(req)).resolves.toBe('directory_up 1\n');
    expect(call(spy).url).toContain('?format=prometheus');
  });

  it('lists controls and rejects a malformed reply', async () => {
    reply(200, { controls: [control] });
    await expect(controller.controls(req)).resolves.toEqual({
      controls: [control],
    });
    reply(200, { nope: true });
    await expect(controller.controls(req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('requires a verified operator', async () => {
    const spy = reply(200, {});
    await expect(controller.metrics({ user: {} })).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('sets a control using the session actor, ignoring any body actorId', async () => {
    const spy = reply(200, control);
    await controller.setControl(
      'export_worker',
      { paused: true, reason: ' maintenance ', expectedVersion: 1 },
      req
    );
    const { url, init } = call(spy);
    expect(url).toBe(
      'http://directory:3120/internal/ops/controls/export_worker'
    );
    expect(JSON.parse(init.body as string)).toEqual({
      paused: true,
      reason: 'maintenance',
      actorId: actor,
      expectedVersion: 1,
    });
    await expect(
      controller.setControl(
        'export_worker',
        { paused: false, actorId: 'x', expectedVersion: 1 },
        req
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends a null reason when resuming without one', async () => {
    const spy = reply(200, { ...control, paused: false, reason: null });
    await controller.setControl(
      'export_worker',
      { paused: false, expectedVersion: 2 },
      req
    );
    expect(JSON.parse(call(spy).init.body as string).reason).toBeNull();
  });

  it.each([
    [
      'unknown key',
      'withdrawal_worker',
      { paused: false, expectedVersion: 0 },
      NotFoundException,
    ],
    [
      'pause without reason',
      'export_worker',
      { paused: true, expectedVersion: 0 },
      BadRequestException,
    ],
    [
      'blank reason',
      'export_worker',
      { paused: true, reason: '  ', expectedVersion: 0 },
      BadRequestException,
    ],
    [
      'long reason',
      'export_worker',
      { paused: true, reason: 'a'.repeat(501), expectedVersion: 0 },
      BadRequestException,
    ],
    [
      'string paused',
      'export_worker',
      { paused: 'yes', expectedVersion: 0 },
      BadRequestException,
    ],
    [
      'negative version',
      'export_worker',
      { paused: false, expectedVersion: -1 },
      BadRequestException,
    ],
    [
      'fractional version',
      'export_worker',
      { paused: false, expectedVersion: 1.5 },
      BadRequestException,
    ],
    [
      'missing version',
      'export_worker',
      { paused: false },
      BadRequestException,
    ],
    ['array body', 'export_worker', [], BadRequestException],
  ])('rejects %s without calling Directory', async (_n, key, body, error) => {
    const spy = reply(200, control);
    await expect(controller.setControl(key, body, req)).rejects.toBeInstanceOf(
      error
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('passes a stale version conflict through with its code', async () => {
    reply(409, { code: 'stale_version' });
    await expect(
      controller.setControl(
        'export_worker',
        { paused: false, expectedVersion: 0 },
        req
      )
    ).rejects.toMatchObject({
      response: { code: 'stale_version' },
    });
    reply(409, { code: 'something_else' });
    await expect(
      controller.setControl(
        'export_worker',
        { paused: false, expectedVersion: 0 },
        req
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps upstream failures and timeouts to 503', async () => {
    reply(500);
    await expect(controller.metrics(req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    await expect(controller.controls(req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    reply(200, 'not json');
    await expect(controller.metrics(req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('is unavailable when local evaluation is not configured', async () => {
    delete process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'];
    await expect(controller.metrics(req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
