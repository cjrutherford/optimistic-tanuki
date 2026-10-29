import * as jwt from 'jsonwebtoken';
import * as qrcode from 'qrcode';

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  MfaService,
  PasswordPolicyService,
  TokenIssuerService,
} from '@optimistic-tanuki/auth-domain';

import { AppService } from './app.service';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { KeyService } from './key.service';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { SaltedHashService } from '@optimistic-tanuki/encryption';
import { TokenEntity } from '../tokens/entities/token.entity';
import { UserEntity } from '../user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailService } from '@optimistic-tanuki/email';
import { GuardianPermissionService } from '../guardian-permissions/guardian-permission.service';
import { ProfileOwnershipVerifier } from './profile-ownership-verifier.service';
import { AccountDeletionFenceService } from '../account-deletion/account-deletion-fence.service';

let service: AppService;
let userRepo: Repository<UserEntity>;
let tokenRepo: Repository<TokenEntity>;
let keyRepo: Repository<KeyDatum>;
let saltedHashService: SaltedHashService;
let authenticator: any;
let keyService: KeyService;
let jwtHandle: typeof jwt;
let jwtService: JwtService;
let configService: ConfigService;
let profileOwnershipVerifier: { resolveSelection: jest.Mock };
let accountDeletionFence: { assertActiveAccount: jest.Mock };

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('qrCodeDataUrl'),
}));

const expectRpcError = async (promise: Promise<unknown>, message: string) => {
  let rejected: unknown;
  try {
    await promise;
  } catch (error) {
    rejected = error;
  }

  expect(rejected).toBeInstanceOf(RpcException);
  expect((rejected as RpcException).message).toBe(message);
};

describe('AppService.getPublicOAuthConfig', () => {
  it('merges per-domain overrides on top of global provider settings', () => {
    const config = {
      oauth: {
        google: {
          enabled: true,
          clientId: 'global-google-client',
          redirectUri: 'https://global.example.com/google/callback',
          scopes: ['openid', 'email'],
          authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        },
        github: {
          enabled: true,
          clientId: 'global-github-client',
          redirectUri: 'https://global.example.com/github/callback',
          scopes: ['read:user'],
          authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        },
        apps: [
          {
            domain: 'tenant.example.com',
            google: {
              clientId: 'tenant-google-client',
              redirectUri: 'https://tenant.example.com/google/callback',
            },
            github: {
              enabled: false,
            },
          },
        ],
      },
    };

    const configService = {
      get: jest.fn((path: string) => {
        const value = path
          .split('.')
          .reduce<unknown>(
            (current, key) => (current as Record<string, unknown>)?.[key],
            config
          );
        return value;
      }),
    } as unknown as ConfigService;

    const service = new AppService(
      new Logger(),
      configService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      'jwt-secret',
      {} as never,
      {} as JwtService,
      {} as EmailService,
      { assertAccountAccess: jest.fn() } as never,
      { resolveSelection: jest.fn() } as never,
      { assertActiveAccount: jest.fn().mockResolvedValue(undefined) } as never
    );

    expect(service.getPublicOAuthConfig('tenant.example.com')).toEqual({
      google: {
        clientId: 'tenant-google-client',
        redirectUri: 'https://tenant.example.com/google/callback',
        scopes: ['openid', 'email'],
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        enabled: true,
      },
    });
  });
});

