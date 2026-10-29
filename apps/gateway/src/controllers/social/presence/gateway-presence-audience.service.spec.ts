import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ChatCommands,
  PresenceCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { GatewayPresenceAudienceService } from './gateway-presence-audience.service';

describe('GatewayPresenceAudienceService', () => {
  const accountId = '11111111-1111-4111-8111-111111111111';
  const actorProfileId = '22222222-2222-4222-8222-222222222222';
  const peerProfileId = '33333333-3333-4333-8333-333333333333';
  const conversationId = '44444444-4444-4444-8444-444444444444';
  let chatSend: jest.Mock;
  let profileSend: jest.Mock;
  let socialSend: jest.Mock;
  let service: GatewayPresenceAudienceService;

  beforeEach(() => {
    chatSend = jest.fn().mockReturnValue(
      of({
        conversationId,
        requestingProfileId: actorProfileId,
        allowedProfileIds: [peerProfileId],
      })
    );
    profileSend = jest.fn((pattern: { cmd: string }) => {
      if (pattern.cmd === ProfileCommands.CheckAccountProfileOwnership) {
        return of({ accountId, profileId: actorProfileId, owned: true });
      }
      return of({
        profileIds: [peerProfileId],
        bindings: [
          {
            profileId: peerProfileId,
            accountId: '55555555-5555-4555-8555-555555555555',
          },
        ],
      });
    });
    socialSend = jest
      .fn()
      .mockReturnValue(of([{ profileId: peerProfileId, status: 'online' }]));
    service = new GatewayPresenceAudienceService(
      { send: chatSend } as never,
      { send: profileSend } as never,
      { send: socialSend } as never
    );
  });

  const resolve = (targets = [peerProfileId]) =>
    service.resolveConversationPresence(
      accountId,
      actorProfileId,
      conversationId,
      targets
    );

  it('returns only the scoped profile/status projection after ownership, audience, and binding checks', async () => {
    await expect(resolve()).resolves.toEqual([
      { profileId: peerProfileId, status: 'online' },
    ]);
    expect(profileSend).toHaveBeenNthCalledWith(
      1,
      { cmd: ProfileCommands.CheckAccountProfileOwnership },
      { accountId, profileId: actorProfileId }
    );
    expect(chatSend).toHaveBeenCalledWith(
      { cmd: ChatCommands.GET_PRESENCE_AUDIENCE },
      {
        conversationId,
        requestingProfileId: actorProfileId,
        targetProfileIds: [peerProfileId],
      }
    );
    expect(profileSend).toHaveBeenNthCalledWith(
      2,
      { cmd: ProfileCommands.ResolveAccountBindings },
      { profileIds: [peerProfileId] }
    );
    expect(socialSend).toHaveBeenCalledWith(
      { cmd: PresenceCommands.GET_CONVERSATION_PRESENCE },
      {
        actorProfileId,
        bindings: [
          {
            profileId: peerProfileId,
            accountId: '55555555-5555-4555-8555-555555555555',
          },
        ],
      }
    );
  });

  it('verifies the actor then returns empty without Chat, bindings, or Social RPC', async () => {
    await expect(resolve([])).resolves.toEqual([]);
    expect(profileSend).toHaveBeenCalledTimes(1);
    expect(chatSend).not.toHaveBeenCalled();
    expect(socialSend).not.toHaveBeenCalled();
  });

  it('denies an unowned selected profile before chat or social RPC', async () => {
    profileSend.mockReturnValueOnce(
      of({ accountId, profileId: actorProfileId, owned: false })
    );
    await expect(resolve()).rejects.toBeInstanceOf(ForbiddenException);
    expect(chatSend).not.toHaveBeenCalled();
    expect(socialSend).not.toHaveBeenCalled();
  });

  it('fails closed on malformed selected ownership scope', async () => {
    profileSend.mockReturnValueOnce(
      of({ accountId, profileId: peerProfileId, owned: true })
    );
    await expect(resolve()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(chatSend).not.toHaveBeenCalled();
  });

  it('denies an incomplete Chat audience before Profile bindings or Social', async () => {
    chatSend.mockReturnValueOnce(
      of({
        conversationId,
        requestingProfileId: actorProfileId,
        allowedProfileIds: [],
      })
    );
    await expect(resolve()).rejects.toBeInstanceOf(ForbiddenException);
    expect(socialSend).not.toHaveBeenCalled();
  });

  it('fails closed on foreign or malformed Social response rows', async () => {
    socialSend.mockReturnValueOnce(
      of([
        { profileId: '66666666-6666-4666-8666-666666666666', status: 'online' },
      ])
    );
    await expect(resolve()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps RPC outages to a sanitized unavailable error', async () => {
    chatSend.mockReturnValueOnce(
      throwError(() => new Error('private transport detail'))
    );
    await expect(resolve()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(socialSend).not.toHaveBeenCalled();
  });
});
