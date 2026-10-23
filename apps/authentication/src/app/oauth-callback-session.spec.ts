import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppService } from './app.service';

describe('OAuth callback session references', () => {
  const identity = {
    userId: randomUUID(),
    profileId: randomUUID(),
    appId: 'client-interface',
  };
  const sessionId = randomUUID();
  const token = 'session-secret-never-stored-in-transient-grants';
  let repo: { findOne: jest.Mock };
  let ownership: { resolveSelection: jest.Mock };
  let service: AppService;
  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue({
        id: sessionId,
        ...identity,
        tokenData: token,
        revoked: false,
      }),
    };
    ownership = {
      resolveSelection: jest.fn().mockResolvedValue(identity.profileId),
    };
    service = new AppService(
      new Logger(),
      {} as never,
      {} as never,
      repo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      'fixture-secret',
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      ownership as never
    );
    jest.spyOn(service, 'issueToken').mockResolvedValue({
      message: 'Issued token',
      code: 0,
      data: { newToken: token },
    });
    jest.spyOn(service, 'validateToken').mockResolvedValue({
      message: 'Token is valid',
      code: 0,
      data: identity,
      isValid: true,
      emailVerified: true,
    });
  });

  it('returns only an account/profile/app-bound reference after issuing the session', async () => {
    const result = await service.createOAuthCallbackSession(identity);
    expect(result).toEqual({ sessionId, ...identity });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(service.issueToken).toHaveBeenCalledWith(
      identity.userId,
      identity.profileId,
      identity.appId
    );
  });

  it('revalidates durable token and current profile ownership before resolving', async () => {
    await expect(
      service.resolveOAuthCallbackSession({ sessionId, ...identity })
    ).resolves.toEqual({ token });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: {
        id: sessionId,
        userId: identity.userId,
        profileId: identity.profileId,
        revoked: false,
      },
    });
    expect(service.validateToken).toHaveBeenCalledWith(token, identity.appId);
    expect(ownership.resolveSelection).toHaveBeenCalledWith(
      identity.userId,
      identity.profileId
    );
  });

  it('rejects a revoked/missing session and invalid references', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.resolveOAuthCallbackSession({ sessionId, ...identity })
    ).rejects.toThrow('unavailable');
    await expect(
      service.resolveOAuthCallbackSession({ sessionId: '*', ...identity })
    ).rejects.toThrow('Invalid');
    await expect(
      service.createOAuthCallbackSession({ ...identity, userId: '*' })
    ).rejects.toThrow('Invalid');
  });

  it.each(['userId', 'profileId', 'appId'] as const)(
    'rejects a mismatched signed %s',
    async (key) => {
      jest.spyOn(service, 'validateToken').mockResolvedValue({
        message: '',
        code: 0,
        data: {
          ...identity,
          [key]: key === 'appId' ? 'local-hub' : randomUUID(),
        },
        isValid: true,
        emailVerified: true,
      });
      await expect(
        service.resolveOAuthCallbackSession({ sessionId, ...identity })
      ).rejects.toThrow('binding mismatch');
    }
  );

  it('fails closed when current ownership or token verification fails', async () => {
    ownership.resolveSelection.mockRejectedValue(new Error('foreign profile'));
    await expect(
      service.resolveOAuthCallbackSession({ sessionId, ...identity })
    ).rejects.toThrow('foreign profile');
    jest
      .spyOn(service, 'validateToken')
      .mockRejectedValue(new Error('revoked'));
    await expect(
      service.resolveOAuthCallbackSession({ sessionId, ...identity })
    ).rejects.toThrow('revoked');
  });
});
