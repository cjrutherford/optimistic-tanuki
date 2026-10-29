import { RpcException } from '@nestjs/microservices';
import { AccountExportCaptureLeaseService } from './account-export-capture-lease.service';

describe('AccountExportCaptureLeaseService', () => {
  const grant = {
    accountId: 'd816be66-4fb6-4ed6-a91d-cc058bd5c816',
    jobId: '67e12d87-82e8-442f-99e9-921c01f2d690',
    leaseOwner: 'ed0a4be2-d439-4e81-b16b-87f909eaed36',
    attempt: 7,
    appId: 'client-interface',
    token: 'transient-test-session',
  };
  const auth = { validateToken: jest.fn() };
  const db = { query: jest.fn() };
  const service = new AccountExportCaptureLeaseService(
    auth as never,
    db as never
  );
  beforeEach(() => {
    jest.resetAllMocks();
    auth.validateToken.mockResolvedValue({
      isValid: true,
      data: { userId: grant.accountId, appId: grant.appId },
    });
    db.query.mockResolvedValue([{ valid: true }]);
  });
  it('validates the fresh session then the exact DB-clock fenced job without echoing secrets', async () => {
    expect(await service.validate(grant)).toEqual({ valid: true });
    expect(auth.validateToken).toHaveBeenCalledWith(grant.token, grant.appId);
    expect(db.query.mock.calls[0][1]).toEqual([
      grant.jobId,
      grant.accountId,
      grant.appId,
      grant.attempt,
      grant.leaseOwner,
    ]);
  });
  it.each([
    { ...grant, attempt: 0 },
    { ...grant, token: '' },
    { ...grant, jobId: 'bad' },
    { ...grant, leaseOwner: 'bad' },
  ])(
    'rejects malformed capabilities before session or SQL lookup %#',
    async (request) => {
      await expect(service.validate(request)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(auth.validateToken).not.toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
    }
  );
  it.each([
    { isValid: false },
    { isValid: true, data: { userId: grant.accountId } },
    { isValid: true, data: { userId: grant.jobId, appId: grant.appId } },
    { isValid: true, data: { userId: grant.accountId, appId: 'other-app' } },
  ])(
    'denies revoked, missing, foreign subject or app principals %#',
    async (session) => {
      auth.validateToken.mockResolvedValue(session);
      await expect(service.validate(grant)).rejects.toBeInstanceOf(
        RpcException
      );
      expect(db.query).not.toHaveBeenCalled();
    }
  );
  it.each(
    [[{ valid: false }], [], [{ valid: 'true' }]].map((rows) => ({ rows }))
  )('denies stale/malformed DB results %#', async ({ rows }) => {
    db.query.mockResolvedValue(rows);
    await expect(service.validate(grant)).rejects.toBeInstanceOf(RpcException);
  });
  it('suppresses private session and SQL error details', async () => {
    db.query.mockRejectedValue(new Error('private SQL diagnostic'));
    const error = await service.validate(grant).catch((e) => e as RpcException);
    if (!(error instanceof RpcException))
      throw new Error('Expected capture rejection');
    expect(error.getError()).toEqual({
      statusCode: 403,
      code: 'EXPORT_CAPTURE_NOT_AUTHORIZED',
      message: 'Export capture is not authorized',
    });
  });
});
