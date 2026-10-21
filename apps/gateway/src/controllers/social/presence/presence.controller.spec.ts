import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { PresenceCommands } from '@optimistic-tanuki/constants';
import { UserDetails } from '../../../decorators/user.decorator';
import { PresenceController, PresenceStatus } from './presence.controller';

describe('PresenceController mutation actor binding', () => {
  const accountId = 'a1111111-1111-4111-8111-111111111111';
  const otherId = 'b2222222-2222-4222-8222-222222222222';
  let send: jest.Mock;
  let controller: PresenceController;
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
    controller = new PresenceController({ send } as never);
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

  it('preserves cross-account presence reads, batch reads, and online listing', async () => {
    await controller.getPresence(otherId);
    await controller.getPresenceBatch({ userIds: [otherId] });
    await controller.getOnlineUsers();

    expect(send.mock.calls).toEqual([
      [{ cmd: PresenceCommands.GET_PRESENCE }, { userId: otherId }],
      [{ cmd: PresenceCommands.GET_PRESENCE_BATCH }, { userIds: [otherId] }],
      [{ cmd: PresenceCommands.GET_ONLINE_USERS }, {}],
    ]);
  });
});
