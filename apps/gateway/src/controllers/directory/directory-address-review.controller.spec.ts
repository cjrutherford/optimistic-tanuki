import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DirectoryAddressReviewController } from './directory-address-review.controller';

const town = '615482e8-d72b-4500-989f-5b79ceb32781';
const candidateId = 'b52cfef1-9180-46ba-96d8-cca7149f9bdf';
const reviewerId = '11111111-1111-4111-8111-111111111111';
const secret = 'x'.repeat(32);
const vt = 'a'.repeat(64);
const decisionId = 'd52cfef1-9180-46ba-96d8-cca7149f9bdf';

describe('DirectoryAddressReviewController', () => {
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
    if (original.mode === undefined)
      delete process.env.DIRECTORY_LOCAL_EVALUATION;
    else process.env.DIRECTORY_LOCAL_EVALUATION = original.mode;
    if (original.base === undefined) delete process.env.DIRECTORY_INTERNAL_URL;
    else process.env.DIRECTORY_INTERNAL_URL = original.base;
    if (original.secret === undefined)
      delete process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    else process.env.DIRECTORY_LOCAL_EVALUATION_SECRET = original.secret;
  });

  it('lists candidates for a verified owner-console reviewer', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              id: candidateId,
              communityId: town,
              scanId: 'a'.repeat(64),
              sourceFileRowNumber: '42',
              name: 'Fixture Bakery',
              category: 'bakery',
              rights: 'review',
              verdict: 'needs_human',
              status: 'needs_human',
              policyVersion: 'address-review-v1',
              versionToken: vt,
            },
          ],
        }),
        { status: 200 }
      )
    );

    const controller = new DirectoryAddressReviewController();
    const result = await controller.list(town, 'needs_human', '25', '0', {
      user: { profileId: reviewerId },
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].name).toBe('Fixture Bakery');
    expect(fetch).toHaveBeenCalledWith(
      `http://directory:3120/internal/local-evaluation/towns/${town}/address-review-candidates?status=needs_human&limit=25&offset=0`,
      expect.objectContaining({
        headers: { authorization: `Bearer ${secret}` },
        redirect: 'error',
      })
    );
  });

  it('allows a reviewer to list archived candidates', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ candidates: [] }), { status: 200 })
      );
    const controller = new DirectoryAddressReviewController();
    await controller.list(town, 'archived', '25', '0', {
      user: { profileId: reviewerId },
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('status=archived'),
      expect.anything()
    );
  });

  it('forwards a human decision with the authenticated reviewer', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'approved' }), { status: 200 })
      );

    const controller = new DirectoryAddressReviewController();
    const result = await controller.decide(
      town,
      candidateId,
      {
        decisionId,
        expectedVersionToken: vt,
        decision: 'approve',
        evidenceUrl: 'https://example.test/location',
        attested: true,
        reason: 'Compared the official page',
        checks: { address: 'pass' },
      },
      { user: { profileId: reviewerId } }
    );

    expect(result).toEqual({
      recorded: true,
      status: 'approved',
      replayed: false,
    });
    const body = JSON.parse(
      (fetch.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.actorId).toBe(reviewerId);
    expect(body.decision).toBe('approve');
    expect(body.decisionId).toBe(decisionId);
    expect(body.expectedVersionToken).toBe(vt);
    expect(body.evidenceUrl).toBe('https://example.test/location');
  });

  it('rejects a request without a verified reviewer', async () => {
    const controller = new DirectoryAddressReviewController();
    await expect(
      controller.list(town, undefined, undefined, undefined, { user: {} })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an approval without evidence', async () => {
    const controller = new DirectoryAddressReviewController();
    await expect(
      controller.decide(
        town,
        candidateId,
        { decision: 'approve', attested: true },
        { user: { profileId: reviewerId } }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails closed when the Directory endpoint is unavailable', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const controller = new DirectoryAddressReviewController();
    await expect(
      controller.list(town, undefined, undefined, undefined, {
        user: { profileId: reviewerId },
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses a decision that lacks a decision id or version token', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    const controller = new DirectoryAddressReviewController();
    const ok = {
      decisionId,
      expectedVersionToken: vt,
      decision: 'reject',
      attested: true,
    };
    for (const bad of [
      { ...ok, decisionId: undefined },
      { ...ok, expectedVersionToken: undefined },
      { ...ok, expectedVersionToken: 'short' },
    ]) {
      await expect(
        controller.decide(town, candidateId, bad, {
          user: { profileId: reviewerId },
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('passes a Directory 409 code through on a decision', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'stale_decision' }), {
        status: 409,
      })
    );
    await expect(
      new DirectoryAddressReviewController().decide(
        town,
        candidateId,
        {
          decisionId,
          expectedVersionToken: vt,
          decision: 'reject',
          attested: true,
        },
        { user: { profileId: reviewerId } }
      )
    ).rejects.toMatchObject({ response: { code: 'stale_decision' } });
  });

  describe('detail and undo', () => {
    const row = () => ({
      id: candidateId,
      communityId: town,
      scanId: 'a'.repeat(64),
      sourceFileRowNumber: '1',
      name: 'Fixture Bakery',
      category: 'bakery',
      verdict: 'needs_human',
      status: 'published',
      versionToken: vt,
      secret: 'no',
      history: [
        {
          decisionId,
          actorKind: 'human',
          actorId: reviewerId,
          decision: 'approve',
          reason: 'ok',
          createdAt: '2026-11-17T00:00:00Z',
          undoOf: null,
          undoneBy: null,
          reversible: true,
          internal: 'no',
        },
      ],
    });
    const undoBody = {
      decisionId: candidateId,
      undoOf: decisionId,
      expectedVersionToken: vt,
      reason: 'wrong shop',
    };
    const reviewer = { user: { profileId: reviewerId } };

    it('returns the candidate with its history and no undocumented fields', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify(row()), { status: 200 })
        );
      const result: any = await new DirectoryAddressReviewController().detail(
        town,
        candidateId,
        reviewer
      );
      expect(result.versionToken).toBe(vt);
      expect(result.history[0].reversible).toBe(true);
      expect(result.history[0]).not.toHaveProperty('internal');
      expect(result).not.toHaveProperty('secret');
    });

    it('maps a missing candidate to 404', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('', { status: 404 }));
      await expect(
        new DirectoryAddressReviewController().detail(
          town,
          candidateId,
          reviewer
        )
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forwards an undo and passes 409 codes through', async () => {
      const controller = new DirectoryAddressReviewController();
      const fetcher = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(
            JSON.stringify({ candidateId, status: 'revoked', replayed: false }),
            { status: 200 }
          )
        );
      expect(
        await controller.undo(town, candidateId, undoBody, reviewer)
      ).toEqual({ recorded: true, status: 'revoked', replayed: false });
      const sent = JSON.parse(
        (fetcher.mock.calls[0][1] as RequestInit).body as string
      );
      expect(sent).toEqual({ actorId: reviewerId, ...undoBody });
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'not_latest' }), { status: 409 })
        );
      const refused = controller.undo(town, candidateId, undoBody, reviewer);
      await expect(refused).rejects.toBeInstanceOf(ConflictException);
      await expect(refused).rejects.toMatchObject({
        response: { code: 'not_latest' },
      });
    });

    it('rejects a malformed undo without calling the directory', async () => {
      const fetcher = jest.spyOn(globalThis, 'fetch');
      const controller = new DirectoryAddressReviewController();
      for (const bad of [
        { ...undoBody, reason: '' },
        { ...undoBody, undoOf: 'x' },
        { ...undoBody, expectedVersionToken: 'x' },
        null,
      ]) {
        await expect(
          controller.undo(town, candidateId, bad, reviewer)
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(fetcher).not.toHaveBeenCalled();
    });
  });
});
