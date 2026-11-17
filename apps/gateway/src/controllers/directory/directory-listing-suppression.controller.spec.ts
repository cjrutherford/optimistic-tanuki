import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DirectoryListingSuppressionController } from './directory-listing-suppression.controller';

const town = '615482e8-d72b-4500-989f-5b79ceb32781';
const listing = 'b52cfef1-9180-46ba-96d8-cca7149f9bdf';
const suppressionId = 'd52cfef1-9180-46ba-96d8-cca7149f9bdf';
const reviewerId = '11111111-1111-4111-8111-111111111111';
const secret = 'x'.repeat(32);
const req = { user: { profileId: reviewerId } };

interface FetchInit {
  method?: string;
  headers: Record<string, string>;
  body?: string;
  redirect?: string;
}

describe('DirectoryListingSuppressionController', () => {
  const original = {
    mode: process.env.DIRECTORY_LOCAL_EVALUATION,
    base: process.env.DIRECTORY_INTERNAL_URL,
    secret: process.env.DIRECTORY_LOCAL_EVALUATION_SECRET,
  };
  const controller = new DirectoryListingSuppressionController();

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
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      })
    );

  const row = () => ({
    suppressionId,
    listingId: listing,
    listingName: 'Corner Cafe',
    reasonCode: 'safety',
    note: 'n',
    actorId: reviewerId,
    createdAt: '2026-01-01T00:00:00.000Z',
    liftedAt: null,
    liftReasonCode: null,
    liftedById: null,
    internalSecret: 'leak',
  });
  const create = {
    attested: true,
    suppressionId,
    listingId: listing,
    reasonCode: 'incorrect-details',
    note: 'wrong hours',
  };

  it('lists with a strict projection and bearer auth', async () => {
    const spy = reply(200, { suppressions: [row()], extra: 1 });
    const out = await controller.list(town, req);
    expect(out.suppressions[0]).not.toHaveProperty('internalSecret');
    expect(out.suppressions[0]).toMatchObject({ listingName: 'Corner Cafe' });
    const [url, init] = spy.mock.calls[0] as unknown as [string, FetchInit];
    expect(url).toBe(
      `http://directory:3120/internal/local-evaluation/towns/${town}/listing-suppressions`
    );
    expect(init.headers['authorization']).toBe(`Bearer ${secret}`);
    expect(init.redirect).toBe('error');
  });

  it('refuses malformed upstream lists and bad upstream status', async () => {
    reply(200, { suppressions: [{ ...row(), reasonCode: 'nope' }] });
    await expect(controller.list(town, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    reply(500);
    await expect(controller.list(town, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('is unavailable without configuration or a long secret', async () => {
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET = 'short';
    await expect(controller.list(town, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET = secret;
    process.env.DIRECTORY_LOCAL_EVALUATION = 'false';
    await expect(controller.list(town, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('requires a valid town and a verified reviewer', async () => {
    await expect(controller.list('x', req)).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(controller.list(town, {})).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('suppresses with the reviewer id taken from the session', async () => {
    const spy = reply(200, {
      replayed: false,
      suppressionId,
      reasonCode: 'incorrect-details',
      sentToReview: true,
      extra: 1,
    });
    const ok = await controller.suppress(
      town,
      { ...create, actorId: 'attacker' },
      req
    );
    expect(ok).toEqual({
      recorded: true,
      replayed: false,
      suppressionId,
      reasonCode: 'incorrect-details',
      sentToReview: true,
    });
    const [, init] = spy.mock.calls[0] as unknown as [string, FetchInit];
    expect(JSON.parse(init.body as string)).toEqual({
      suppressionId,
      listingId: listing,
      reasonCode: 'incorrect-details',
      note: 'wrong hours',
      actorId: reviewerId,
    });
  });

  it('rejects unattested or malformed suppression bodies', async () => {
    const spy = reply(200, {});
    for (const bad of [
      null,
      [],
      { ...create, attested: false },
      { ...create, attested: undefined },
      { ...create, suppressionId: 'x' },
      { ...create, listingId: 'x' },
      { ...create, reasonCode: 'spite' },
      { ...create, note: '  ' },
      { ...create, note: 'n'.repeat(1025) },
    ]) {
      await expect(controller.suppress(town, bad, req)).rejects.toBeInstanceOf(
        BadRequestException
      );
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('maps upstream 409 and 404 and rejects bad success shapes', async () => {
    reply(409);
    await expect(controller.suppress(town, create, req)).rejects.toBeInstanceOf(
      ConflictException
    );
    reply(404);
    await expect(controller.suppress(town, create, req)).rejects.toBeInstanceOf(
      NotFoundException
    );
    reply(200, { replayed: 'yes' });
    await expect(controller.suppress(town, create, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    await expect(controller.suppress(town, create, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('lifts with an attested, enumerated reason', async () => {
    const spy = reply(200, {
      replayed: false,
      suppressionId,
      liftReasonCode: 'resolved',
    });
    const out = await controller.lift(
      town,
      suppressionId,
      { attested: true, reasonCode: 'resolved' },
      req
    );
    expect(out).toEqual({
      recorded: true,
      replayed: false,
      suppressionId,
      liftReasonCode: 'resolved',
    });
    const [url, init] = spy.mock.calls[0] as unknown as [string, FetchInit];
    expect(url).toContain(`/listing-suppressions/${suppressionId}/lift`);
    expect(JSON.parse(init.body as string)).toEqual({
      reasonCode: 'resolved',
      actorId: reviewerId,
    });
    for (const bad of [
      { reasonCode: 'resolved' },
      { attested: true, reasonCode: 'safety' },
      null,
    ]) {
      await expect(
        controller.lift(town, suppressionId, bad, req)
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(
      controller.lift(
        town,
        'nope',
        { attested: true, reasonCode: 'resolved' },
        req
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    reply(409);
    await expect(
      controller.lift(
        town,
        suppressionId,
        { attested: true, reasonCode: 'other' },
        req
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
