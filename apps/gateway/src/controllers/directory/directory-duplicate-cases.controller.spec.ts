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
    const fetchMock = reply(200, { cases: [{ ...row(), extra: 'x' }] });
    const result = await controller.list(town, req);
    expect(result.cases).toEqual([row()]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `http://directory:3120/internal/local-evaluation/towns/${town}/duplicate-cases`
    );
    expect((init as RequestInit).headers).toEqual({
      authorization: `Bearer ${secret}`,
    });
  });

  it('refuses a malformed directory reply and an unconfigured gateway', async () => {
    reply(200, { cases: [{ ...row(), state: 'bogus' }] });
    await expect(controller.list(town, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    delete process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    await expect(controller.list(town, req)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('requires a verified reviewer and a valid town', async () => {
    await expect(controller.list(town, {})).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.list('x', req)).rejects.toBeInstanceOf(
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
});