describe('AppService', () => {
  beforeEach(async () => {
    profileOwnershipVerifier = {
      resolveSelection: jest.fn((_accountId, selectedProfile) =>
        Promise.resolve(selectedProfile || undefined)
      ),
    };
    accountDeletionFence = {
      assertActiveAccount: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Logger,
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            insert: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TokenEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(KeyDatum),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: GuardianPermissionService,
          useValue: {
            assertAccountAccess: jest.fn().mockResolvedValue(undefined),
            assessUnassessedLogin: jest
              .fn()
              .mockResolvedValue({ pending: false }),
          },
        },
        {
          provide: ProfileOwnershipVerifier,
          useValue: profileOwnershipVerifier,
        },
        {
          provide: AccountDeletionFenceService,
          useValue: accountDeletionFence,
        },
        {
          provide: SaltedHashService,
          useValue: {
            validateHash: jest.fn((p, h, s) => Promise.resolve(true)),
            createNewHash: jest.fn((p) =>
              Promise.resolve({ hash: 'mockHash', salt: 'mockSalt' })
            ),
          },
        },
        PasswordPolicyService,
        {
          provide: KeyService,
          useValue: {
            generateUserKeys: jest.fn().mockResolvedValue({
              pubKey: 'mockPubKey',
              privLocation: 'mockPrivLocation',
            }),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: 'totp',
          useValue: {
            check: jest.fn().mockReturnValue(true),
            generateSecret: jest.fn().mockReturnValue('test-secret'),
            keyuri: jest.fn().mockReturnValue('otpauth://totp/test'),
          },
        },
        {
          provide: MfaService,
          useFactory: (totp: any) => new MfaService(totp),
          inject: ['totp'],
        },
        {
          provide: TokenIssuerService,
          useFactory: (jwtService: JwtService) =>
            new TokenIssuerService(
              {
                sign: (payload, options) => jwtService.sign(payload, options),
              },
              'test-secret'
            ),
          inject: [JwtService],
        },
        {
          provide: 'JWT_SECRET',
          useValue: 'test-secret',
        },
        {
          provide: 'jwt',
          useValue: {
            verify: jest.fn().mockReturnValue({}),
            sign: jest.fn().mockReturnValue('mockToken'),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mockToken'),
            verify: jest.fn().mockReturnValue({}),
            verifyAsync: jest.fn().mockResolvedValue({
              userId: 'someUserId',
              email: 'test@example.com',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    userRepo = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity)
    );
    tokenRepo = module.get<Repository<TokenEntity>>(
      getRepositoryToken(TokenEntity)
    );
    keyRepo = module.get<Repository<KeyDatum>>(getRepositoryToken(KeyDatum));
    saltedHashService = module.get<SaltedHashService>(SaltedHashService);
    keyService = module.get<KeyService>(KeyService);
    authenticator = module.get('totp');
    jwtHandle = module.get('jwt');
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateToken application binding', () => {
    it('rejects a caller-supplied app scope that conflicts with the signed token', async () => {
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        userId: 'someUserId',
        appId: 'client-interface',
      });
      (tokenRepo.findOne as jest.Mock).mockResolvedValue({
        tokenData: 'signed-token',
        revoked: false,
      });

      await expect(
        service.validateToken('signed-token', 'local-hub')
      ).rejects.toThrow('Invalid token');
      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(
        (service as any).guardianPermissionService.assertAccountAccess
      ).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 'someUserId',
      email: 'test@example.com',
      password: 'hashedPassword',
      firstName: 'John',
      lastName: 'Doe',
      totpSecret: null,
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      keyData: { salt: 'someSalt' },
    };

    it('should successfully log in a user without MFA', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(true as any);
      jest.spyOn(tokenRepo, 'save').mockResolvedValue(undefined);
      const signSpy = jest
        .spyOn(jwtService, 'sign')
        .mockImplementation(() => 'mockToken' as any);

      const result = await service.login('Test@Example.com', 'password');
      expect(result).toEqual({
        message: 'Login successful',
        code: 0,
        data: { newToken: 'mockToken' },
      });
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['keyData'],
      });
      expect(saltedHashService.validateHash).toHaveBeenCalledWith(
        'password',
        'hashedPassword',
        'someSalt'
      );
      expect(signSpy).toHaveBeenCalled();
      expect(tokenRepo.save).toHaveBeenCalled();
    });

    it('issues a password session with the verifier returned selected profile', async () => {
      const profileId = 'b2222222-b222-4222-8222-b22222222222';
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(true as any);
      profileOwnershipVerifier.resolveSelection.mockResolvedValueOnce(
        profileId
      );
      const issueForUser = jest.spyOn(
        (service as any).tokenIssuerService,
        'issueForUser'
      );

      await service.login(
        'test@example.com',
        'password',
        undefined,
        profileId,
        'forgeofwill'
      );

      expect(profileOwnershipVerifier.resolveSelection).toHaveBeenCalledWith(
        'someUserId',
        profileId
      );
      expect(issueForUser).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'someUserId' }),
        profileId,
        'forgeofwill'
      );
      expect(tokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ profileId })
      );
    });

    it('does not mint or persist a selected-profile session when ownership is denied', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(true as any);
      const denied = new RpcException({
        code: 'SELECTED_PROFILE_OWNERSHIP_UNVERIFIED',
      });
      profileOwnershipVerifier.resolveSelection.mockRejectedValue(denied);
      const issueForUser = jest.spyOn(
        (service as any).tokenIssuerService,
        'issueForUser'
      );

      await expect(
        service.login(
          'test@example.com',
          'password',
          undefined,
          '22222222-2222-4222-8222-222222222222'
        )
      ).rejects.toBe(denied);
      expect(issueForUser).not.toHaveBeenCalled();
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('reports failed guardian email delivery without creating a session', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({
        ...mockUser,
        ageEligibilityStatus: 'unassessed',
      } as any);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(true as any);
      const guardianPermissions = (service as any).guardianPermissionService;
      guardianPermissions.assessUnassessedLogin.mockResolvedValue({
        pending: true,
        sent: false,
      });

      const result = await service.login(
        'test@example.com',
        'password',
        undefined,
        undefined,
        'client-interface',
        {
          dateOfBirth: '2010-01-01',
          guardianEmail: 'guardian@example.invalid',
          context: {
            appId: 'client-interface',
            appName: 'Optimistic Tanuki',
            uiBaseUrl: 'https://optimistic-tanuki.example',
            from: 'support@hopefulaspirationsindustries.com',
          },
        }
      );

      expect(result).toEqual({
        message: 'Guardian permission email could not be sent. Please retry.',
        data: { guardianConsentPending: true, guardianEmailSent: false },
      });
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('defers session creation after the account eligibility check', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({
        ...mockUser,
        ageEligibilityStatus: 'adult',
      } as any);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(true as any);
      const guardianPermissions = (service as any).guardianPermissionService;
      guardianPermissions.assertAccountAccess.mockResolvedValue(undefined);

      await expect(
        service.login(
          'test@example.com',
          'password',
          undefined,
          undefined,
          'client-interface',
          undefined,
          true
        )
      ).resolves.toEqual({
        message: 'Eligibility checked',
        code: 0,
        data: { eligibilityChecked: true },
      });

      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('keeps same-second sessions distinct and revokes only the logged-out session', async () => {
      const issuer = new TokenIssuerService(
        {
          sign: (payload, options) =>
            jwt.sign(payload, options.secret, {
              expiresIn: options.expiresIn,
            }),
        },
        'test-secret'
      );
      (service as any).tokenIssuerService = issuer;

      jest.spyOn(userRepo, 'findOne').mockImplementation(
        async () =>
          ({
            ...mockUser,
            keyData: { salt: 'someSalt' },
          } as any)
      );
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(true as any);
      const sessions: any[] = [];
      jest.spyOn(tokenRepo, 'save').mockImplementation(async (session) => {
        sessions.push(session);
        return session as any;
      });

      const first = await service.login('test@example.com', 'password');
      const second = await service.login('test@example.com', 'password');
      const firstToken = first.data.newToken;
      const secondToken = second.data.newToken;

      expect(firstToken).not.toBe(secondToken);
      expect(sessions).toHaveLength(2);

      jest
        .spyOn(tokenRepo, 'findOne')
        .mockImplementation(async ({ where }: any) =>
          sessions.find((session) => session.tokenData === where.tokenData)
        );
      await service.logout(firstToken);

      expect(sessions[0].revoked).toBe(true);
      expect(sessions[1].revoked).toBe(false);
    });

    it('should successfully log in a user with MFA', async () => {
      const userWithTotp = {
        ...mockUser,
        totpSecret: 'someTotpSecret',
        keyData: { salt: 'someSalt' },
      };
      jest
        .spyOn(userRepo, 'findOne')
        .mockResolvedValue(userWithTotp as UserEntity);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(true as boolean);
      jest.spyOn(authenticator, 'check').mockReturnValue(true as boolean);
      jest.spyOn(tokenRepo, 'save').mockResolvedValue(undefined);

      const result = await service.login(
        'test@example.com',
        'password',
        '123456'
      );
      expect(result).toEqual({
        message: 'Login successful',
        code: 0,
        data: { newToken: 'mockToken' },
      });
      expect(authenticator.check).toHaveBeenCalledWith(
        '123456',
        'someTotpSecret'
      );
    });

    it('rejects password login until platform email verification completes', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({
        ...mockUser,
        emailVerifiedAt: null,
      } as UserEntity);

      await expectRpcError(
        service.login('test@example.com', 'password'),
        'EMAIL_VERIFICATION_REQUIRED'
      );
      expect(saltedHashService.validateHash).not.toHaveBeenCalled();
    });

    it('verifies an existing development seed user before password login', async () => {
      const unverifiedUser = {
        ...mockUser,
        emailVerifiedAt: null,
      } as UserEntity;
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string) =>
          key === 'AUTH_AUTO_VERIFY_EMAILS' ? 'true' : undefined
        );
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(unverifiedUser);
      jest.spyOn(userRepo, 'save').mockResolvedValue(unverifiedUser);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(true as any);
      jest.spyOn(tokenRepo, 'save').mockResolvedValue(undefined);

      await service.login('test@example.com', 'password');

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerifiedAt: expect.any(Date) })
      );
    });

    it('records a failed attempt without locking below the threshold', async () => {
      jest
        .spyOn(userRepo, 'findOne')
        .mockResolvedValue({ ...mockUser, failedLoginCount: 1 } as any);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(false as any);
      const updateSpy = jest
        .spyOn(userRepo, 'update')
        .mockResolvedValue(undefined as any);

      await expectRpcError(
        service.login('test@example.com', 'wrong'),
        'Invalid password'
      );

      expect(updateSpy).toHaveBeenCalledWith('someUserId', {
        failedLoginCount: 2,
      });
    });

    it('locks the account after too many failed password attempts', async () => {
      jest
        .spyOn(userRepo, 'findOne')
        .mockResolvedValue({ ...mockUser, failedLoginCount: 4 } as any);
      jest
        .spyOn(saltedHashService, 'validateHash')
        .mockReturnValue(false as any);
      const updateSpy = jest
        .spyOn(userRepo, 'update')
        .mockResolvedValue(undefined as any);

      await expectRpcError(
        service.login('test@example.com', 'wrong'),
        'Invalid password'
      );

      expect(updateSpy).toHaveBeenCalledWith(
        'someUserId',
        expect.objectContaining({
          failedLoginCount: 0,
          lockedUntil: expect.any(Date),
        })
      );
    });

    it('rejects login while the account is locked', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60_000);
      jest
        .spyOn(userRepo, 'findOne')
        .mockResolvedValue({ ...mockUser, lockedUntil } as any);
      const validateSpy = jest.spyOn(saltedHashService, 'validateHash');

      let rejected: unknown;
      try {
        await service.login('test@example.com', 'password');
      } catch (error) {
        rejected = error;
      }

      expect(rejected).toBeInstanceOf(RpcException);
      expect((rejected as RpcException).message).toContain('ACCOUNT_LOCKED');
      expect(validateSpy).not.toHaveBeenCalled();
    });
  });

  describe('registerUser', () => {
    it('marks development seed registrations as email verified', async () => {
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string) =>
          key === 'AUTH_AUTO_VERIFY_EMAILS' ? 'true' : undefined
        );
      jest
        .spyOn(userRepo, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'new-user' } as UserEntity);
      jest.spyOn(userRepo, 'insert').mockResolvedValue({
        identifiers: [{ id: 'new-user' }],
      } as any);
      jest
        .spyOn(keyRepo, 'save')
        .mockResolvedValue({ id: 'key-1' } as KeyDatum);
      jest
        .spyOn(userRepo, 'save')
        .mockResolvedValue({ id: 'new-user' } as UserEntity);

      await service.registerUser(
        'seed@example.test',
        'Seed',
        'User',
        'Password123!',
        'Password123!'
      );

      expect(userRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'seed@example.test',
          emailVerifiedAt: expect.any(Date),
        })
      );
    });

    it('reconciles an existing bootstrap owner without resetting its password', async () => {
      const existingOwner = {
        id: 'owner-1',
        email: 'owner@example.test',
        emailVerifiedAt: null,
      } as UserEntity;
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(existingOwner);
      const registerUser = jest.spyOn(service, 'registerUser');

      await expect(
        service.bootstrapOwner(
          'OWNER@example.test',
          'Owner',
          'Operator',
          'new-password'
        )
      ).resolves.toEqual({ created: false, user: existingOwner });

      expect(registerUser).not.toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({
          firstName: 'Owner',
          lastName: 'Operator',
          emailVerifiedAt: expect.any(Date),
        })
      );
    });
  });

  describe('issueToken', () => {
    it('does not mint or persist a session for a fenced account', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: 'someUserId',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      } as any);
      const denied = new RpcException('ACCOUNT_DELETION_FENCED');
      accountDeletionFence.assertActiveAccount.mockRejectedValue(denied);
      const issueForUser = jest.spyOn(
        (service as any).tokenIssuerService,
        'issueForUser'
      );

      await expect(service.issueToken('someUserId')).rejects.toBe(denied);
      expect(issueForUser).not.toHaveBeenCalled();
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('persists the profileId with issued app-scoped sessions', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: 'someUserId',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
        keyData: { salt: 'someSalt' },
        password: 'hashedPassword',
      } as any);
      jest.spyOn(tokenRepo, 'save').mockResolvedValue(undefined);

      const profileId = 'b2222222-b222-4222-8222-b22222222222';
      const result = await service.issueToken('someUserId', profileId);

      expect(result).toEqual({
        message: 'Issued token',
        code: 0,
        data: { newToken: 'mockToken' },
      });
      expect(tokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ profileId })
      );
    });

    it('does not mint or persist a selected-profile session when ownership is denied', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: 'someUserId',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      } as any);
      const denied = new RpcException({
        code: 'SELECTED_PROFILE_OWNERSHIP_UNVERIFIED',
      });
      profileOwnershipVerifier.resolveSelection.mockRejectedValue(denied);
      const issueForUser = jest.spyOn(
        (service as any).tokenIssuerService,
        'issueForUser'
      );

      await expect(
        service.issueToken('someUserId', '22222222-2222-4222-8222-222222222222')
      ).rejects.toBe(denied);
      expect(issueForUser).not.toHaveBeenCalled();
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });
  });
});
