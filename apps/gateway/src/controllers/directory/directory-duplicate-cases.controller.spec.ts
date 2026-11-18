import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DirectoryDuplicateCasesController } from './directory-duplicate-cases.controller';

const town = '615482e8-d72b-4500-989f-5b79ceb32781';
const caseId = 'd52cfef1-9180-46ba-96d8-cca7149f9bdf';
const reviewerId = '11111111-1111-4111-8111-111111111111';
const secret = 'x'.repeat(32);
const req = { user: { profileId: reviewerId } };

describe('DirectoryDuplicateCasesController', () => {
  const controller = new DirectoryDuplicateCasesController();
  const saved = {
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
    restore('DIRECTORY_LOCAL_EVALUATION', saved.mode);
    restore('DIRECTORY_INTERNAL_URL', saved.base);
    restore('DIRECTORY_LOCAL_EVALUATION_SECRET', saved.secret);
  });

  const reply = (status: number, body?: unknown) =>
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      })
    );
  const row = () => ({
    caseId,
    state: 'queued',
    rule: 'same_name_near',
    weakerBasis: 'sources',
    distanceMeters: 300,
    kept: { scanId: 'scan-a', sourceFileRowNumber: '1' },
    hidden: { scanId: 'scan-b', sourceFileRowNumber: '2' },
    keptName: 'Corner Cafe',
    hiddenName: 'Corner Cafe',
    createdAt: '2026-11-18T00:00:00.000Z',
  });

  it('lists cases with the bearer secret and projects the fields', async () => {
    const fetchMock = reply(200, {
      cases: [{ ...row(), extra: 'x' }],
      total: 6500,
      limit: 25,
      offset: 50,
    });
    const result = await controller.list(town, {}, req);
    expect(result.cases).toEqual([row()]);
    expect(result.total).toBe(6500);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `http://directory:3120/internal/local-evaluation/towns/${town}/duplicate-cases`
    );
    expect((init as RequestInit).headers).toEqual({
      authorization: `Bearer ${secret}`,
    });
  });

  it('refuses a malformed directory reply and an unconfigured gateway', async () => {
    reply(200, {
      cases: [{ ...row(), state: 'bogus' }],
      total: 1,
      limit: 25,
      offset: 0,
    });
    await expect(controller.list(town, {}, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    delete process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    await expect(controller.list(town, {}, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('requires a verified reviewer and a valid town', async () => {
    await expect(
      controller.list(town, {}, undefined as never)
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.list('x', {}, req)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('decides a case as the reviewer and never forwards a body actor', async () => {
    const fetchMock = reply(200, { replayed: false, state: 'kept_separate' });
    const result = await controller.decide(
      town,
      caseId,
      { action: 'keep_separate', reason: 'different shops', actorId: 'evil' },
      req
    );
    expect(result).toEqual({
      recorded: true,
      replayed: false,
      state: 'kept_separate',
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      action: 'keep_separate',
      reason: 'different shops',
      actorId: reviewerId,
    });
  });

  it('rejects an unknown action or a missing reason', async () => {
    for (const body of [
      { action: 'delete', reason: 'x' },
      { action: 'merge', reason: ' ' },
      { action: 'merge' },
      null,
    ])
      await expect(
        controller.decide(town, caseId, body, req)
      ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps directory refusals', async () => {
    const body = { action: 'undo', reason: 'oops' };
    reply(409);
    await expect(
      controller.decide(town, caseId, body, req)
    ).rejects.toBeInstanceOf(ConflictException);
    reply(404);
    await expect(
      controller.decide(town, caseId, body, req)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forwards only validated paging and filter parameters', async () => {
    const fetchMock = reply(200, {
      cases: [],
      total: 0,
      limit: 10,
      offset: 20,
    });
    await controller.list(
      town,
      { state: 'queued', rule: 'similar_name', limit: '10', offset: '20' },
      req
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://directory:3120/internal/local-evaluation/towns/${town}/duplicate-cases?state=queued&rule=similar_name&limit=10&offset=20`
    );
    for (const bad of [
      { state: 'x' },
      { rule: 'x' },
      { limit: '101' },
      { limit: '0' },
      { offset: '-1' },
      { other: '1' },
      { limit: ['1', '2'] },
    ])
      await expect(
        controller.list(town, bad as Record<string, unknown>, req)
      ).rejects.toBeInstanceOf(BadRequestException);
  });

  const listing = (n: string, hidden: boolean) => ({
    scanId: `scan-${n}`,
    sourceFileRowNumber: n,
    name: 'Corner Cafe',
    category: 'restaurant',
    addresses: ['1 Main St'],
    phones: [],
    websites: [],
    sources: ['meta'],
    coordinates: [-83.5, 31.25],
    hidden,
  });

  it('shows a pair side by side with its history', async () => {
    const fetchMock = reply(200, {
      ...row(),
      decidedAt: null,
      keptListing: listing('1', false),
      hiddenListing: listing('2', true),
      history: [
        {
          eventId: 'e1',
          kind: 'queued',
          actorId: null,
          note: 'D13',
          createdAt: '2026-11-18T00:00:00.000Z',
        },
      ],
    });
    const result = (await controller.detailCase(town, caseId, req)) as any;
    expect(result.keptListing.hidden).toBe(false);
    expect(result.hiddenListing.hidden).toBe(true);
    expect(result.history).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://directory:3120/internal/local-evaluation/towns/${town}/duplicate-cases/${caseId}`
    );
    await expect(
      controller.detailCase(town, 'nope', req)
    ).rejects.toBeInstanceOf(BadRequestException);
    reply(200, { ...row(), history: 'x' });
    await expect(
      controller.detailCase(town, caseId, req)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('forwards expectedState on a decision and maps a stale refusal to 409', async () => {
    const fetchMock = reply(200, { replayed: false, state: 'merged' });
    await controller.decide(
      town,
      caseId,
      { action: 'merge', reason: 'same', expectedState: 'queued' },
      req
    );
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    ).toEqual({
      action: 'merge',
      reason: 'same',
      expectedState: 'queued',
      actorId: reviewerId,
    });
    await expect(
      controller.decide(
        town,
        caseId,
        { action: 'merge', reason: 'x', expectedState: 'bogus' },
        req
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    reply(409);
    await expect(
      controller.decide(
        town,
        caseId,
        { action: 'merge', reason: 'x', expectedState: 'merged' },
        req
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  const report = {
    sampleSize: 200,
    judged: 10,
    unjudged: 190,
    wrong: 0,
    rate: 0,
    upperBound95: 0.28,
    limit: 0.02,
    withinLimit: false,
    complete: false,
  };
  const sample = () => ({
    sampleId: '33333333-3333-4333-8333-333333333333',
    round: '2026-r1',
    seed: 'abc',
    populationSize: 6500,
    createdAt: '2026-11-18T00:00:00.000Z',
    createdById: reviewerId,
    report,
  });

  it('draws a sample as the reviewer, bounds the request and never forwards a body actor', async () => {
    const fetchMock = reply(200, { replayed: false, sample: sample() });
    const result = await controller.draw(
      town,
      { round: '2026-r1', size: 200, seed: 'abc' },
      req
    );
    expect(result.sample['report']).toEqual(report);
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    ).toEqual({
      round: '2026-r1',
      size: 200,
      seed: 'abc',
      actorId: reviewerId,
    });
    for (const bad of [
      { round: 'bad round' },
      { round: 'r', size: 5000 },
      { round: 'r', size: 1.5 },
      { round: 'r', seed: 'a b' },
      { round: 'r', actorId: 'evil' },
      null,
    ])
      await expect(controller.draw(town, bad, req)).rejects.toBeInstanceOf(
        BadRequestException
      );
  });

  it('lists samples, reads one and judges a pair', async () => {
    reply(200, { samples: [sample()] });
    expect((await controller.samples(town, req)).samples).toHaveLength(1);
    reply(200, {
      sample: sample(),
      items: [
        {
          caseId,
          state: 'queued',
          rule: 'similar_name',
          distanceMeters: 40,
          keptName: 'A',
          hiddenName: 'B',
          verdict: null,
          judgedById: reviewerId,
          judgedAt: null,
        },
      ],
    });
    const detail = await controller.sampleDetail(town, sample().sampleId, req);
    expect(detail.items[0]).not.toHaveProperty('judgedById');
    const fetchMock = reply(200, { replayed: false, report });
    const judged = await controller.judge(
      town,
      sample().sampleId,
      { caseId, verdict: 'distinct' },
      req
    );
    expect(judged.report['wrong']).toBe(0);
    expect(
      JSON.parse(
        (fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string
      )
    ).toEqual({ caseId, verdict: 'distinct', actorId: reviewerId });
    await expect(
      controller.judge(
        town,
        sample().sampleId,
        { caseId, verdict: 'maybe' },
        req
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    reply(404);
    await expect(
      controller.judge(
        town,
        sample().sampleId,
        { caseId, verdict: 'duplicate' },
        req
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
