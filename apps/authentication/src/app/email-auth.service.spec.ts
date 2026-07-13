import { RpcException } from '@nestjs/microservices';
import { EmailAuthService } from './email-auth.service';
import { AuthActionPurpose } from '../email-auth/entities/auth-action-token.entity';

describe('EmailAuthService', () => {
  const user = {
    id: 'user-1',
    email: 'person@example.com',
    firstName: 'Pat',
    lastName: 'Example',
    emailVerifiedAt: null,
    password: 'old-hash',
    keyData: { salt: 'old-salt' },
  };
  let users: any;
  let actions: any;
  let sessions: any;
  let email: any;
  let password: any;
  let service: EmailAuthService;

  beforeEach(() => {
    users = {
      findOne: jest.fn().mockResolvedValue({ ...user }),
      save: jest.fn(async (value) => value),
    };
    actions = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (value) => ({
        id: 'action-1',
        consumedAt: null,
        ...value,
      })),
      findOne: jest.fn(),
    };
    sessions = {
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    email = {
      sendEmail: jest
        .fn()
        .mockResolvedValue({ success: true, messageId: 'mail-1' }),
    };
    password = {
      ensurePasswordConfirmation: jest.fn(),
      createNewHash: jest
        .fn()
        .mockReturnValue({ hash: 'new-hash', salt: 'new-salt' }),
    };
    service = new EmailAuthService(users, actions, sessions, email, password, {
      issueForUser: jest.fn().mockReturnValue('session-token'),
    } as any);
  });

  it('sends verification from the trusted root-domain alias without exposing the token in storage', async () => {
    const result = await service.requestAction(
      'person@example.com',
      AuthActionPurpose.Verification,
      {
        appId: 'system-configurator',
        appName: 'HAI Computer',
        uiBaseUrl: 'https://hardware.hopefulaspirationsindustries.com',
        from: 'no-reply@hopefulaspirationsindustries.com',
        returnPath: '/',
      }
    );

    expect(result).toEqual({ accepted: true, sent: true });
    expect(actions.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        appId: 'system-configurator',
      })
    );
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@hopefulaspirationsindustries.com',
        html: expect.stringContaining(
          'https://hardware.hopefulaspirationsindustries.com/auth/verify#token='
        ),
      })
    );
    expect(JSON.stringify(actions.save.mock.calls)).not.toContain('#token=');
  });

  it('returns an enumeration-safe accepted result for an unknown email', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(
      service.requestAction(
        'missing@example.com',
        AuthActionPurpose.MagicLink,
        {
          appId: 'client-interface',
          appName: 'Optimistic Tanuki',
          uiBaseUrl: 'https://optimistic-tanuki.com',
          from: 'no-reply@optimistic-tanuki.com',
          returnPath: '/',
        }
      )
    ).resolves.toEqual({ accepted: true, sent: false });
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('consumes verification once, marks the user verified, and issues an app-scoped session', async () => {
    actions.findOne.mockResolvedValue({
      id: 'action-1',
      purpose: AuthActionPurpose.Verification,
      appId: 'forgeofwill',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { ...user },
    });

    await expect(
      service.consumeLoginAction(
        'raw-token',
        AuthActionPurpose.Verification,
        'profile-1'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: { newToken: 'session-token' },
        appId: 'forgeofwill',
      })
    );
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerifiedAt: expect.any(Date) })
    );
    expect(actions.update).toHaveBeenCalledWith(
      { id: 'action-1', consumedAt: expect.anything() },
      expect.anything()
    );
  });

  it('rejects expired action tokens', async () => {
    actions.findOne.mockResolvedValue({
      id: 'action-1',
      purpose: AuthActionPurpose.MagicLink,
      expiresAt: new Date(Date.now() - 1),
      consumedAt: null,
      user: { ...user },
    });
    await expect(
      service.inspect('raw-token', AuthActionPurpose.MagicLink)
    ).rejects.toThrow(RpcException);
  });

  it('resets the password and revokes every existing session', async () => {
    actions.findOne.mockResolvedValue({
      id: 'action-1',
      purpose: AuthActionPurpose.PasswordReset,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      user: { ...user },
    });
    await service.resetPassword('raw-token', 'new-password', 'new-password');
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'new-hash' })
    );
    expect(sessions.update).toHaveBeenCalledWith(
      { userId: 'user-1', revoked: false },
      { revoked: true }
    );
  });
});
