import * as qrcode from 'qrcode';

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import {
  MfaService,
  PasswordPolicyService,
  TokenIssuerService,
} from '@optimistic-tanuki/auth-domain';
import { SaltedHashService } from '@optimistic-tanuki/encryption';
import { EmailService } from '@optimistic-tanuki/email';

import { AppService } from './app.service';
import { KeyService } from './key.service';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { UserEntity } from '../user/entities/user.entity';

// The service builds the QR payload but the encoder itself is irrelevant here;
// stubbing it keeps the assertions on the otpauth URI that gets encoded.
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,qr')),
}));

// TS4111: index-signature access is disallowed, so every mock gets a named shape.
interface UserRepoMock {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
}

interface TokenRepoMock {
  findOne: jest.Mock;
  save: jest.Mock;
}

interface KeyRepoMock {
  save: jest.Mock;
}

interface KeyServiceMock {
  generateUserKeys: jest.Mock;
}

interface EmailServiceMock {
  sendEmail: jest.Mock;
}

interface JwtServiceMock {
  sign: jest.Mock;
  verifyAsync: jest.Mock;
}

interface TotpMock {
  check: jest.Mock;
  keyuri: jest.Mock;
  generateSecret: jest.Mock;
}

interface ConfigServiceMock {
  get: jest.Mock;
}

const PASSWORD = 'Password123!';
const NEW_PASSWORD = 'NewPassword456!';

/**
 * Asserts the promise rejects with an RpcException carrying exactly `message`.
 * `rejects.toThrow` compares loosely, and the refusal text is the contract the
 * gateway relays to callers, so it is compared exactly.
 */
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

