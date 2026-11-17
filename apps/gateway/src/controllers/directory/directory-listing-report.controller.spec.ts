import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { DirectoryOwnerScopeGuard } from './directory.controller';
import {
  CreateListingReportDto,
  DirectoryListingReportController,
  DirectoryListingReportReviewController,
  ReportRateLimiter,
  reportClientKey,
} from './directory-listing-report.controller';

const town = '615482e8-d72b-4500-989f-5b79ceb32781';
const listing = 'b52cfef1-9180-46ba-96d8-cca7149f9bdf';
const reportId = 'd52cfef1-9180-46ba-96d8-cca7149f9bdf';
const reviewerId = '11111111-1111-4111-8111-111111111111';
const secret = 'x'.repeat(32);
const receipt = 'Abcdefghijklmnopqrstuvwxyz012345';

interface FetchInit {
  method?: string;
  headers: Record<string, string>;
  body?: string;
  redirect?: string;
}
interface FakeRequest {
  headers: Record<string, string>;
  socket: { remoteAddress: string };
  user?: { profileId: string };
}

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const validate = (value: unknown): Promise<CreateListingReportDto> =>
  pipe.transform(value, {
    type: 'body',
    metatype: CreateListingReportDto,
  }) as Promise<CreateListingReportDto>;
const request = (ip = '203.0.113.9'): FakeRequest => ({
  headers: {},
  socket: { remoteAddress: ip },
});

