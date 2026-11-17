import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DirectoryBusinessIdentityReviewController } from './directory-business-identity-review.controller';

const town = '615482e8-d72b-4500-989f-5b79ceb32781';
const business = 'b52cfef1-9180-46ba-96d8-cca7149f9bdf';
const other = 'c52cfef1-9180-46ba-96d8-cca7149f9bdf';
const decisionId = 'd52cfef1-9180-46ba-96d8-cca7149f9bdf';
const reviewerId = '11111111-1111-4111-8111-111111111111';
const secret = 'x'.repeat(32);
const req = { user: { profileId: reviewerId } };
const health = {
  unresolved: 1,
  absent: 0,
  awaitingOwner: 1,
  carryIncomplete: 0,
  carriedUnbound: 1,
};

describe('DirectoryBusinessIdentityReviewController', () => {
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

  const queueBody = () => ({
    health: { ...health, extra: 9 },
    queue: {
      carriedUnbound: [
        {
          businessId: business,
          scanId: 'a'.repeat(64),
          sourceFileRowNumber: '4',
          secret: 'no',
        },
      ],
      unresolved: [
        {
          businessId: business,
          scanId: 'scan-1',
          sourceFileRowNumber: '5',
          cause: 'duplicate_key',
        },
      ],
      awaitingOwner: [
        { carryId: other, requestId: decisionId, businessId: business },
      ],
    },
  });

  it('lists the queue and strips undocumented fields', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(queueBody()), { status: 200 })
      );
    const result: any =
      await new DirectoryBusinessIdentityReviewController().queue(town, req);
    expect(result.health).toEqual(health);
    expect(result.queue.carriedUnbound).toEqual([
      {
        businessId: business,
        scanId: 'a'.repeat(64),
        sourceFileRowNumber: '4',
      },
    ]);
    expect(result.queue.unresolved[0].cause).toBe('duplicate_key');
    expect(fetcher).toHaveBeenCalledWith(
      `http://directory:3120/internal/local-evaluation/towns/${town}/business-identity-review`,
      expect.objectContaining({
        headers: { authorization: `Bearer ${secret}` },
        redirect: 'error',
      })
    );
  });

  it('requires a verified reviewer and a town uuid', async () => {
    const controller = new DirectoryBusinessIdentityReviewController();
    await expect(controller.queue(town, { user: {} })).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.queue('nope', req)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('answers 503 for a malformed directory response', async () => {
    const bad = queueBody();
    bad.health.absent = -1;
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(bad), { status: 200 }));
    await expect(
      new DirectoryBusinessIdentityReviewController().queue(town, req)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    const long = queueBody();
    long.queue.carriedUnbound = Array.from(
      { length: 101 },
      () => long.queue.carriedUnbound[0]
    );
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(long), { status: 200 }));
    await expect(
      new DirectoryBusinessIdentityReviewController().queue(town, req)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('answers 503 when the directory is unreachable', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(
      new DirectoryBusinessIdentityReviewController().queue(town, req)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('forwards a decision with the reviewer as actor', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ replayed: false, businesses: 2, restoredLinks: 1 }),
          { status: 200 }
        )
      );
    const result = await new DirectoryBusinessIdentityReviewController().decide(
      town,
      {
        decisionId,
        action: 'merge',
        businessId: business,
        otherBusinessId: other,
        reason: 'same shop',
        attested: true,
      },
      req
    );
    expect(result).toEqual({
      recorded: true,
      replayed: false,
      businesses: 2,
      restoredLinks: 1,
    });
    const sent = JSON.parse(
      (fetcher.mock.calls[0][1] as RequestInit).body as string
    );
    expect(sent).toEqual({
      actorId: reviewerId,
      decisionId,
      action: 'merge',
      businessId: business,
      otherBusinessId: other,
      reason: 'same shop',
    });
  });

  it('forwards split rows', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ replayed: true, businesses: 2, restoredLinks: 0 }),
          { status: 200 }
        )
      );
    const rows = [{ scanId: 'a'.repeat(64), sourceFileRowNumber: '7' }];
    await new DirectoryBusinessIdentityReviewController().decide(
      town,
      {
        decisionId,
        action: 'split',
        businessId: business,
        rows,
        reason: 'two shops',
        attested: true,
      },
      req
    );
    expect(
      JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string).rows
    ).toEqual(rows);
  });

  it('rejects malformed or unattested decisions without calling the directory', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    const controller = new DirectoryBusinessIdentityReviewController();
    const ok = {
      decisionId,
      action: 'confirm',
      businessId: business,
      reason: 'ok',
      attested: true,
    };
    const bads = [
      { ...ok, attested: false },
      { ...ok, action: 'delete' },
      { ...ok, reason: '  ' },
      { ...ok, reason: 'a'.repeat(1025) },
      { ...ok, otherBusinessId: other },
      { ...ok, rows: [] },
      { ...ok, action: 'merge' },
      { ...ok, action: 'merge', otherBusinessId: business },
      { ...ok, action: 'split' },
      {
        ...ok,
        action: 'split',
        rows: [{ scanId: 's', sourceFileRowNumber: 'x' }],
      },
      { ...ok, decisionId: 'nope' },
    ];
    for (const bad of bads) {
      await expect(controller.decide(town, bad, req)).rejects.toBeInstanceOf(
        BadRequestException
      );
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('maps a directory refusal to 409 and other failures to 503', async () => {
    const controller = new DirectoryBusinessIdentityReviewController();
    const input = {
      decisionId,
      action: 'retire',
      businessId: business,
      reason: 'closed',
      attested: true,
    };
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 409 }));
    await expect(controller.decide(town, input, req)).rejects.toBeInstanceOf(
      ConflictException
    );
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));
    await expect(controller.decide(town, input, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(controller.decide(town, input, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
