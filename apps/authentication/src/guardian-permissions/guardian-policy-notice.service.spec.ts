import { GuardianPolicyNoticeService } from './guardian-policy-notice.service';
import { GuardianPermissionEntity } from './entities/guardian-permission.entity';
import { UserEntity } from '../user/entities/user.entity';

describe('GuardianPolicyNoticeService', () => {
  const version = 'TEST-GUARDIAN-NOTICE-2026-10-16';
  const operatorToken = 'guardian-notice-test-operator-token';
  let permissions: any;
  let users: any;
  let notices: any;
  let email: any;
  let service: GuardianPolicyNoticeService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T12:00:00Z'));
    process.env.GUARDIAN_POLICY_NOTICE_APPROVED_POLICIES = JSON.stringify({
      [version]: { url: 'https://example.test/guardian-policy/test' },
    });
    process.env.GUARDIAN_POLICY_NOTICE_OPERATOR_TOKEN = operatorToken;
    permissions = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'permission-1',
          userId: 'dependent-1',
          guardianUserId: 'guardian-1',
          status: 'approved',
          dateOfBirth: '2010-10-16',
          appName: 'Optimistic Tanuki',
          emailFrom: 'notice@example.test',
        },
        {
          id: 'permission-2',
          userId: 'dependent-2',
          guardianUserId: 'guardian-1',
          status: 'approved',
          dateOfBirth: '2012-01-01',
          appName: 'Towne Square',
          emailFrom: 'notice@example.test',
        },
      ]),
    };
    users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'guardian-1',
        email: 'verified-guardian@example.test',
        emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
        ageEligibilityStatus: 'adult',
      }),
    };
    const storedNotices: any[] = [];
    notices = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn(async () => storedNotices),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const saved = { id: 'notice-1', ...value };
        storedNotices.push(saved);
        return saved;
      }),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(async (where: any, patch: any) => {
        const id = typeof where === 'string' ? where : where.id;
        const matches = storedNotices.filter((row) => !id || row.id === id);
        matches.forEach((row) => Object.assign(row, patch));
        return { affected: matches.length || 1 };
      }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    email = { sendEmail: jest.fn().mockResolvedValue({ success: true }) };
    service = new GuardianPolicyNoticeService(
      permissions,
      users,
      notices,
      email
    );
  });

  afterEach(() => {
    delete process.env.GUARDIAN_POLICY_NOTICE_APPROVED_POLICIES;
    delete process.env.GUARDIAN_POLICY_NOTICE_OPERATOR_TOKEN;
    jest.useRealTimers();
  });

  it('schedules one idempotent notice per current verified guardian across linked apps', async () => {
    await expect(
      service.schedulePolicyNotice(version, operatorToken)
    ).resolves.toEqual({
      policyVersion: version,
      scheduled: 1,
      alreadyScheduled: 0,
    });

    expect(notices.save).toHaveBeenCalledTimes(1);
    expect(notices.save).toHaveBeenCalledWith(
      expect.objectContaining({
        policyVersion: version,
        guardianUserId: 'guardian-1',
        policyUrl: 'https://example.test/guardian-policy/test',
        status: 'pending',
      })
    );
    expect(notices.save.mock.calls[0][0]).not.toHaveProperty('recipientEmail');
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('requires an operator-configured policy version and a verified adult linked guardian', async () => {
    await expect(
      service.schedulePolicyNotice('UNAPPROVED-POLICY', operatorToken)
    ).rejects.toThrow('Guardian policy version is not approved for delivery');

    users.findOne.mockResolvedValueOnce({
      id: 'guardian-1',
      email: 'unverified@example.test',
      emailVerifiedAt: null,
      ageEligibilityStatus: 'adult',
    });
    await expect(
      service.schedulePolicyNotice(version, operatorToken)
    ).resolves.toMatchObject({
      scheduled: 0,
    });
    expect(notices.save).not.toHaveBeenCalled();
  });

  it('rejects missing or incorrect operator credentials before reading guardian accounts', async () => {
    await expect(
      service.schedulePolicyNotice(version, 'incorrect-operator-token')
    ).rejects.toThrow('Guardian policy notice operator authorization failed');
    expect(permissions.find).not.toHaveBeenCalled();
    expect(notices.save).not.toHaveBeenCalled();
  });

  it('makes repeated operator scheduling idempotent for the same guardian and version', async () => {
    notices.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'notice-1' });

    await expect(
      service.schedulePolicyNotice(version, operatorToken)
    ).resolves.toMatchObject({
      scheduled: 1,
      alreadyScheduled: 0,
    });
    await expect(
      service.schedulePolicyNotice(version, operatorToken)
    ).resolves.toMatchObject({
      scheduled: 0,
      alreadyScheduled: 1,
    });
    expect(notices.save).toHaveBeenCalledTimes(1);
  });

  it('retries a transient provider failure and records acceptance after recovery', async () => {
    await service.schedulePolicyNotice(version, operatorToken);
    email.sendEmail
      .mockResolvedValueOnce({ success: false, error: 'temporary SMTP error' })
      .mockResolvedValueOnce({ success: true, messageId: 'mailpit-1' });
    const notice = (await notices.find())[0];

    await service.deliverDueNotices();
    expect(notice).toMatchObject({ status: 'pending', attempts: 1 });
    expect(notice.lastFailureCode).toBeNull();
    expect(notice.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    await service.deliverDueNotices(new Date(notice.nextAttemptAt));
    expect(notice).toMatchObject({ status: 'accepted', attempts: 1 });
    expect(notice.acceptedAt).toEqual(new Date(notice.nextAttemptAt));
    expect(email.sendEmail).toHaveBeenCalledTimes(2);
    expect(email.sendEmail.mock.calls[0][0].to).toBe(
      'verified-guardian@example.test'
    );
    expect(email.sendEmail.mock.calls[0][0].text).toContain(
      'no public policy change was made'
    );
    expect(email.sendEmail.mock.calls[0][0].sensitive).toBe(true);
  });

  it('makes permanent delivery failure visible and allows an operator retry', async () => {
    await service.schedulePolicyNotice(version, operatorToken);
    const notice = (await notices.find())[0];
    notice.attempts = 7;
    email.sendEmail.mockResolvedValue({
      success: false,
      error: 'permanent SMTP error',
    });

    await service.deliverDueNotices(new Date(Date.now() + 24 * 60 * 60 * 1000));
    expect(notice).toMatchObject({
      status: 'failed',
      attempts: 8,
      lastFailureCode: 'EMAIL_PROVIDER_REJECTED',
    });

    await expect(
      service.retryFailedNotices(version, operatorToken)
    ).resolves.toEqual({
      policyVersion: version,
      retried: 1,
    });
    expect(notice).toMatchObject({
      status: 'pending',
      attempts: 0,
      lastFailureCode: null,
    });
  });
});
