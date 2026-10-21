import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { of } from 'rxjs';
import { PresenceCommands } from '@optimistic-tanuki/constants';
import { UserDetails } from '../../../decorators/user.decorator';
import { PresenceController, PresenceStatus } from './presence.controller';

describe('PresenceController mutation actor binding', () => {
  const accountId = 'a1111111-1111-4111-8111-111111111111';
  const otherId = 'b2222222-2222-4222-8222-222222222222';
  let send: jest.Mock;
  let controller: PresenceController;
  let audience: { resolveConversationPresence: jest.Mock };
  const principal = (userId = accountId, profileId = otherId) =>
    ({ userId, profileId } as UserDetails);
  const invoke = (method: string, ...args: unknown[]) =>
    (
      controller as unknown as Record<string, (...values: unknown[]) => unknown>
    )[method](...args);

  beforeEach(() => {
    send = jest
      .fn()
      .mockReturnValue(of({ userId: accountId, status: 'online' }));
    audience = { resolveConversationPresence: jest.fn().mockResolvedValue([]) };
    controller = new PresenceController({ send } as never, audience as never);
  });

  it('binds POST actor to authenticated account and ignores the legacy body userId', async () => {
    const result = (await invoke(
      'setPresence',
      { userId: otherId, status: PresenceStatus.ONLINE },
      principal()
    )) as { userId: string };

    expect(result.userId).toBe(accountId);
    expect(send).toHaveBeenCalledWith(
      { cmd: PresenceCommands.SET_PRESENCE },
      { userId: accountId, status: PresenceStatus.ONLINE }
    );
  });

  it.each([undefined, principal('not-a-uuid')])(
    'rejects missing or malformed authenticated account identity before POST RPC',
    async (actor) => {
      await expect(
        invoke(
          'setPresence',
          { userId: accountId, status: PresenceStatus.ONLINE },
          actor
        )
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(send).not.toHaveBeenCalled();
    }
  );

  it('allows self last-seen path UUIDs case-insensitively', async () => {
    await invoke('updateLastSeen', accountId.toUpperCase(), principal());

    expect(send).toHaveBeenCalledWith(
      { cmd: PresenceCommands.UPDATE_LAST_SEEN },
      { userId: accountId }
    );
  });

  it('allows self offline path IDs and sends the canonical account UUID', async () => {
    await invoke('setOffline', accountId.toUpperCase(), principal());

    expect(send).toHaveBeenCalledWith(
      { cmd: PresenceCommands.SET_OFFLINE },
      { userId: accountId }
    );
  });

  it('denies conflicting offline path IDs without calling Social RPC', async () => {
    await expect(
      invoke('setOffline', otherId, principal())
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects malformed principal IDs for PUT mutations before RPC', async () => {
    await expect(
      invoke('setOffline', accountId, principal('not-a-uuid'))
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(send).not.toHaveBeenCalled();
  });

  it('allows only canonical self reads, including legacy uppercase UUIDs', async () => {
    await controller.getPresence(accountId.toUpperCase(), principal());
    await controller.getPresenceBatch(
      { userIds: [accountId.toUpperCase()] },
      principal()
    );
    await controller.getOnlineUsers(principal());

    expect(send.mock.calls).toEqual([
      [{ cmd: PresenceCommands.GET_PRESENCE }, { userId: accountId }],
      [{ cmd: PresenceCommands.GET_PRESENCE_BATCH }, { userIds: [accountId] }],
      [{ cmd: PresenceCommands.GET_ONLINE_USERS }, { userIds: [accountId] }],
    ]);
  });

  it('denies foreign reads before Social RPC', async () => {
    await expect(
      controller.getPresence(otherId, principal())
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.getPresenceBatch({ userIds: [otherId] }, principal())
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
  });

  it('validates self read principal and batch bounds before Social RPC', async () => {
    await expect(
      controller.getPresence(accountId, null)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.getPresenceBatch(
        { userIds: Array(101).fill(accountId) },
        principal()
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await controller.getPresenceBatch({ userIds: [] }, principal())
    ).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it('verifies and canonicalizes conversation presence inputs', async () => {
    const conversationId = 'c3333333-3333-4333-8333-333333333333';
    const result = await controller.getConversationPresence(
      {
        conversationId: conversationId.toUpperCase(),
        profileIds: [otherId.toUpperCase(), otherId],
      },
      principal()
    );

    expect(result).toEqual([]);
    expect(audience.resolveConversationPresence).toHaveBeenCalledWith(
      accountId,
      otherId,
      conversationId,
      [otherId]
    );
    await expect(
      controller.getConversationPresence(
        { conversationId, profileIds: ['bad'] },
        principal()
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
