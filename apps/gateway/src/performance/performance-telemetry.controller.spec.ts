import { of } from 'rxjs';
import {
  AuthCommands,
  NotificationCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { PerformanceTelemetryController } from './performance-telemetry.controller';

describe('PerformanceTelemetryController owner notifications', () => {
  it('notifies distinct profile recipients and deduplicates email by account', async () => {
    const accountId = '11111111-1111-4111-8111-111111111111';
    const profileOne = '22222222-2222-4222-8222-222222222222';
    const profileTwo = '33333333-3333-4333-8333-333333333333';
    const profileSend = jest.fn().mockReturnValue(
      of([
        { id: profileOne, userId: accountId },
        { id: profileOne.toUpperCase(), userId: accountId.toUpperCase() },
        { id: profileTwo, userId: accountId },
        { id: accountId, userId: 'bad-account' },
        { id: 'bad-profile', userId: accountId },
      ])
    );
    const authSend = jest
      .fn()
      .mockReturnValue(of([{ id: accountId, email: 'owner@example.test' }]));
    const socialSend = jest.fn().mockReturnValue(of({}));
    const emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    const telemetry = {
      record: jest.fn(),
      recordRuntime: jest.fn(),
      summaries: jest.fn(),
      runtimeSummaries: jest.fn(),
      prometheus: jest.fn(),
      listAlerts: jest.fn(),
      acknowledge: jest.fn(),
    };
    const controller = new PerformanceTelemetryController(
      telemetry as any,
      { send: authSend } as any,
      { send: profileSend } as any,
      { send: socialSend } as any,
      emailService as any
    );
    await (controller as any).notifyOwners({
      id: 'alert',
      severity: 'critical',
      appId: 'gateway',
      metric: 'lcp',
      route: '/x',
      observed: 5000,
      threshold: 2500,
    });
    expect(profileSend).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetAll },
      { where: { appScope: 'owner-console' } }
    );
    expect(authSend).toHaveBeenCalledWith(
      { cmd: AuthCommands.GetUsersByIds },
      { userIds: [accountId] }
    );
    const payloads = socialSend.mock.calls.map((call) => call[1]);
    expect(payloads.map((payload) => payload.recipientId).sort()).toEqual(
      [profileOne, profileTwo].sort()
    );
    expect(
      payloads.every(
        (payload) => !('resourceId' in payload) && !('actionUrl' in payload)
      )
    ).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.test' })
    );
    expect(socialSend).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: NotificationCommands.CREATE }),
      expect.any(Object)
    );
    expect(profileSend).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: ProfileCommands.GetAll }),
      expect.any(Object)
    );
    expect(authSend).toHaveBeenCalledWith(
      expect.objectContaining({ cmd: AuthCommands.GetUsersByIds }),
      expect.any(Object)
    );
    expect(ServiceTokens.PROFILE_SERVICE).toBeDefined();
  });
});