describe('listing report gateway routes', () => {
  const original = {
    mode: process.env.DIRECTORY_LOCAL_EVALUATION,
    base: process.env.DIRECTORY_INTERNAL_URL,
    secret: process.env.DIRECTORY_LOCAL_EVALUATION_SECRET,
  };
  beforeEach(() => {
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120/';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET = secret;
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
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      Promise.resolve(
        new Response(body === undefined ? null : JSON.stringify(body), {
          status,
        })
      )
    );

  describe('input validation', () => {
    const good = { listingId: listing, reasonCode: 'incorrect-details' };
    it('accepts a minimal and a full body', async () => {
      await expect(validate(good)).resolves.toMatchObject(good);
      const full = await validate({
        ...good,
        note: '  hours are wrong ',
        email: 'Me@Example.com',
        website: '',
      });
      expect(full.note).toBe('hours are wrong');
      expect(full.website).toBeUndefined();
    });
    it.each([
      ['unknown reason', { ...good, reasonCode: 'spam' }],
      ['non-uuid listing', { ...good, listingId: '../x' }],
      ['missing listing', { reasonCode: 'other' }],
      ['long note', { ...good, note: 'x'.repeat(1001) }],
      ['bad email', { ...good, email: 'nope' }],
      ['unknown property', { ...good, townId: town }],
    ])('rejects %s', async (_name, body) => {
      await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('public create', () => {
    const controller = new DirectoryListingReportController();
    const body = (extra = {}): CreateListingReportDto =>
      ({
        listingId: listing,
        reasonCode: 'safety',
        ...extra,
      } as CreateListingReportDto);

    it('is anonymous and carries no guard', () => {
      for (const handler of [
        DirectoryListingReportController.prototype.create,
        DirectoryListingReportController.prototype.status,
      ]) {
        expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toBeUndefined();
      }
    });

    it('forwards only the validated fields with the service credential and returns the receipt', async () => {
      const fetchSpy = reply(200, { receipt, extra: 'leak' });
      const result = await controller.create(
        town,
        body({ note: 'n', email: 'a@b.co' }),
        request('198.51.100.1')
      );
      expect(result).toEqual({ receipt });
      const [url, init] = fetchSpy.mock.calls[0] as [string, FetchInit];
      expect(url).toBe(
        `http://directory:3120/internal/local-evaluation/towns/${town}/listing-reports`
      );
      expect(init.method).toBe('POST');
      expect(init.redirect).toBe('error');
      expect(init.headers.authorization).toBe(`Bearer ${secret}`);
      expect(JSON.parse(init.body as string)).toEqual({
        listingId: listing,
        reasonCode: 'safety',
        note: 'n',
        email: 'a@b.co',
      });
    });

    it('answers a filled honeypot with a plausible receipt and sends nothing', async () => {
      const fetchSpy = reply(200, { receipt });
      const result = await controller.create(
        town,
        body({ website: 'http://spam.example', email: 'a@b.co' }),
        request('198.51.100.2')
      );
      expect(result.receipt).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('refuses an invalid town and an oversized request before any work', async () => {
      const fetchSpy = reply(200, { receipt });
      await expect(
        controller.create('nope', body(), request('198.51.100.3'))
      ).rejects.toBeInstanceOf(BadRequestException);
      const big = request('198.51.100.3');
      big.headers['content-length'] = '999999';
      await expect(controller.create(town, body(), big)).rejects.toMatchObject({
        status: 413,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throttles per client and does not count another client', async () => {
      reply(200, { receipt });
      const mine = request('198.51.100.4');
      for (let i = 0; i < 5; i += 1)
        await controller.create(town, body(), mine);
      await expect(controller.create(town, body(), mine)).rejects.toMatchObject(
        { status: 429 }
      );
      await expect(
        controller.create(town, body(), request('198.51.100.5'))
      ).resolves.toEqual({ receipt });
    });

    it('maps refusals to generic errors that carry no upstream detail', async () => {
      const c = new DirectoryListingReportController();
      const run = (status: number, payload?: unknown, ip = '192.0.2.1') => {
        reply(status, payload);
        return c.create(town, body(), request(ip));
      };
      await expect(run(404)).rejects.toBeInstanceOf(NotFoundException);
      await expect(run(400, undefined, '192.0.2.2')).rejects.toBeInstanceOf(
        BadRequestException
      );
      for (const [status, payload, ip] of [
        [500, { error: 'pg: connection refused 10.0.0.4:5432' }, '192.0.2.3'],
        [200, { receipt: 'short' }, '192.0.2.4'],
        [200, {}, '192.0.2.5'],
      ] as const) {
        const error = await run(status, payload, ip).catch((e) => e);
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(JSON.stringify(error.getResponse())).not.toMatch(
          /pg:|10\.0|5432|directory:|secret/i
        );
      }
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(Error('ECONNREFUSED'));
      const error = await c
        .create(town, body(), request('192.0.2.6'))
        .catch((e) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.message).not.toMatch(/ECONNREFUSED/);
    });

    it('is unavailable when the local-evaluation service is not configured', async () => {
      delete process.env.DIRECTORY_LOCAL_EVALUATION;
      await expect(
        controller.create(town, body(), request('192.0.2.50'))
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('receipt lookup', () => {
    const controller = new DirectoryListingReportController();
    it('returns exactly status, reasonCode and createdAt', async () => {
      const fetchSpy = reply(200, {
        status: 'under_review',
        reasonCode: 'closed-business',
        createdAt: '2026-01-01T00:00:00.000Z',
        note: 'private',
        email: 'a@b.co',
        contactEmailHash: 'h',
        listingId: listing,
      });
      const result = await controller.status(receipt, request('203.0.113.20'));
      expect(result).toEqual({
        status: 'under_review',
        reasonCode: 'closed-business',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect((fetchSpy.mock.calls[0] as [string])[0]).toBe(
        `http://directory:3120/internal/local-evaluation/listing-reports/${receipt}`
      );
    });
    it('answers an unknown or malformed receipt with the same generic 404', async () => {
      const fetchSpy = reply(404);
      const unknown = await controller
        .status(receipt, request('203.0.113.21'))
        .catch((e) => e);
      const malformed = await controller
        .status('../etc/passwd', request('203.0.113.21'))
        .catch((e) => e);
      expect(unknown).toBeInstanceOf(NotFoundException);
      expect(malformed).toBeInstanceOf(NotFoundException);
      expect(unknown.message).toBe(malformed.message);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    it('rejects an unexpected upstream status value', async () => {
      reply(200, {
        status: 'hidden',
        reasonCode: 'other',
        createdAt: '2026-01-01',
      });
      await expect(
        controller.status(receipt, request('203.0.113.22'))
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('throttles lookups per client', async () => {
      reply(404);
      const mine = request('203.0.113.23');
      for (let i = 0; i < 60; i += 1)
        await controller.status(receipt, mine).catch(() => undefined);
      await expect(controller.status(receipt, mine)).rejects.toBeInstanceOf(
        HttpException
      );
      await expect(controller.status(receipt, mine)).rejects.toMatchObject({
        status: 429,
      });
    });
  });

  describe('reviewer routes', () => {
    const controller = new DirectoryListingReportReviewController();
    const req = { user: { profileId: reviewerId } };
    const row = () => ({
      reportId,
      listingId: listing,
      listingName: 'Corner Cafe',
      reasonCode: 'safety',
      note: 'n',
      status: 'received',
      priority: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      decidedById: null,
      decidedAt: null,
      decisionNote: null,
      suppressionId: null,
      contactEmailHash: 'h',
      email: 'a@b.co',
      receiptTokenHash: 'h2',
    });

    it('guards every route with the session and Owner Console scope', () => {
      for (const handler of [
        DirectoryListingReportReviewController.prototype.list,
        DirectoryListingReportReviewController.prototype.transition,
      ]) {
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
          AuthGuard,
          DirectoryOwnerScopeGuard,
          PermissionsGuard,
        ]);
        expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual({
          permissions: ['directory.review'],
        });
        expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
      }
    });

    it('lists a strict projection with no reporter contact', async () => {
      const fetchSpy = reply(200, { reports: [row()] });
      const result = await controller.list(town, 'open');
      expect(result.reports).toHaveLength(1);
      const keys = Object.keys(result.reports[0]).sort();
      expect(keys).not.toEqual(
        expect.arrayContaining(['email', 'contactEmailHash'])
      );
      expect(JSON.stringify(result)).not.toMatch(/a@b\.co|"h"|"h2"/);
      expect((fetchSpy.mock.calls[0] as [string])[0]).toBe(
        `http://directory:3120/internal/local-evaluation/towns/${town}/listing-reports?status=open`
      );
      await expect(controller.list(town, 'bogus')).rejects.toBeInstanceOf(
        BadRequestException
      );
      await expect(controller.list('x')).rejects.toBeInstanceOf(
        BadRequestException
      );
      reply(200, { reports: [{ ...row(), status: 'hidden' }] });
      await expect(controller.list(town)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it('forwards a transition with the verified reviewer as the actor', async () => {
      const fetchSpy = reply(200, {
        replayed: false,
        reportId,
        status: 'resolved',
      });
      const result = await controller.transition(
        town,
        reportId,
        'resolve',
        { note: 'done', suppressionId: listing },
        req
      );
      expect(result).toEqual({
        recorded: true,
        replayed: false,
        reportId,
        status: 'resolved',
      });
      const [url, init] = fetchSpy.mock.calls[0] as [string, FetchInit];
      expect(url).toBe(
        `http://directory:3120/internal/local-evaluation/towns/${town}/listing-reports/${reportId}/resolve`
      );
      expect(JSON.parse(init.body as string)).toEqual({
        actorId: reviewerId,
        note: 'done',
        suppressionId: listing,
      });
    });

    it.each([
      ['unknown action', 'hide', {}],
      ['decline without a note', 'decline', {}],
      ['review with a note', 'review', { note: 'n' }],
      ['blank note', 'resolve', { note: '  ' }],
      ['long note', 'resolve', { note: 'x'.repeat(1001) }],
      [
        'suppression on decline',
        'decline',
        { note: 'n', suppressionId: listing },
      ],
      ['bad suppression id', 'resolve', { suppressionId: 'x' }],
      ['extra field', 'review', { actorId: listing }],
    ])('refuses %s without calling Directory', async (_n, action, payload) => {
      const fetchSpy = reply(200, {});
      await expect(
        controller.transition(town, reportId, action, payload, req)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('needs a verified reviewer and maps refusals', async () => {
      await expect(
        controller.transition(town, reportId, 'review', {}, { user: {} })
      ).rejects.toBeInstanceOf(ForbiddenException);
      reply(409);
      await expect(
        controller.transition(town, reportId, 'review', {}, req)
      ).rejects.toBeInstanceOf(ConflictException);
      reply(404);
      await expect(
        controller.transition(town, reportId, 'review', {}, req)
      ).rejects.toBeInstanceOf(NotFoundException);
      reply(500);
      await expect(
        controller.transition(town, reportId, 'review', {}, req)
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('limiter and client key', () => {
    it('resets after the window and bounds its memory', () => {
      let now = 0;
      const limiter = new ReportRateLimiter(1, 1000, 2, () => now);
      expect(limiter.take('a')).toBe(true);
      expect(limiter.take('a')).toBe(false);
      expect(limiter.take('b')).toBe(true);
      expect(limiter.take('c')).toBe(false); // table full of live keys
      now = 2000;
      expect(limiter.take('a')).toBe(true);
      expect(limiter.take('c')).toBe(true);
    });
    it('trusts a forwarded address only from a private-network peer', () => {
      const via = (peer: string) => ({
        headers: { 'x-forwarded-for': '1.1.1.1, 9.9.9.9' },
        socket: { remoteAddress: peer },
      });
      expect(reportClientKey(via('172.18.0.5'))).toBe('ip:9.9.9.9');
      expect(reportClientKey(via('203.0.113.7'))).toBe('ip:203.0.113.7');
    });
  });
});