describe('AppService flows', () => {
  let service: AppService;
  let userRepo: UserRepoMock;
  let tokenRepo: TokenRepoMock;
  let keyRepo: KeyRepoMock;
  let keyService: KeyServiceMock;
  let emailService: EmailServiceMock;
  let jwtService: JwtServiceMock;
  let totp: TotpMock;
  let configService: ConfigServiceMock;
  let saltedHashService: SaltedHashService;

  // The real hash service is cheap (hmac-sha512), so credentials are produced
  // and verified for real instead of being stubbed to a fixed boolean.
  const hashing = new SaltedHashService();

  const buildUser = (overrides: Partial<UserEntity> = {}): UserEntity => {
    const credentials = hashing.createNewHash(PASSWORD);
    return {
      id: 'user-1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      bio: '',
      password: credentials.hash,
      totpSecret: null,
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      failedLoginCount: 0,
      lockedUntil: null,
      keyData: { salt: credentials.salt } as KeyDatum,
    } as unknown as UserEntity;
  };

  beforeEach(async () => {
    userRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn(),
    };
    tokenRepo = { findOne: jest.fn(), save: jest.fn().mockResolvedValue({}) };
    keyRepo = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    keyService = {
      generateUserKeys: jest.fn().mockResolvedValue({
        pubKey: 'mockPubKey',
        privLocation: '/keys/user-1.pem',
      }),
    };
    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verifyAsync: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    totp = {
      check: jest.fn().mockReturnValue(true),
      keyuri: jest.fn(),
      generateSecret: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    (qrcode.toDataURL as jest.Mock).mockClear();

    // The service logs failures through console as well as the Nest logger;
    // muting console keeps the deliberate failure-path runs readable.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'trace').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Logger,
        AppService,
        SaltedHashService,
        PasswordPolicyService,
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: getRepositoryToken(TokenEntity), useValue: tokenRepo },
        { provide: getRepositoryToken(KeyDatum), useValue: keyRepo },
        { provide: KeyService, useValue: keyService },
        { provide: EmailService, useValue: emailService },
        { provide: JwtService, useValue: jwtService },
        { provide: 'JWT_SECRET', useValue: 'test-secret' },
        { provide: 'totp', useValue: totp },
        {
          provide: MfaService,
          useFactory: (t: TotpMock) => new MfaService(t),
          inject: ['totp'],
        },
        {
          provide: TokenIssuerService,
          useFactory: (jwt: JwtService) =>
            new TokenIssuerService(
              { sign: (payload, options) => jwt.sign(payload, options) },
              'test-secret'
            ),
          inject: [JwtService],
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    saltedHashService = module.get<SaltedHashService>(SaltedHashService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getAllUsersForNotifications', () => {
    it('projects only id and email so hashes never reach the notifier', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'u1', email: 'a@example.com', password: 'hash-a' },
        { id: 'u2', email: 'b@example.com', password: 'hash-b' },
      ]);

      await expect(service.getAllUsersForNotifications()).resolves.toEqual([
        { id: 'u1', email: 'a@example.com' },
        { id: 'u2', email: 'b@example.com' },
      ]);
      expect(userRepo.find).toHaveBeenCalledWith({ select: ['id', 'email'] });
    });
  });

  describe('getUsersByIdsForNotifications', () => {
    it('de-duplicates and drops empty ids before querying', async () => {
      userRepo.find.mockResolvedValue([
        { id: 'u1', email: 'a@example.com', password: 'hash-a' },
      ]);

      const result = await service.getUsersByIdsForNotifications([
        'u1',
        'u1',
        '',
        'u2',
      ]);

      expect(userRepo.find).toHaveBeenCalledWith({
        where: { id: In(['u1', 'u2']) },
        select: ['id', 'email'],
      });
      expect(result).toEqual([{ id: 'u1', email: 'a@example.com' }]);
    });

    it('caps the batch at 100 ids', async () => {
      userRepo.find.mockResolvedValue([]);
      const ids = Array.from({ length: 150 }, (_, index) => `u${index}`);

      await service.getUsersByIdsForNotifications(ids);

      const where = userRepo.find.mock.calls[0][0].where as {
        id: { value: string[] };
      };
      expect(where.id.value).toHaveLength(100);
      expect(where.id.value[99]).toBe('u99');
    });

    it('returns an empty list without touching the repository', async () => {
      await expect(
        service.getUsersByIdsForNotifications(['', undefined as never])
      ).resolves.toEqual([]);
      expect(userRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('getUserIdFromEmail', () => {
    it('normalizes the address before lookup and returns the id', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.getUserIdFromEmail('  Jane@Example.COM ')
      ).resolves.toBe('user-1');
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'jane@example.com' },
      });
    });

    it('refuses unknown addresses', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expectRpcError(
        service.getUserIdFromEmail('nobody@example.com'),
        'User not found'
      );
    });

    it('wraps a repository failure in an RpcException', async () => {
      userRepo.findOne.mockRejectedValue(new Error('connection reset'));

      await expectRpcError(
        service.getUserIdFromEmail('jane@example.com'),
        'connection reset'
      );
    });
  });

  describe('bootstrapOwner', () => {
    it('registers a new owner and force-verifies the address', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null) // bootstrapOwner existence probe
        .mockResolvedValueOnce(null) // registerUser duplicate probe
        .mockResolvedValueOnce({ id: 'owner-1', email: 'owner@example.com' });
      userRepo.insert.mockResolvedValue({ identifiers: [{ id: 'owner-1' }] });
      keyRepo.save.mockResolvedValue({ id: 'key-1', salt: 'persisted-salt' });

      const result = await service.bootstrapOwner(
        'Owner@Example.com',
        'Owen',
        'Ner',
        PASSWORD
      );

      expect(result.created).toBe(true);
      expect(result.user).toEqual(expect.objectContaining({ id: 'owner-1' }));
      expect(userRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'owner@example.com',
          bio: 'Platform owner',
        })
      );
      expect(userRepo.update).toHaveBeenCalledWith('owner-1', {
        emailVerifiedAt: expect.any(Date),
      });
    });
  });

  describe('login', () => {
    it('signs a session for valid credentials and strips secrets from the token row', async () => {
      const user = buildUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.login(
        'Jane@Example.com',
        PASSWORD,
        undefined,
        'profile-1'
      );

      expect(result).toEqual({
        message: 'Login successful',
        code: 0,
        data: { newToken: 'signed-token' },
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          profileId: 'profile-1',
        },
        { secret: 'test-secret', expiresIn: '1h' }
      );

      const savedToken = tokenRepo.save.mock.calls[0][0];
      expect(savedToken).toEqual(
        expect.objectContaining({
          tokenData: 'signed-token',
          userId: 'user-1',
          revoked: false,
          profileId: 'profile-1',
        })
      );
      expect(savedToken.user.password).toBeUndefined();
      expect(savedToken.user.keyData).toBeUndefined();
    });

    it('refuses an unknown address', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expectRpcError(
        service.login('nobody@example.com', PASSWORD),
        'User not found'
      );
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a wrong password against the stored salt', async () => {
      userRepo.findOne.mockResolvedValue(buildUser({}));

      await expectRpcError(
        service.login('jane@example.com', 'Wrong-Password1!'),
        'Invalid password'
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('demands an MFA token and counts the omission as a failed attempt', async () => {
      const user = buildUser();
      user.totpSecret = 'totp-secret';
      user.failedLoginCount = 1;
      userRepo.findOne.mockResolvedValue(user);

      await expectRpcError(
        service.login('jane@example.com', PASSWORD),
        'MFA token is required for this user.'
      );
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        failedLoginCount: 2,
      });
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('refuses an incorrect MFA token', async () => {
      const user = buildUser();
      user.totpSecret = 'totp-secret';
      userRepo.findOne.mockResolvedValue(user);
      totp.check.mockReturnValue(false);

      await expectRpcError(
        service.login('jane@example.com', PASSWORD, '000000'),
        'Invalid MFA token'
      );
      expect(totp.check).toHaveBeenCalledWith('000000', 'totp-secret');
    });

    it('clears the failure counters once a login succeeds', async () => {
      const user = buildUser();
      user.failedLoginCount = 3;
      user.lockedUntil = new Date('2020-01-01T00:00:00.000Z');
      userRepo.findOne.mockResolvedValue(user);

      await service.login('jane@example.com', PASSWORD);

      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        failedLoginCount: 0,
        lockedUntil: null,
      });
    });

    it('leaves a clean account untouched on a successful login', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());

      await service.login('jane@example.com', PASSWORD);

      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('locks the account for the configured window on the configured attempt', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
      configService.get.mockImplementation((key: string) => {
        if (key === 'AUTH_MAX_FAILED_LOGINS') return '3';
        if (key === 'AUTH_LOCKOUT_MINUTES') return '30';
        return undefined;
      });
      const user = buildUser();
      user.failedLoginCount = 2;
      userRepo.findOne.mockResolvedValue(user);

      await expectRpcError(
        service.login('jane@example.com', 'Wrong-Password1!'),
        'Invalid password'
      );

      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        failedLoginCount: 0,
        lockedUntil: new Date('2026-05-01T12:30:00.000Z'),
      });
    });

    it('reports the remaining lockout window and never checks the password', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
      const user = buildUser();
      user.lockedUntil = new Date('2026-05-01T12:07:00.000Z');
      userRepo.findOne.mockResolvedValue(user);
      const validateSpy = jest.spyOn(saltedHashService, 'validateHash');

      await expectRpcError(
        service.login('jane@example.com', PASSWORD),
        'ACCOUNT_LOCKED: Too many failed login attempts. Try again in 7 minute(s).'
      );
      expect(validateSpy).not.toHaveBeenCalled();
    });

    it('lets a login through once the lockout window has elapsed', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
      const user = buildUser();
      user.lockedUntil = new Date('2026-05-01T11:59:00.000Z');
      userRepo.findOne.mockResolvedValue(user);

      await expect(
        service.login('jane@example.com', PASSWORD)
      ).resolves.toEqual(
        expect.objectContaining({ message: 'Login successful' })
      );
    });

    it('rejects an unverified address unless auto-verification is enabled', async () => {
      const user = buildUser();
      user.emailVerifiedAt = null;
      userRepo.findOne.mockResolvedValue(user);

      await expectRpcError(
        service.login('jane@example.com', PASSWORD),
        'EMAIL_VERIFICATION_REQUIRED'
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('surfaces an unexpected persistence failure as an RpcException', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      tokenRepo.save.mockRejectedValue(new Error('token table offline'));

      await expectRpcError(
        service.login('jane@example.com', PASSWORD),
        'token table offline'
      );
    });
  });

  describe('registerUser', () => {
    const validationCases: Array<{
      name: string;
      args: [string, string, string, string, string];
      message: string;
    }> = [
      {
        name: 'a non-string password',
        args: ['jane@example.com', 'Jane', 'Doe', undefined as never, PASSWORD],
        message: 'Invalid data',
      },
      {
        name: 'a mismatched confirmation',
        args: ['jane@example.com', 'Jane', 'Doe', PASSWORD, 'Different123!'],
        message: 'Passwords do not match',
      },
      {
        name: 'a password that fails the strength policy',
        args: ['jane@example.com', 'Jane', 'Doe', 'short', 'short'],
        message: 'Password is too weak',
      },
      {
        name: 'a malformed email address',
        args: ['not-an-email', 'Jane', 'Doe', PASSWORD, PASSWORD],
        message: 'Invalid Email not-an-email',
      },
      {
        name: 'a missing first name',
        args: ['jane@example.com', '', 'Doe', PASSWORD, PASSWORD],
        message: 'First Name is required',
      },
      {
        name: 'a missing last name',
        args: ['jane@example.com', 'Jane', '', PASSWORD, PASSWORD],
        message: 'Last Name is required',
      },
    ];

    it.each(validationCases)(
      'refuses registration for $name',
      async ({ args, message }) => {
        await expectRpcError(service.registerUser(...args), message);
        expect(userRepo.insert).not.toHaveBeenCalled();
      }
    );

    it('refuses to re-register an existing address', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1' });

      await expectRpcError(
        service.registerUser(
          'Jane@Example.com',
          'Jane',
          'Doe',
          PASSWORD,
          PASSWORD
        ),
        'User already exists'
      );
      expect(userRepo.insert).not.toHaveBeenCalled();
    });

    it('aborts when the hash service yields nothing', async () => {
      userRepo.findOne.mockResolvedValue(null);
      jest
        .spyOn(saltedHashService, 'createNewHash')
        .mockReturnValue(undefined as never);

      await expectRpcError(
        service.registerUser(
          'jane@example.com',
          'Jane',
          'Doe',
          PASSWORD,
          PASSWORD
        ),
        'Error creating hash'
      );
      expect(userRepo.insert).not.toHaveBeenCalled();
    });

    it('aborts when the freshly inserted row cannot be read back', async () => {
      userRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      userRepo.insert.mockResolvedValue({ identifiers: [{ id: 'user-9' }] });

      await expectRpcError(
        service.registerUser(
          'jane@example.com',
          'Jane',
          'Doe',
          PASSWORD,
          PASSWORD
        ),
        'Error retrieving new user'
      );
      expect(keyService.generateUserKeys).not.toHaveBeenCalled();
    });

    it('persists a hash that verifies against the persisted salt', async () => {
      const newUser = { id: 'user-9', email: 'jane@example.com' };
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newUser);
      userRepo.insert.mockResolvedValue({ identifiers: [{ id: 'user-9' }] });
      keyRepo.save.mockResolvedValue({ id: 'key-9', salt: 'stored-salt' });

      const result = await service.registerUser(
        ' Jane@Example.com ',
        'Jane',
        'Doe',
        PASSWORD,
        PASSWORD,
        'Hello'
      );

      const inserted = userRepo.insert.mock.calls[0][0];
      expect(inserted.email).toBe('jane@example.com');
      expect(inserted.bio).toBe('Hello');
      expect(inserted.emailVerifiedAt).toBeNull();
      expect(
        hashing.validateHash(PASSWORD, inserted.password, inserted.keyData.salt)
      ).toBe(true);

      // The private key is derived from the stored hash, not the raw password.
      expect(keyService.generateUserKeys).toHaveBeenCalledWith(
        'user-9',
        inserted.password
      );
      expect(keyRepo.save).toHaveBeenCalledWith({
        public: Buffer.from('mockPubKey'),
        salt: inserted.keyData.salt,
      });
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-9',
          keyData: { id: 'key-9', salt: 'stored-salt' },
        })
      );
      expect(result).toEqual({
        message: 'User Created',
        code: 0,
        data: {
          pub: 'mockPubKey',
          user: expect.objectContaining({ id: 'user-9' }),
          privKey: '/keys/user-1.pem',
          inventory: undefined,
        },
      });
    });
  });

  describe('resetPassword', () => {
    it('refuses a weak replacement password before reading the account', async () => {
      await expectRpcError(
        service.resetPassword('jane@example.com', 'weak', 'weak', PASSWORD),
        'Password is too weak'
      );
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('refuses a mismatched confirmation', async () => {
      await expectRpcError(
        service.resetPassword(
          'jane@example.com',
          NEW_PASSWORD,
          'Other-Password9!',
          PASSWORD
        ),
        'Passwords do not match'
      );
    });

    it('refuses an unknown account', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expectRpcError(
        service.resetPassword(
          'jane@example.com',
          NEW_PASSWORD,
          NEW_PASSWORD,
          PASSWORD
        ),
        'User not found'
      );
    });

    it('refuses an account with no key material', async () => {
      const user = buildUser();
      user.keyData = undefined as never;
      userRepo.findOne.mockResolvedValue(user);

      await expectRpcError(
        service.resetPassword(
          'jane@example.com',
          NEW_PASSWORD,
          NEW_PASSWORD,
          PASSWORD
        ),
        'User not found'
      );
    });

    it('refuses an incorrect current password', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());

      await expectRpcError(
        service.resetPassword(
          'jane@example.com',
          NEW_PASSWORD,
          NEW_PASSWORD,
          'Wrong-Password1!'
        ),
        'Invalid old password'
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('refuses when the MFA token is missing on an MFA-enrolled account', async () => {
      const user = buildUser();
      user.totpSecret = 'totp-secret';
      userRepo.findOne.mockResolvedValue(user);

      await expectRpcError(
        service.resetPassword(
          'jane@example.com',
          NEW_PASSWORD,
          NEW_PASSWORD,
          PASSWORD
        ),
        'MFA token is required for this user.'
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('refuses an invalid MFA token', async () => {
      const user = buildUser();
      user.totpSecret = 'totp-secret';
      userRepo.findOne.mockResolvedValue(user);
      totp.check.mockReturnValue(false);

      await expectRpcError(
        service.resetPassword(
          'jane@example.com',
          NEW_PASSWORD,
          NEW_PASSWORD,
          PASSWORD,
          '000000'
        ),
        'Invalid MFA token'
      );
    });

    it('re-salts and re-hashes so the new password verifies', async () => {
      const user = buildUser();
      const previousHash = user.password;
      const previousSalt = user.keyData.salt;
      userRepo.findOne.mockResolvedValue(user);

      await expect(
        service.resetPassword(
          ' Jane@Example.com ',
          NEW_PASSWORD,
          NEW_PASSWORD,
          PASSWORD
        )
      ).resolves.toEqual({ message: 'Password reset successful', code: 0 });

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'jane@example.com' },
        relations: ['keyData'],
      });
      const saved = userRepo.save.mock.calls[0][0];
      expect(saved.password).not.toBe(previousHash);
      expect(saved.keyData.salt).not.toBe(previousSalt);
      expect(
        hashing.validateHash(NEW_PASSWORD, saved.password, saved.keyData.salt)
      ).toBe(true);
      expect(
        hashing.validateHash(PASSWORD, saved.password, saved.keyData.salt)
      ).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('accepts a signed token backed by a live row', async () => {
      jwtService.verifyAsync.mockResolvedValue({ userId: 'user-1' });
      tokenRepo.findOne.mockResolvedValue({ tokenData: 'tk', revoked: false });

      await expect(service.validateToken('tk')).resolves.toEqual({
        message: 'Token is valid',
        code: 0,
        data: { userId: 'user-1' },
        isValid: true,
      });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('tk', {
        secret: 'test-secret',
      });
      expect(tokenRepo.findOne).toHaveBeenCalledWith({
        where: { tokenData: 'tk' },
      });
    });

    it('rejects a token whose signature does not verify', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expectRpcError(service.validateToken('tk'), 'Invalid token');
      expect(tokenRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects a well-signed token that has no stored row', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      await expectRpcError(service.validateToken('tk'), 'Invalid token');
    });

    it('rejects a revoked token even though the signature is intact', async () => {
      tokenRepo.findOne.mockResolvedValue({ tokenData: 'tk', revoked: true });

      await expectRpcError(service.validateToken('tk'), 'Invalid token');
    });

    it('rejects an empty verification payload', async () => {
      jwtService.verifyAsync.mockResolvedValue(null);

      await expectRpcError(service.validateToken('tk'), 'Invalid token');
      expect(tokenRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('setupTotp', () => {
    it('stores a fresh secret and encodes it into the otpauth URI', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        totpSecret: null,
      });

      const result = await service.setupTotp('user-1');

      const patch = userRepo.update.mock.calls[0][1] as { totpSecret: string };
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        totpSecret: expect.stringMatching(/^[0-9a-f]{40}$/),
      });

      const uri = (qrcode.toDataURL as jest.Mock).mock.calls[0][0] as string;
      expect(uri).toContain('otpauth://totp/optomistic-tanuki:user-1');
      expect(uri).toContain(`secret=${patch.totpSecret}`);
      expect(result.message).toBe('TOTP setup successful');
      expect(result.code).toBe(0);
    });

    it('never reuses the same secret across setups', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        totpSecret: null,
      });

      await service.setupTotp('user-1');
      await service.setupTotp('user-1');

      const first = userRepo.update.mock.calls[0][1] as { totpSecret: string };
      const second = userRepo.update.mock.calls[1][1] as { totpSecret: string };
      expect(first.totpSecret).not.toBe(second.totpSecret);
    });

    it('sends a security-toned confirmation from the configured sender domain', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'SMTP_FROM' ? 'no-reply@christopherrutherford.net' : undefined
      );
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        totpSecret: null,
      });

      await service.setupTotp('user-1');

      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      const message = emailService.sendEmail.mock.calls[0][0];
      expect(message.to).toBe('jane@example.com');
      expect(message.subject).toBe('Multi-Factor Authentication Enabled');
      expect(message.text).toContain('Hello Jane,');
      expect(message.text).toContain(
        'If you did not initiate this, please contact support immediately.'
      );
      expect(message.text).toContain('christopherrutherford.net');
      // 'security' tone renders the accent bar red.
      expect(message.html).toContain('#b91c1c');
    });

    it('refuses to re-enrol an account that already has a secret', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        totpSecret: 'existing',
      });

      await expectRpcError(
        service.setupTotp('user-1'),
        'TOTP setup failed: TOTP already set up'
      );
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('refuses an unknown account', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expectRpcError(
        service.setupTotp('ghost'),
        'TOTP setup failed: User not found'
      );
    });

    it('reports a mail failure after the secret has already been stored', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        totpSecret: null,
      });
      emailService.sendEmail.mockRejectedValue(new Error('smtp unreachable'));

      await expectRpcError(
        service.setupTotp('user-1'),
        'TOTP setup failed: smtp unreachable'
      );
      expect(userRepo.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateTotp', () => {
    it('accepts a token that matches the enrolled secret', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        totpSecret: 'totp-secret',
      });

      await expect(service.validateTotp('user-1', '123456')).resolves.toEqual({
        message: 'TOTP token is valid',
        code: 0,
      });
      expect(totp.check).toHaveBeenCalledWith('123456', 'totp-secret');
    });

    it('rejects a token that does not match', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        totpSecret: 'totp-secret',
      });
      totp.check.mockReturnValue(false);

      await expectRpcError(
        service.validateTotp('user-1', '000000'),
        'Invalid TOTP token'
      );
    });

    it.each([
      ['an unknown account', null],
      ['an account without TOTP enrolment', { id: 'user-1', totpSecret: null }],
    ])('refuses %s', async (_name, row) => {
      userRepo.findOne.mockResolvedValue(row);

      await expectRpcError(
        service.validateTotp('user-1', '123456'),
        'User not found or TOTP not set up'
      );
      expect(totp.check).not.toHaveBeenCalled();
    });
  });

  describe('sendMfaSetupEmail', () => {
    it('mails the enrolment prompt and reports the transport result', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
      });

      await expect(service.sendMfaSetupEmail('user-1')).resolves.toEqual({
        message: 'MFA setup email sent',
        code: 0,
        data: { sent: true },
      });
      const message = emailService.sendEmail.mock.calls[0][0];
      expect(message.to).toBe('jane@example.com');
      expect(message.subject).toBe('Multi-Factor Authentication Setup');
      expect(message.text).toContain(
        'If you did not request this, please secure your account immediately.'
      );
    });

    it('passes a failed send through to the caller', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
      });
      emailService.sendEmail.mockResolvedValue({ success: false });

      await expect(service.sendMfaSetupEmail('user-1')).resolves.toEqual(
        expect.objectContaining({ data: { sent: false } })
      );
    });

    it('refuses an unknown account without mailing anyone', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expectRpcError(
        service.sendMfaSetupEmail('ghost'),
        'User not found'
      );
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('wraps a transport failure', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
      });
      emailService.sendEmail.mockRejectedValue(new Error('smtp unreachable'));

      await expectRpcError(
        service.sendMfaSetupEmail('user-1'),
        'smtp unreachable'
      );
    });
  });

  describe('sendMfaVerificationEmail', () => {
    it('names the action that triggered the verification', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
      });

      await expect(
        service.sendMfaVerificationEmail('user-1', 'password change')
      ).resolves.toEqual({
        message: 'MFA verification email sent',
        code: 0,
        data: { sent: true },
      });
      const message = emailService.sendEmail.mock.calls[0][0];
      expect(message.subject).toBe('Security Alert: MFA Verification');
      expect(message.text).toContain(
        'A multi-factor authentication verification was performed on your account for: password change.'
      );
    });

    it('falls back to an empty greeting when no first name is stored', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: '',
      });

      await service.sendMfaVerificationEmail('user-1', 'login');

      expect(emailService.sendEmail.mock.calls[0][0].text).toContain('Hello ,');
    });

    it('refuses an unknown account', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expectRpcError(
        service.sendMfaVerificationEmail('ghost', 'login'),
        'User not found'
      );
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('wraps a transport failure', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
      });
      emailService.sendEmail.mockRejectedValue(new Error('smtp unreachable'));

      await expectRpcError(
        service.sendMfaVerificationEmail('user-1', 'login'),
        'smtp unreachable'
      );
    });
  });

  describe('issueToken', () => {
    it('refuses an unknown account', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expectRpcError(service.issueToken('ghost'), 'User not found');
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('refuses to issue a session for an unverified address', async () => {
      const user = buildUser();
      user.emailVerifiedAt = null;
      userRepo.findOne.mockResolvedValue(user);

      await expectRpcError(
        service.issueToken('user-1'),
        'EMAIL_VERIFICATION_REQUIRED'
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('stores a null profileId when none is supplied', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());

      await expect(service.issueToken('user-1')).resolves.toEqual({
        message: 'Issued token',
        code: 0,
        data: { newToken: 'signed-token' },
      });
      expect(tokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: null })
      );
    });

    it('wraps a persistence failure', async () => {
      userRepo.findOne.mockResolvedValue(buildUser());
      tokenRepo.save.mockRejectedValue(new Error('token table offline'));

      await expectRpcError(service.issueToken('user-1'), 'token table offline');
    });
  });

  describe('logout', () => {
    it('revokes a live token', async () => {
      const stored = { id: 'tok-1', tokenData: 'tk', revoked: false };
      tokenRepo.findOne.mockResolvedValue(stored);

      await expect(service.logout('tk')).resolves.toEqual({
        message: 'Logged out',
        code: 0,
      });
      expect(tokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tok-1', revoked: true })
      );
    });

    it('succeeds idempotently for a token that is already gone', async () => {
      tokenRepo.findOne.mockResolvedValue(null);

      await expect(service.logout('tk')).resolves.toEqual({
        message: 'Logged out',
        code: 0,
      });
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('wraps a persistence failure', async () => {
      tokenRepo.findOne.mockRejectedValue(new Error('token table offline'));

      await expectRpcError(service.logout('tk'), 'token table offline');
    });
  });

  describe('getPublicOAuthConfig', () => {
    it('omits providers that are disabled, unconfigured or absent', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'oauth.google') {
          return {
            enabled: true,
            clientId: 'google-client',
            clientSecret: 'google-secret',
            redirectUri: 'https://example.com/google',
            scopes: ['openid'],
            authorizationEndpoint: 'https://accounts.google.com/auth',
          };
        }
        if (key === 'oauth.github') {
          return { enabled: false, clientId: 'github-client' };
        }
        if (key === 'oauth.microsoft') {
          return { enabled: true, clientId: '' };
        }
        return undefined;
      });

      const result = service.getPublicOAuthConfig();

      expect(Object.keys(result)).toEqual(['google']);
      expect(result.google).toEqual({
        clientId: 'google-client',
        redirectUri: 'https://example.com/google',
        scopes: ['openid'],
        authorizationEndpoint: 'https://accounts.google.com/auth',
        enabled: true,
      });
      // The secret must never cross the wire to a public consumer.
      expect(JSON.stringify(result)).not.toContain('google-secret');
    });

    it('ignores per-domain overrides for a domain that has no entry', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'oauth.apps') {
          return [{ domain: 'other.example.com', google: { enabled: false } }];
        }
        if (key === 'oauth.google') {
          return { enabled: true, clientId: 'google-client' };
        }
        return undefined;
      });

      expect(service.getPublicOAuthConfig('unknown.example.com')).toEqual({
        google: {
          clientId: 'google-client',
          redirectUri: undefined,
          scopes: undefined,
          authorizationEndpoint: undefined,
          enabled: true,
        },
      });
    });
  });
});
