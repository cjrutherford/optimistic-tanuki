import { RpcException } from '@nestjs/microservices';
import { AppService } from './app.service';
import { ConversationType } from './entities';
import { of, throwError } from 'rxjs';

describe('AppService.getPresenceAudience', () => {
  const conversationId = '11111111-1111-4111-8111-111111111111';
  const actor = 'a2222222-2222-4222-8222-222222222222';
  const peer = 'b3333333-3333-4333-8333-333333333333';
  const conversationRepository = { findOne: jest.fn() };
  const socialClient = { send: jest.fn() };
  const projectClient = { send: jest.fn() };
  const service = new AppService(
    {} as any,
    {} as any,
    conversationRepository as any,
    socialClient as any,
    projectClient as any
  );
  const request = {
    conversationId,
    requestingProfileId: actor,
    targetProfileIds: [peer],
  };
  const rpcError = (promise: Promise<unknown>) =>
    promise.catch((error) => error.getError());

  beforeEach(() => jest.clearAllMocks());

  it('returns only canonical requested members after checking current conversation membership', async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: conversationId,
      type: ConversationType.DIRECT,
      participants: [actor, peer],
      isDeleted: false,
    });
    await expect(
      service.getPresenceAudience({
        ...request,
        requestingProfileId: actor.toUpperCase(),
        targetProfileIds: [peer.toUpperCase()],
      })
    ).resolves.toEqual({
      conversationId,
      requestingProfileId: actor,
      allowedProfileIds: [peer],
    });
    expect(conversationRepository.findOne).toHaveBeenCalledWith({
      where: { id: conversationId, isDeleted: false },
    });
  });

  it('denies a foreign target and malformed UUIDs', async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: conversationId,
      type: ConversationType.DIRECT,
      participants: [actor, peer],
    });
    await expect(
      service.getPresenceAudience({
        ...request,
        targetProfileIds: ['44444444-4444-4444-8444-444444444444'],
      })
    ).rejects.toBeInstanceOf(RpcException);
    const calls = conversationRepository.findOne.mock.calls.length;
    await expect(
      service.getPresenceAudience({ ...request, targetProfileIds: ['bad'] })
    ).rejects.toBeInstanceOf(RpcException);
    expect(conversationRepository.findOne).toHaveBeenCalledTimes(calls);
  });

  it('uses current approved community membership rather than stale stored participants', async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: conversationId,
      type: ConversationType.COMMUNITY,
      communityId: 'community-1',
      participants: [actor, peer, 'c4444444-4444-4444-8444-444444444444'],
    });
    socialClient.send.mockReturnValue(
      of([
        { profileId: actor, status: 'approved' },
        { profileId: peer, status: 'approved' },
      ])
    );
    await expect(service.getPresenceAudience(request)).resolves.toEqual({
      conversationId,
      requestingProfileId: actor,
      allowedProfileIds: [peer],
    });
    await expect(
      rpcError(
        service.getPresenceAudience({
          ...request,
          targetProfileIds: ['c4444444-4444-4444-8444-444444444444'],
        })
      )
    ).resolves.toMatchObject({ statusCode: 403 });
  });

  it('uses current project owner and members and fails closed when membership RPC is unavailable', async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: conversationId,
      type: ConversationType.PROJECT,
      projectId: 'project-1',
      participants: [actor, peer, 'c4444444-4444-4444-8444-444444444444'],
    });
    projectClient.send.mockReturnValue(of({ owner: actor, members: [peer] }));
    await expect(service.getPresenceAudience(request)).resolves.toMatchObject({
      allowedProfileIds: [peer],
    });
    await expect(
      rpcError(
        service.getPresenceAudience({
          ...request,
          targetProfileIds: ['c4444444-4444-4444-8444-444444444444'],
        })
      )
    ).resolves.toMatchObject({ statusCode: 403 });

    projectClient.send.mockReturnValue(throwError(() => new Error('offline')));
    await expect(
      rpcError(service.getPresenceAudience(request))
    ).resolves.toMatchObject({ statusCode: 503 });
  });
});
