import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { DirectoryExportsController } from './directory-exports.controller';

const actor = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
const community = '33333333-3333-4333-8333-333333333333';
const secret = 'x'.repeat(32);
const sha = 'b'.repeat(64);
const req = { user: { profileId: actor } };

interface FetchInit {
  method?: string;
  headers: Record<string, string>;
  body?: string;
  redirect?: string;
}
interface HeaderSink {
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => void;
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

const reply = (status: number, body?: unknown, headers?: HeadersInit) =>
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        body === undefined
          ? null
          : typeof body === 'string'
          ? body
          : JSON.stringify(body),
        { status, headers }
      )
    );
const call = (spy: jest.SpyInstance) => ({
  url: spy.mock.calls[0][0] as string,
  init: spy.mock.calls[0][1] as FetchInit,
});
const sink = (): HeaderSink => {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (name, value) => {
      headers[name.toLowerCase()] = value;
    },
  };
};
const job = (over: Record<string, unknown> = {}) => ({
  id: jobId,
  status: 'queued',
  ...over,
});

describe('DirectoryExportsController', () => {
  const controller = new DirectoryExportsController();

  it('guards every route with directory.export', () => {
    for (const name of [
      'create',
      'list',
      'detail',
      'retry',
      'artifact',
    ] as const) {
      const handler = controller[name];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toHaveLength(3);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler).permissions).toEqual(
        [DIRECTORY_PERMISSIONS.export]
      );
    }
  });

  it('creates a job with the actor from the session, never the body', async () => {
    const spy = reply(200, job());
    const result = await controller.create(
      {
        id: jobId,
        releaseId: '2026-10-21.0',
        communityId: community,
        actorId: 'ignored',
      },
      req
    );
    expect(result).toEqual(job());
    const { url, init } = call(spy);
    expect(url).toBe('http://directory:3120/internal/exports');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(init.headers['authorization']).toBe(`Bearer ${secret}`);
    expect(JSON.parse(init.body as string)).toEqual({
      id: jobId,
      actorId: actor,
      releaseId: '2026-10-21.0',
      communityId: community,
    });
  });

  it.each([
    [undefined],
    [{}],
    [{ id: 'nope', releaseId: 'r1' }],
    [{ id: jobId }],
    [{ id: jobId, releaseId: '../x' }],
    [{ id: jobId, releaseId: 'a'.repeat(101) }],
    [{ id: jobId, releaseId: 'r1', communityId: 'town' }],
    [[]],
  ])('rejects the invalid create body %j', async (body) => {
    const spy = jest.spyOn(globalThis, 'fetch');
    await expect(controller.create(body, req)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('requires a verified operator and a configured Directory', async () => {
    await expect(
      controller.create({ id: jobId, releaseId: 'r1' }, { user: {} })
    ).rejects.toBeInstanceOf(ForbiddenException);
    delete process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'];
    await expect(controller.list({}, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('lists with validated paging and status', async () => {
    const spy = reply(200, { items: [job()], total: 1 });
    const result = await controller.list(
      { status: 'failed', limit: '20', offset: '0' },
      req
    );
    expect(result).toEqual({ items: [job()], total: 1 });
    expect(call(spy).url).toBe(
      'http://directory:3120/internal/exports?status=failed&limit=20&offset=0'
    );
    for (const query of [
      { status: 'bogus' },
      { limit: '0' },
      { limit: '101' },
      { offset: '-1' },
      { other: '1' },
    ])
      await expect(controller.list(query, req)).rejects.toBeInstanceOf(
        BadRequestException
      );
  });

  it('refuses a malformed job from Directory', async () => {
    reply(200, { id: 'x', status: 'queued' });
    await expect(controller.detail(jobId, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('detail validates the id and returns the job', async () => {
    await expect(controller.detail('nope', req)).rejects.toBeInstanceOf(
      BadRequestException
    );
    const spy = reply(200, job({ status: 'complete' }));
    expect(await controller.detail(jobId, req)).toEqual(
      job({ status: 'complete' })
    );
    expect(call(spy).url).toBe(
      `http://directory:3120/internal/exports/${jobId}`
    );
  });

  it('retry sends the actor', async () => {
    const spy = reply(200, job());
    await controller.retry(jobId, req);
    const { url, init } = call(spy);
    expect(url).toBe(`http://directory:3120/internal/exports/${jobId}/retry`);
    expect(JSON.parse(init.body as string)).toEqual({ actorId: actor });
    await expect(controller.retry('nope', req)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('maps a 409 to a coded conflict and unknown codes to invalid_state', async () => {
    reply(409, { code: 'idempotency_mismatch' });
    await expect(
      controller.create({ id: jobId, releaseId: 'r1' }, req)
    ).rejects.toMatchObject({
      response: { code: 'idempotency_mismatch' },
    });
    reply(409, { code: 'sql: secret detail' });
    const error = await controller.retry(jobId, req).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse().code).toBe('invalid_state');
  });

  it('maps 404, 410 and other failures', async () => {
    reply(404);
    await expect(controller.detail(jobId, req)).rejects.toBeInstanceOf(
      NotFoundException
    );
    reply(410);
    await expect(
      controller.artifact(jobId, req, sink())
    ).rejects.toBeInstanceOf(GoneException);
    reply(503);
    await expect(
      controller.artifact(jobId, req, sink())
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    await expect(controller.detail(jobId, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  describe('artifact', () => {
    const lines = '{"type":"header"}\n{"type":"trailer"}\n';
    const drain = async (file: StreamableFile): Promise<string> => {
      const chunks: Buffer[] = [];
      for await (const chunk of file.getStream())
        chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks).toString();
    };

    it('streams the body through with the integrity and download headers', async () => {
      const spy = reply(200, lines, {
        'content-type': 'application/x-ndjson',
        'x-content-sha256': sha,
        'content-disposition': 'attachment; filename="export.jsonl"',
      });
      const res = sink();
      const file = await controller.artifact(jobId, req, res);
      expect(file).toBeInstanceOf(StreamableFile);
      expect(await drain(file)).toBe(lines);
      expect(res.headers).toEqual({
        'content-type': 'application/x-ndjson',
        'x-content-sha256': sha,
        'content-disposition': 'attachment; filename="export.jsonl"',
        'cache-control': 'no-store',
      });
      expect(call(spy).url).toBe(
        `http://directory:3120/internal/exports/${jobId}/artifact?actorId=${actor}`
      );
      expect(call(spy).init.headers['authorization']).toBe(`Bearer ${secret}`);
    });

    it('does not send a body whose integrity header is missing', async () => {
      reply(200, lines, { 'content-type': 'application/x-ndjson' });
      await expect(
        controller.artifact(jobId, req, sink())
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('validates the id before calling Directory', async () => {
      const spy = jest.spyOn(globalThis, 'fetch');
      await expect(
        controller.artifact('nope', req, sink())
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
