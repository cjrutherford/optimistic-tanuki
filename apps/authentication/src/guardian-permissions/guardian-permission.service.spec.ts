import { RpcException } from '@nestjs/microservices';
import { createHash } from 'crypto';
import { GuardianPermissionService } from './guardian-permission.service';

const NOW = new Date('2026-10-14T12:00:00.000Z');
const CONTEXT = {
  appId: 'client-interface',
  appName: 'Optimistic Tanuki',
  uiBaseUrl: 'https://example.invalid',
  from: 'no-reply@example.invalid',
};
const ATTESTATION_VERSION = 'guardian-attestation-v1';

describe('GuardianPermissionService', () => {
  let permissions: any;
  let users: any;
  let sessions: any;
  let email: any;
  let service: GuardianPermissionService;

  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');

  const tokenFromMail = (
    index: number,
    path: string,
    marker = '#token='
  ) => {
    const message = email.sendEmail.mock.calls[index][0];
    const match = `${message.html}\n${message.text}`.match(
      new RegExp(`${path}${marker}([A-Za-z0-9_-]+)`)
    );
    if (!match) throw new Error(`No ${path} token was included in the message`);
    return match[1];
  };

  const permissionRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'permission-1',
    applicantEmail: 'applicant@example.invalid',
    guardianEmail: 'guardian@example.invalid',
    dateOfBirth: '2010-10-14',
    userId: null,
    guardianUserId: null,
    status: 'pending',
    guardianTokenHash: hash('guardian-token'),
    resumeTokenHash: null,
    attestationVersion: null,
    attestationText: null,
    createdAt: new Date(NOW),
    expiresAt: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
    attestedAt: null,
    deleteAfter: null,
    resumeExpiresAt: null,
    appId: CONTEXT.appId,
    appName: CONTEXT.appName,
    uiBaseUrl: CONTEXT.uiBaseUrl,
    emailFrom: CONTEXT.from,
    replyTo: null,
    ...overrides,
  });

  const makeMemoryPermissions = () => {
    const rows: any[] = [];
    const matches = (row: any, where: any): boolean =>
      Object.entries(where).every(([key, expected]: [string, any]) => {
        if (expected && typeof expected === 'object' && 'type' in expected) {
          if (expected.type === 'isNull') return row[key] == null;
          if (expected.type === 'not' && expected.child?.type === 'isNull') {
            return row[key] != null;
          }
          if (expected.type === 'lessThan') {
            return new Date(row[key]).getTime() < new Date(expected.value).getTime();
          }
          if (expected.type === 'moreThan') {
            return new Date(row[key]).getTime() > new Date(expected.value).getTime();
          }
        }
        return row[key] === expected;
      });
    const matchesCriteria = (row: any, criteria: any): boolean =>
      typeof criteria === 'string' ? row.id === criteria : matches(row, criteria);

    return {
      rows,
      findOne: jest.fn(async ({ where }: any) => {
        const alternatives = Array.isArray(where) ? where : [where];
        return rows.find((row) => alternatives.some((candidate) => matches(row, candidate))) ?? null;
      }),
      find: jest.fn(async ({ where }: any) => rows.filter((row) => matches(row, where))),
      save: jest.fn(async (record: any) => {
        const row = { id: 'permission-1', ...record };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async (criteria: any, patch: any) => {
        const found = rows.filter((row) => matchesCriteria(row, criteria));
        found.forEach((row) => Object.assign(row, patch));
        return { affected: found.length };
      }),
      delete: jest.fn(async (criteria: any) => {
        const matched = rows.filter((row) => matches(row, criteria));
        for (const row of matched) rows.splice(rows.indexOf(row), 1);
        return { affected: matched.length };
      }),
    };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    permissions = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (record) => ({ id: 'permission-1', ...record })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'guardian-user',
        email: 'guardian@example.invalid',
        ageEligibilityStatus: 'adult',
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    sessions = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    email = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    service = new GuardianPermissionService(
      permissions,
      users,
      sessions,
      email
    );
  });

  afterEach(() => jest.useRealTimers());

  it('stores only a hash of the guardian link and keeps the request pending until an affirmative POST', async () => {
    await service.requestPermission({
      dateOfBirth: '2010-10-14',
      applicantEmail: 'Applicant@example.invalid',
      guardianEmail: 'Guardian@example.invalid',
      context: CONTEXT,
    });

    const guardianToken = tokenFromMail(0, '/auth/guardian-consent');
    const saved = permissions.save.mock.calls[0][0];
    expect(saved.guardianTokenHash).toBe(hash(guardianToken));
    expect(JSON.stringify(saved)).not.toContain(guardianToken);
    expect(saved).toEqual(
      expect.objectContaining({
        applicantEmail: 'applicant@example.invalid',
        guardianEmail: 'guardian@example.invalid',
        status: 'pending',
        expiresAt: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
      })
    );

    permissions.findOne.mockResolvedValue(permissionRecord());
    await expect(
      service.attestAsGuardian(guardianToken, 'guardian-user', {
        attested: false,
        attestationVersion: ATTESTATION_VERSION,
      } as any)
    ).rejects.toBeInstanceOf(RpcException);
    expect(permissions.update).not.toHaveBeenCalled();
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('requires the invited guardian contact and exact attestation version', async () => {
    permissions.findOne.mockResolvedValue(permissionRecord());
    users.findOne.mockResolvedValueOnce({
      id: 'wrong-account',
      email: 'someone-else@example.invalid',
      ageEligibilityStatus: 'adult',
    });

    await expect(
      service.attestAsGuardian('guardian-token', 'guardian-user', {
        attested: true,
        attestationVersion: ATTESTATION_VERSION,
      })
    ).rejects.toBeInstanceOf(RpcException);
    await expect(
      service.attestAsGuardian('guardian-token', 'guardian-user', {
        attested: true,
        attestationVersion: 'stale-version',
      })
    ).rejects.toBeInstanceOf(RpcException);

    expect(permissions.update).not.toHaveBeenCalled();
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('binds approval to the authenticated invited adult and rejects body identity or account mismatch', async () => {
    const pending = permissionRecord();
    permissions.findOne.mockResolvedValue(pending);
    users.findOne.mockResolvedValue({
      id: 'guardian-user',
      email: 'GUARDIAN@example.invalid',
      ageEligibilityStatus: 'adult',
    });

    await expect(
      (service as any).attestAsGuardian('guardian-token', 'guardian-user', {
        attested: true,
        attestationVersion: ATTESTATION_VERSION,
      })
    ).resolves.toEqual(expect.objectContaining({ attested: true }));
    expect(permissions.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: pending.id, status: 'pending' }),
      expect.objectContaining({ status: 'approved', guardianUserId: 'guardian-user' })
    );

    for (const user of [
      { id: 'minor', email: 'guardian@example.invalid', ageEligibilityStatus: 'minor' },
      { id: 'wrong-email', email: 'other@example.invalid', ageEligibilityStatus: 'adult' },
      { id: 'self', email: 'applicant@example.invalid', ageEligibilityStatus: 'adult' },
      { id: 'same-address', email: 'guardian@example.invalid', ageEligibilityStatus: 'adult' },
    ]) {
      permissions.update.mockClear();
      permissions.findOne.mockResolvedValue(permissionRecord({
        userId: user.id === 'self' ? 'self' : null,
        ...(user.id === 'same-address' ? { applicantEmail: 'guardian@example.invalid' } : {}),
      }));
      users.findOne.mockResolvedValue(user);
      await expect(
        (service as any).attestAsGuardian('guardian-token', user.id, {
          attested: true,
          attestationVersion: ATTESTATION_VERSION,
          guardianUserId: 'guardian-user',
        })
      ).rejects.toBeInstanceOf(RpcException);
      expect(permissions.update).not.toHaveBeenCalled();
    }
  });

  it('rejects a guardian identity supplied in the message body and permits only one racing bind', async () => {
    const pending = permissionRecord();
    permissions.findOne.mockResolvedValue(pending);
    users.findOne.mockResolvedValue({
      id: 'guardian-user', email: 'guardian@example.invalid', ageEligibilityStatus: 'adult',
    });
    permissions.update
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });
    const input = { attested: true as const, attestationVersion: ATTESTATION_VERSION };
    const results = await Promise.allSettled([
      (service as any).attestAsGuardian('guardian-token', 'guardian-user', input),
      (service as any).attestAsGuardian('guardian-token', 'guardian-user', input),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(permissions.update).toHaveBeenCalledTimes(2);
    expect(permissions.update.mock.calls[0][1].guardianUserId).toBe('guardian-user');
  });

  it('assesses a legacy invited guardian as adult from private DOB input without storing DOB', async () => {
    permissions.findOne.mockResolvedValue(permissionRecord());
    users.findOne.mockResolvedValue({
      id: 'legacy-guardian',
      email: 'guardian@example.invalid',
      ageEligibilityStatus: 'legacy',
    });

    await expect(
      service.attestAsGuardian('guardian-token', 'legacy-guardian', {
        attested: true,
        attestationVersion: ATTESTATION_VERSION,
        dateOfBirth: '2000-01-01',
      })
    ).resolves.toEqual(expect.objectContaining({ attested: true }));

    expect(users.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'legacy-guardian', ageEligibilityStatus: expect.anything() }),
      { ageEligibilityStatus: 'adult', ageEligibilityEndsAt: null }
    );
    expect(users.update.mock.calls[0][1]).not.toHaveProperty('dateOfBirth');
    expect(permissions.update.mock.calls[0][1]).toEqual(
      expect.objectContaining({ guardianUserId: 'legacy-guardian', status: 'approved' })
    );
    expect(JSON.stringify(permissions.update.mock.calls[0][1])).not.toContain('2000-01-01');
  });

  it('does not promote a legacy guardian with a minor DOB or overwrite a concurrent status change', async () => {
    permissions.findOne.mockResolvedValue(permissionRecord());
    users.findOne.mockResolvedValue({
      id: 'legacy-guardian',
      email: 'guardian@example.invalid',
      ageEligibilityStatus: 'legacy',
    });
    await expect(
      service.attestAsGuardian('guardian-token', 'legacy-guardian', {
        attested: true,
        attestationVersion: ATTESTATION_VERSION,
      })
    ).rejects.toBeInstanceOf(RpcException);
    expect(users.update).not.toHaveBeenCalled();

    await expect(
      service.attestAsGuardian('guardian-token', 'legacy-guardian', {
        attested: true,
        attestationVersion: ATTESTATION_VERSION,
        dateOfBirth: '2010-01-01',
      })
    ).rejects.toBeInstanceOf(RpcException);
    expect(users.update).not.toHaveBeenCalled();
    expect(permissions.update).not.toHaveBeenCalled();

    users.update.mockResolvedValueOnce({ affected: 0 });
    await expect(
      service.attestAsGuardian('guardian-token', 'legacy-guardian', {
        attested: true,
        attestationVersion: ATTESTATION_VERSION,
        dateOfBirth: '2000-01-01',
      })
    ).rejects.toBeInstanceOf(RpcException);
    expect(permissions.update).not.toHaveBeenCalled();
  });

  it('never lets known minor, pending, or revoked accounts self-promote with adult DOB input', async () => {
    for (const ageEligibilityStatus of ['minor', 'minor-pending', 'revoked']) {
      permissions.findOne.mockResolvedValue(permissionRecord());
      users.findOne.mockResolvedValue({
        id: `${ageEligibilityStatus}-guardian`,
        email: 'guardian@example.invalid',
        ageEligibilityStatus,
      });
      await expect(
        service.attestAsGuardian('guardian-token', `${ageEligibilityStatus}-guardian`, {
          attested: true,
          attestationVersion: ATTESTATION_VERSION,
          dateOfBirth: '2000-01-01',
        })
      ).rejects.toBeInstanceOf(RpcException);
    }
    expect(users.update).not.toHaveBeenCalled();
    expect(permissions.update).not.toHaveBeenCalled();
  });

  it('atomically consumes a guardian link once when two attestations race', async () => {
    const pending = permissionRecord();
    let lookups = 0;
    let releaseLookups!: () => void;
    const bothLookedUp = new Promise<void>((resolve) => {
      releaseLookups = resolve;
    });
    permissions.findOne.mockImplementation(async () => {
      lookups += 1;
      if (lookups === 2) releaseLookups();
      await bothLookedUp;
      return pending;
    });
    permissions.update
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });

    const input = {
      guardianEmail: 'guardian@example.invalid',
      attested: true as const,
      attestationVersion: ATTESTATION_VERSION,
    };
    const results = await Promise.allSettled([
      service.attestAsGuardian('guardian-token', 'guardian-user', input),
      service.attestAsGuardian('guardian-token', 'guardian-user', input),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(permissions.update).toHaveBeenCalledTimes(2);
    expect(email.sendEmail).toHaveBeenCalledTimes(2);
  });

  it('sends a separate, hashed, one-use resume link to the applicant and validates it without consuming it', async () => {
    const pending = permissionRecord();
    permissions.findOne.mockResolvedValue(pending);

    const result = await service.attestAsGuardian('guardian-token', 'guardian-user', {
      attested: true,
      attestationVersion: ATTESTATION_VERSION,
    });

    expect(result).toEqual({
      attested: true,
      applicantNotified: true,
      continuationRequired: true,
      withdrawalUrl: expect.stringMatching(
        /^https:\/\/example\.invalid\/auth\/guardian-consent#withdrawToken=[A-Za-z0-9_-]+$/
      ),
    });

    expect(email.sendEmail).toHaveBeenCalledTimes(2);
    expect(email.sendEmail.mock.calls[0][0].to).toBe(
      'applicant@example.invalid'
    );
    const approval = permissions.update.mock.calls[0][1];
    expect(approval).toEqual(
      expect.objectContaining({
        status: 'approved',
        guardianTokenHash: null,
        resumeTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        attestationVersion: ATTESTATION_VERSION,
        withdrawalTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        attestedAt: NOW,
        resumeExpiresAt: new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
        deleteAfter: new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
      })
    );

    const resumeToken = tokenFromMail(0, '/register');
    const withdrawalToken = tokenFromMail(
      1,
      '/auth/guardian-consent',
      '#withdrawToken='
    );
    expect(approval.resumeTokenHash).toBe(hash(resumeToken));
    expect(approval.withdrawalTokenHash).toBe(hash(withdrawalToken));
    expect(email.sendEmail.mock.calls[0][0].to).toBe('applicant@example.invalid');
    expect(email.sendEmail.mock.calls[1][0].to).toBe('guardian@example.invalid');
    expect(JSON.stringify(permissions.update.mock.calls)).not.toContain(
      resumeToken
    );
    const lookupCount = permissions.findOne.mock.calls.length;
    permissions.findOne.mockResolvedValue(
      permissionRecord({
        status: 'approved',
        guardianTokenHash: null,
        resumeTokenHash: hash(resumeToken),
        resumeExpiresAt: new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
      })
    );

    await expect(service.validateResume(resumeToken)).resolves.toEqual({
      valid: true,
      email: 'applicant@example.invalid',
    });
    expect(permissions.findOne).toHaveBeenCalledTimes(lookupCount + 1);
    expect(permissions.update).toHaveBeenCalledTimes(1);
  });

  it('rejects under-13 requests without saving a permission or sending email', async () => {
    await expect(
      service.requestPermission({
        dateOfBirth: '2015-10-14',
        applicantEmail: 'applicant@example.invalid',
        guardianEmail: 'guardian@example.invalid',
        context: CONTEXT,
      })
    ).rejects.toBeInstanceOf(RpcException);

    expect(permissions.save).not.toHaveBeenCalled();
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('marks an adult account eligible without persisting a birth date or sending a guardian request', async () => {
    await service.requestPermission({
      dateOfBirth: '1990-10-14',
      applicantEmail: 'adult@example.invalid',
      guardianEmail: 'unused@example.invalid',
      userId: 'adult-user',
      context: CONTEXT,
    });

    expect(users.update).toHaveBeenCalledWith('adult-user', {
      ageEligibilityStatus: 'adult',
      ageEligibilityEndsAt: null,
    });
    expect(permissions.save).not.toHaveBeenCalled();
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(JSON.stringify(permissions.save.mock.calls)).not.toContain(
      '1990-10-14'
    );
  });

  it('denies unassessed users in both gated apps, fails closed without app scope, and preserves legacy and unrelated app access', async () => {
    users.findOne.mockResolvedValue({
      id: 'new-user',
      ageEligibilityStatus: 'unassessed',
    });

    await expect(
      service.assertAccountAccess('new-user', 'client-interface')
    ).rejects.toBeInstanceOf(RpcException);
    await expect(
      service.assertAccountAccess('new-user', 'local-hub')
    ).rejects.toBeInstanceOf(RpcException);
    await expect(service.assertAccountAccess('new-user')).rejects.toBeInstanceOf(
      RpcException
    );
    await expect(
      service.assertAccountAccess('new-user', 'unrelated-app')
    ).resolves.toBeUndefined();

    users.findOne.mockResolvedValue({
      id: 'legacy-user',
      ageEligibilityStatus: 'legacy',
    });
    await expect(
      service.assertAccountAccess('legacy-user', 'local-hub')
    ).resolves.toBeUndefined();
    await expect(service.assertAccountAccess('legacy-user')).resolves.toBeUndefined();
  });

  it('denies pending and revoked accounts before any foreign-app or missing-scope exemption', async () => {
    for (const ageEligibilityStatus of ['minor-pending', 'revoked']) {
      users.findOne.mockResolvedValue({
        id: `${ageEligibilityStatus}-user`,
        ageEligibilityStatus,
      });

      for (const appId of [undefined, 'client-interface', 'local-hub', 'unrelated-app']) {
        await expect(
          service.assertAccountAccess(`${ageEligibilityStatus}-user`, appId)
        ).rejects.toBeInstanceOf(RpcException);
      }
    }
  });

  it('moves an approved minor to adult access at 18 and retains the permission record for 90 days', async () => {
    users.findOne.mockResolvedValue({
      id: 'turning-adult',
      ageEligibilityStatus: 'minor',
    });
    permissions.findOne.mockResolvedValue(
      permissionRecord({
        status: 'approved',
        userId: 'turning-adult',
        dateOfBirth: '2008-10-14',
      })
    );

    await expect(
      service.assertAccountAccess('turning-adult', 'client-interface')
    ).resolves.toBeUndefined();

    expect(users.update).toHaveBeenCalledWith('turning-adult', {
      ageEligibilityStatus: 'adult',
    });
    expect(permissions.update).toHaveBeenCalledWith(
      'permission-1',
      expect.objectContaining({
        deleteAfter: new Date('2027-01-12T00:00:00.000Z'),
      })
    );
  });

  it('binds a resume link to the applicant account email before consuming it', async () => {
    const resumeToken = 'applicant-resume-token';
    permissions.findOne.mockResolvedValue(
      permissionRecord({
        status: 'approved',
        userId: null,
        guardianTokenHash: null,
        resumeTokenHash: hash(resumeToken),
        resumeExpiresAt: new Date(NOW.getTime() + 60_000),
      })
    );
    users.findOne.mockResolvedValue({
      id: 'different-user',
      email: 'someone-else@example.invalid',
    });

    await expect(
      service.attachAccount(resumeToken, 'different-user')
    ).rejects.toBeInstanceOf(RpcException);
    expect(permissions.update).not.toHaveBeenCalled();
    expect(users.update).not.toHaveBeenCalled();
  });

  it('reuses an expired user-linked request after guardian email failure without a duplicate insert', async () => {
    const expired = permissionRecord({
      id: 'failed-request',
      userId: 'retry-user',
      status: 'expired',
      guardianTokenHash: null,
      createdAt: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(NOW.getTime() + 80 * 24 * 60 * 60 * 1000),
      deleteAfter: new Date(NOW.getTime() + 80 * 24 * 60 * 60 * 1000),
    });
    permissions.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(expired);
    email.sendEmail
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });

    const assessment = {
      userId: 'retry-user',
      email: 'applicant@example.invalid',
      status: 'unassessed' as const,
      dateOfBirth: '2010-05-10',
      guardianEmail: 'guardian@example.invalid',
      context: CONTEXT,
    };

    await expect(
      service.assessUnassessedLogin(assessment)
    ).resolves.toEqual({ pending: true, sent: false });

    expect(permissions.save).toHaveBeenCalledTimes(1);
    expect(users.update).toHaveBeenCalledWith('retry-user', {
      ageEligibilityEndsAt: '2028-05-10',
    });
    expect(users.update).not.toHaveBeenCalledWith('retry-user', {
      ageEligibilityStatus: 'minor-pending',
    });
    expect(permissions.update).toHaveBeenCalledWith(
      'permission-1',
      expect.objectContaining({
        status: 'expired',
        guardianTokenHash: null,
        deleteAfter: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
      })
    );

    await expect(
      service.assessUnassessedLogin(assessment)
    ).resolves.toEqual({ pending: true, sent: true });
    expect(permissions.save).toHaveBeenCalledTimes(1);
    expect(permissions.update).toHaveBeenCalledWith(
      { id: 'failed-request', userId: 'retry-user', status: 'expired' },
      expect.objectContaining({
        status: 'pending',
        userId: 'retry-user',
        createdAt: expired.createdAt,
        expiresAt: expired.expiresAt,
        deleteAfter: null,
      })
    );
    expect(users.update).toHaveBeenCalledWith('retry-user', {
      ageEligibilityStatus: 'minor-pending',
    });
    expect(permissions.save.mock.calls[0][0].dateOfBirth).toBe('2010-05-10');
    expect(users.update.mock.calls.flat()).not.toContain('2010-05-10');
  });

  it('removes an expired pending request before retry and rejects an adult DOB that mismatches its private age expiry', async () => {
    permissions = makeMemoryPermissions();
    permissions.rows.push(
      permissionRecord({
        applicantEmail: 'applicant@example.invalid',
        guardianTokenHash: hash('expired-guardian-token'),
        expiresAt: new Date(NOW.getTime() - 1),
      })
    );
    service = new GuardianPermissionService(permissions, users, sessions, email);

    await expect(
      service.assessUnassessedLogin({
        userId: 'retry-user',
        email: 'applicant@example.invalid',
        status: 'unassessed',
        ageEligibilityEndsAt: '2028-05-10',
        dateOfBirth: '2010-05-10',
        guardianEmail: 'guardian@example.invalid',
        context: CONTEXT,
      })
    ).resolves.toEqual({ pending: true, sent: true });

    expect(permissions.rows).toHaveLength(1);
    expect(permissions.rows[0]).toEqual(
      expect.objectContaining({
        status: 'pending',
        guardianTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
      })
    );
    expect(permissions.rows[0].guardianTokenHash).not.toBe(
      hash('expired-guardian-token')
    );

    let mismatch: unknown;
    try {
      await service.assessUnassessedLogin({
        userId: 'retry-user',
        email: 'applicant@example.invalid',
        status: 'minor-pending',
        ageEligibilityEndsAt: '2028-05-10',
        dateOfBirth: '1990-05-10',
        guardianEmail: 'guardian@example.invalid',
        context: CONTEXT,
      });
    } catch (error) {
      mismatch = error;
    }
    expect(mismatch).toBeInstanceOf(RpcException);
    expect((mismatch as RpcException).getError()).toEqual({
      code: 'AGE_ASSESSMENT_MISMATCH',
    });
    expect(users.update).not.toHaveBeenCalledWith('retry-user', {
      ageEligibilityStatus: 'adult',
      ageEligibilityEndsAt: null,
    });
  });

  it('clears the private age expiry and restores adult access at the age-out date', async () => {
    users.findOne.mockResolvedValue({
      id: 'aged-out-user',
      ageEligibilityStatus: 'minor-pending',
      ageEligibilityEndsAt: '2026-10-14',
    });

    await expect(
      service.assertAccountAccess('aged-out-user', 'local-hub')
    ).resolves.toBeUndefined();
    await expect(
      service.assertAccountAccess('aged-out-user', 'client-interface')
    ).resolves.toBeUndefined();

    expect(users.update).toHaveBeenCalledWith('aged-out-user', {
      ageEligibilityStatus: 'adult',
      ageEligibilityEndsAt: null,
    });
    expect(permissions.findOne).not.toHaveBeenCalled();
  });

  it('withdraws shared access, revokes every active session, and keeps records for 90 days', async () => {
    permissions.findOne.mockResolvedValue(
      permissionRecord({ status: 'approved', userId: 'minor-user' })
    );

    await expect(service.withdraw('minor-user')).resolves.toEqual({
      revoked: true,
    });
    expect(permissions.update).toHaveBeenCalledWith(
      'permission-1',
      expect.objectContaining({
        status: 'revoked',
        guardianTokenHash: null,
        resumeTokenHash: null,
        deleteAfter: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
      })
    );
    expect(users.update).toHaveBeenCalledWith('minor-user', {
      ageEligibilityStatus: 'revoked',
    });
    expect(sessions.update).toHaveBeenCalledWith(
      { userId: 'minor-user', revoked: false },
      { revoked: true }
    );

    users.findOne.mockResolvedValue({
      id: 'minor-user',
      ageEligibilityStatus: 'revoked',
    });
    for (const appId of ['client-interface', 'local-hub']) {
      await expect(
        service.assertAccountAccess('minor-user', appId)
      ).rejects.toBeInstanceOf(RpcException);
    }
  });

  it('gives the guardian a separate hashed withdrawal control that revokes once across both apps', async () => {
    permissions.findOne.mockResolvedValue(permissionRecord({
      status: 'pending',
      userId: 'minor-user',
    }));
    const approvalResult = await service.attestAsGuardian('guardian-token', 'guardian-user', {
      attested: true,
      attestationVersion: ATTESTATION_VERSION,
    });
    expect(approvalResult).toEqual(
      expect.objectContaining({
        applicantNotified: false,
        continuationRequired: false,
      })
    );

    const guardianControl = tokenFromMail(
      0,
      '/auth/guardian-consent',
      '#withdrawToken='
    );
    const approval = permissions.update.mock.calls[0][1];
    expect(approval.withdrawalTokenHash).toBe(hash(guardianControl));
    expect(approval.withdrawalTokenHash).not.toBe(guardianControl);
    expect(email.sendEmail.mock.calls[0][0].to).toBe('guardian@example.invalid');

    const approved = permissionRecord({
      status: 'approved',
      userId: 'minor-user',
      guardianTokenHash: null,
      withdrawalTokenHash: hash(guardianControl),
    });
    permissions.findOne.mockResolvedValue(approved);
    permissions.update.mockResolvedValueOnce({ affected: 1 });
    await expect(service.withdrawByToken(guardianControl)).resolves.toEqual({
      revoked: true,
    });
    expect(permissions.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'permission-1',
        withdrawalTokenHash: hash(guardianControl),
        status: 'approved',
      }),
      expect.objectContaining({
        status: 'revoked',
        withdrawalTokenHash: null,
        deleteAfter: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
      })
    );
    expect(users.update).toHaveBeenLastCalledWith('minor-user', {
      ageEligibilityStatus: 'revoked',
    });
    expect(sessions.update).toHaveBeenLastCalledWith(
      { userId: 'minor-user', revoked: false },
      { revoked: true }
    );

    permissions.update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.withdrawByToken(guardianControl)).rejects.toBeInstanceOf(
      RpcException
    );
  });

  it('lets a guardian withdraw before account attachment and invalidates the applicant resume link', async () => {
    permissions.findOne.mockResolvedValue(permissionRecord());
    await service.attestAsGuardian('guardian-token', 'guardian-user', {
      attested: true,
      attestationVersion: ATTESTATION_VERSION,
    });
    const resumeToken = tokenFromMail(0, '/register');
    const withdrawalToken = tokenFromMail(
      1,
      '/auth/guardian-consent',
      '#withdrawToken='
    );
    permissions.findOne.mockResolvedValue(
      permissionRecord({
        status: 'approved',
        userId: null,
        resumeTokenHash: hash(resumeToken),
        withdrawalTokenHash: hash(withdrawalToken),
      })
    );

    await expect(service.withdrawByToken(withdrawalToken)).resolves.toEqual({
      revoked: true,
    });
    expect(permissions.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'permission-1',
        withdrawalTokenHash: hash(withdrawalToken),
        status: 'approved',
      }),
      expect.objectContaining({
        status: 'revoked',
        resumeTokenHash: null,
        withdrawalTokenHash: null,
        deleteAfter: new Date(NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
      })
    );
    expect(users.update).not.toHaveBeenCalled();
    expect(sessions.update).not.toHaveBeenCalled();

    permissions.findOne.mockResolvedValue(null);
    await expect(service.validateResume(resumeToken)).rejects.toBeInstanceOf(
      RpcException
    );
    await expect(service.attachAccount(resumeToken, 'applicant-user')).rejects.toBeInstanceOf(
      RpcException
    );
    users.findOne.mockClear();
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('lets the guardian resend only to the bound applicant without extending the original resume deadline', async () => {
    const withdrawalToken = 'guardian-withdrawal-control';
    const originalDeadline = new Date(NOW.getTime() + 36 * 60 * 60 * 1000);
    permissions.findOne.mockResolvedValue(
      permissionRecord({
        status: 'approved',
        userId: null,
        dateOfBirth: '2010-10-14',
        resumeTokenHash: hash('old-resume-token'),
        resumeExpiresAt: originalDeadline,
        withdrawalTokenHash: hash(withdrawalToken),
      })
    );

    await expect(
      service.resendApplicantContinuation(withdrawalToken)
    ).resolves.toEqual({ sent: true });

    expect(permissions.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        withdrawalTokenHash: hash(withdrawalToken),
        status: 'approved',
        resumeExpiresAt: expect.anything(),
      }),
    });
    expect(permissions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'permission-1',
        status: 'approved',
        withdrawalTokenHash: hash(withdrawalToken),
      }),
      { resumeTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }
    );
    expect(permissions.update.mock.calls[0][1].resumeTokenHash).not.toBe(
      'old-resume-token'
    );
    expect(permissions.update.mock.calls[0][1].resumeExpiresAt).toBeUndefined();
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(email.sendEmail.mock.calls[0][0].to).toBe(
      'applicant@example.invalid'
    );
    expect(email.sendEmail.mock.calls[0][0].html).toContain(
      originalDeadline.toISOString()
    );
    // Only the continuation secret is rotated; the stored expiry is omitted
    // from the update patch and the email continues to show the original value.
    expect(JSON.stringify(permissions.update.mock.calls)).not.toContain(
      'old-resume-token'
    );
  });

  it('does not resend an applicant continuation after attachment, expiry, adulthood, or revocation', async () => {
    const withdrawalToken = 'guardian-withdrawal-control';
    const unavailable = [
      // Attached and revoked rows are excluded by the service lookup itself.
      null,
      permissionRecord({
        status: 'approved',
        userId: null,
        resumeExpiresAt: new Date(NOW.getTime() - 1),
        withdrawalTokenHash: hash(withdrawalToken),
      }),
      permissionRecord({
        status: 'approved',
        userId: null,
        dateOfBirth: '1990-10-14',
        withdrawalTokenHash: hash(withdrawalToken),
      }),
      null,
    ];
    // Simulate a row that expires between the SELECT and guarded UPDATE.
    permissions.update.mockResolvedValueOnce({ affected: 0 });

    for (const permission of unavailable) {
      permissions.findOne.mockResolvedValueOnce(permission);
      await expect(
        service.resendApplicantContinuation(withdrawalToken)
      ).rejects.toBeInstanceOf(RpcException);
    }

    expect(permissions.update).toHaveBeenCalledTimes(1);
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(permissions.findOne).toHaveBeenCalledTimes(4);
    for (const call of permissions.findOne.mock.calls) {
      expect(call[0].where).toEqual(
        expect.objectContaining({
          withdrawalTokenHash: hash(withdrawalToken),
          status: 'approved',
          userId: expect.anything(),
          resumeExpiresAt: expect.anything(),
        })
      );
    }
  });

  it('deletes an approved unattached request when its 48-hour resume window ends', async () => {
    permissions = makeMemoryPermissions();
    service = new GuardianPermissionService(permissions, users, sessions, email);

    await service.requestPermission({
      dateOfBirth: '2010-10-14',
      applicantEmail: 'applicant@example.invalid',
      guardianEmail: 'guardian@example.invalid',
      context: CONTEXT,
    });
    const guardianToken = tokenFromMail(0, '/auth/guardian-consent');
    await service.attestAsGuardian(guardianToken, 'guardian-user', {
      attested: true,
      attestationVersion: ATTESTATION_VERSION,
    });
    const resumeToken = tokenFromMail(1, '/register');
    expect(permissions.rows).toHaveLength(1);
    expect(permissions.rows[0]).toEqual(
      expect.objectContaining({
        status: 'approved',
        userId: null,
        resumeExpiresAt: new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
        deleteAfter: new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
      })
    );

    jest.setSystemTime(
      new Date(NOW.getTime() + 48 * 60 * 60 * 1000 + 1)
    );
    await service.cleanupExpired();

    expect(permissions.rows).toHaveLength(0);
    await expect(service.validateResume(resumeToken)).rejects.toBeInstanceOf(
      RpcException
    );
    await expect(service.attachAccount(resumeToken, 'applicant-user')).rejects.toBeInstanceOf(
      RpcException
    );
    users.findOne.mockClear();
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('expires pending and retained records at their configured cleanup deadlines', async () => {
    await service.cleanupExpired();

    expect(permissions.delete).toHaveBeenCalledTimes(2);
    expect(permissions.delete.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: 'pending', expiresAt: expect.anything() })
    );
    expect(permissions.delete.mock.calls[1][0]).toEqual(
      expect.objectContaining({ deleteAfter: expect.anything() })
    );
  });
});
