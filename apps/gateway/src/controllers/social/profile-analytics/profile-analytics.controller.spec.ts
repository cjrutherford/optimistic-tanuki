import { ForbiddenException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ProfileAnalyticsCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { ProfileAnalyticsController } from './profile-analytics.controller';

describe('ProfileAnalyticsController account and counterpart boundaries', () => {
  const accountId = '11111111-1111-4111-8111-111111111111';
  const secondaryProfileId = '22222222-2222-4222-8222-222222222222';
  const targetProfileId = '33333333-3333-4333-8333-333333333333';
  const user = { userId: accountId, profileId: 'not-the-account' } as any;
  let social: { send: jest.Mock };
  let profile: { send: jest.Mock };
  let controller: ProfileAnalyticsController;

  const owned = (payload: { accountId: string; profileId: string }) =>
    of({ ...payload, owned: true });

  beforeEach(() => {
    social = { send: jest.fn().mockReturnValue(of({ success: true })) };
    profile = {
      send: jest.fn((_pattern: any, payload: any) => owned(payload)),
    };
    controller = new ProfileAnalyticsController(
      social as unknown as ClientProxy,
      profile as unknown as ClientProxy
    );
  });

  it('records against any valid target and overwrites a spoofed viewer with the authenticated account', async () => {
    await controller.recordView(
      {
        profileId: targetProfileId.toUpperCase(),
        viewerId: 'attacker',
        source: 'profile',
      },
      user
    );

    expect(profile.send).not.toHaveBeenCalled();
    expect(social.send).toHaveBeenCalledWith(
      { cmd: ProfileAnalyticsCommands.RECORD_VIEW },
      { profileId: targetProfileId, viewerId: accountId, source: 'profile' }
    );
  });

  it('allows analytics for an owned secondary profile using account identity and canonical UUIDs', async () => {
    const response = { recentViews: [{ viewedAt: new Date() }] };
    social.send.mockReturnValueOnce(of(response));

    await expect(
      controller.getViewStats(secondaryProfileId.toUpperCase(), user)
    ).resolves.toBe(response);

    expect(profile.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.CheckAccountProfileOwnership },
      { accountId, profileId: secondaryProfileId }
    );
    expect(social.send).toHaveBeenCalledWith(
      { cmd: ProfileAnalyticsCommands.GET_VIEW_STATS },
      { profileId: secondaryProfileId }
    );
  });

  it('denies a foreign profile before contacting Social', async () => {
    profile.send.mockReturnValueOnce(
      of({ accountId, profileId: targetProfileId, owned: false })
    );

    await expect(
      controller.getViewStats(targetProfileId, user)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(social.send).not.toHaveBeenCalled();
  });

  it.each([
    [
      'wrong account',
      { accountId: targetProfileId, profileId: targetProfileId, owned: true },
    ],
    [
      'wrong profile',
      { accountId, profileId: secondaryProfileId, owned: true },
    ],
    [
      'truthy non-boolean ownership',
      { accountId, profileId: targetProfileId, owned: 'true' },
    ],
    [
      'extra scope field',
      {
        accountId,
        profileId: targetProfileId,
        owned: true,
        appScope: 'client-interface',
      },
    ],
  ])(
    'fails closed for malformed ownership reply (%s)',
    async (_label, reply) => {
      profile.send.mockReturnValueOnce(of(reply));

      await expect(
        controller.getRecentViewers(targetProfileId, undefined, user)
      ).rejects.toMatchObject({ status: 503 });
      expect(social.send).not.toHaveBeenCalled();
    }
  );

  it('maps ownership RPC failure to 503 without contacting Social', async () => {
    profile.send.mockReturnValueOnce(throwError(() => new Error('offline')));

    await expect(
      controller.getViewStats(targetProfileId, user)
    ).rejects.toMatchObject({ status: 503 });
    expect(social.send).not.toHaveBeenCalled();
  });

  it('rejects missing account identity and malformed target UUIDs before RPC or Social', async () => {
    await expect(
      controller.recordView({ profileId: targetProfileId, source: 'x' }, null)
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      controller.recordView({ profileId: '0', source: 'x' }, user)
    ).rejects.toMatchObject({ status: 400 });
    expect(profile.send).not.toHaveBeenCalled();
    expect(social.send).not.toHaveBeenCalled();
  });

  it.each(['0', '1.5', '-1', '101', 'abc'])(
    'rejects invalid viewer limit %s before any service call',
    async (limit) => {
      await expect(
        controller.getRecentViewers(targetProfileId, limit, user)
      ).rejects.toMatchObject({ status: 400 });
      expect(profile.send).not.toHaveBeenCalled();
      expect(social.send).not.toHaveBeenCalled();
    }
  );

  it('accepts a bounded decimal limit and requests only the counterpart-safe projection', async () => {
    const response = [{ viewedAt: new Date() }];
    social.send.mockReturnValueOnce(of(response));

    await expect(
      controller.getRecentViewers(secondaryProfileId, '25', user)
    ).resolves.toBe(response);
    expect(social.send).toHaveBeenCalledWith(
      { cmd: ProfileAnalyticsCommands.GET_RECENT_VIEWERS },
      { profileId: secondaryProfileId, limit: 25 }
    );
  });
});
