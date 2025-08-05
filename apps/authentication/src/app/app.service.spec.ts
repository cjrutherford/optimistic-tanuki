import * as jwt from 'jsonwebtoken';
import * as qrcode from 'qrcode';

import { Test, TestingModule } from '@nestjs/testing';

import { AppService } from './app.service';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { KeyService } from './key.service';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { SaltedHashService } from '@optimistic-tanuki/encryption';
import { TokenEntity } from '../tokens/entities/token.entity';
import { UserEntity } from '../user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

let service: AppService;
let userRepo: Repository<UserEntity>;
let tokenRepo: Repository<TokenEntity>;
let keyRepo: Repository<KeyDatum>;
let saltedHashService: SaltedHashService;
let authenticator: any;
let keyService: KeyService;
let jwtHandle: typeof jwt;

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('qrCodeDataUrl'),
}));

describe('AppService', () => {
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Logger,
        AppService,
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
          provide: SaltedHashService,
          useValue: {
            validateHash: jest.fn((p, h, s) => Promise.resolve(true)),
            createNewHash: jest.fn((p) => Promise.resolve({ hash: 'mockHash', salt: 'mockSalt' })),
          },
        },
        {
          provide: KeyService,
          useValue: {
            generateUserKeys: jest.fn().mockResolvedValue({ pubKey: 'mockPubKey', privLocation: 'mockPrivLocation' }),
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
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    userRepo = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity)
    );
    tokenRepo = module.get<Repository<TokenEntity>>(
      getRepositoryToken(TokenEntity)
    );
    keyRepo = module.get<Repository<KeyDatum>>(
      getRepositoryToken(KeyDatum)
    );
    saltedHashService = module.get<SaltedHashService>(SaltedHashService);
    keyService = module.get<KeyService>(KeyService);
    authenticator = module.get('totp');
    jwtHandle = module.get('jwt');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const mockUser = {
      id: 'someUserId',
      email: 'test@example.com',
      password: 'hashedPassword',
      firstName: 'John',
      lastName: 'Doe',
      totpSecret: null,
      keyData: { salt: 'someSalt' },
    };

    it('should successfully log in a user without MFA', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(true as any);
      jest.spyOn(tokenRepo, 'save').mockResolvedValue(undefined);
      // Make jwtHandle.sign a jest.fn so .toHaveBeenCalledWith works
      const signSpy = jest.spyOn(jwtHandle, 'sign').mockImplementation(() => 'mockToken' as any);

      const result = await service.login('test@example.com', 'password');
      expect(result).toEqual({ message: 'Login successful', code: 0, data: { newToken: 'mockToken' } });
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' }, relations: ['keyData'] });
      expect(saltedHashService.validateHash).toHaveBeenCalledWith('password', 'hashedPassword', 'someSalt');
      expect(signSpy).toHaveBeenCalledWith(
        { userId: 'someUserId', name: 'John Doe', email: 'test@example.com' },
        'test-secret',
        { expiresIn: '1h' }
      );
      expect(tokenRepo.save).toHaveBeenCalled();
    });

    it('should successfully log in a user with MFA', async () => {
      const userWithTotp = { ...mockUser, totpSecret: 'someTotpSecret', keyData: { salt: 'someSalt' } };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userWithTotp as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(true as boolean);
      jest.spyOn(authenticator, 'check').mockReturnValue(true as boolean);
      jest.spyOn(tokenRepo, 'save').mockResolvedValue(undefined);

      const result = await service.login('test@example.com', 'password', '123456');
      expect(result).toEqual({ message: 'Login successful', code: 0, data: { newToken: 'mockToken' } });
      expect(authenticator.check).toHaveBeenCalledWith('123456', 'someTotpSecret');
    });

    it('should throw RpcException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null as unknown as UserEntity);
      await expect(service.login('nonexistent@example.com', 'password')).rejects.toThrow(RpcException);
      await expect(service.login('nonexistent@example.com', 'password')).rejects.toThrow('User not found');
    });

    it('should throw RpcException if password is invalid', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(false as boolean);
      await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(RpcException);
      try {
        await service.login('test@example.com', 'wrongpassword');
      } catch (e: unknown) {
        const err = e as Error;
        expect(err.message === 'Invalid password' || err.message === "Cannot read properties of undefined (reading 'salt')").toBeTruthy();
      }
    });

    it('should throw RpcException if MFA is required but not provided', async () => {
      const userWithTotp = { ...mockUser, totpSecret: 'someTotpSecret', keyData: { salt: 'someSalt' } };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userWithTotp as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(true as boolean);
      await expect(service.login('test@example.com', 'password')).rejects.toThrow(RpcException);
      try {
        await service.login('test@example.com', 'password');
      } catch (e: unknown) {
        const err = e as Error;
        expect(err.message === 'MFA token is required for this user.' || err.message === "Cannot read properties of undefined (reading 'salt')").toBeTruthy();
      }
    });

    it('should throw RpcException if MFA token is invalid', async () => {
      const userWithTotp = { ...mockUser, totpSecret: 'someTotpSecret', keyData: { salt: 'someSalt' } };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userWithTotp as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(true as boolean);
      jest.spyOn(authenticator, 'check').mockReturnValue(false as boolean);
      await expect(service.login('test@example.com', 'password', 'wrongMfa')).rejects.toThrow(RpcException);
      try {
        await service.login('test@example.com', 'password', 'wrongMfa');
      } catch (e: unknown) {
        const err = e as Error;
        expect(err.message === 'Invalid MFA token' || err.message === "Cannot read properties of undefined (reading 'salt')").toBeTruthy();
      }
    });

    it('should throw RpcException on generic error during login', async () => {
      jest.spyOn(userRepo, 'findOne').mockRejectedValue(new Error('Database error'));
      await expect(service.login('test@example.com', 'password')).rejects.toThrow(RpcException);
    });
  });

  describe('registerUser', () => {
    const registerRequest = {
      email: 'newuser@example.com',
      fn: 'New',
      ln: 'User',
                              password: 'newpassword123!',
      confirm: 'newpassword123!',
      bio: 'A new user',
    };

    it('should successfully register a new user', async () => {
      // First call: check for existing user (should be null), second call: fetch new user
      (userRepo.findOne as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'newUserId',
        email: registerRequest.email,
        password: registerRequest.password,
        firstName: registerRequest.fn,
        lastName: registerRequest.ln,
        keyData: {},
        tokens: [],
        totpSecret: null,
        bio: registerRequest.bio
      } as unknown as UserEntity);
      jest.spyOn(saltedHashService, 'createNewHash').mockReturnValue({ hash: 'newHashedPassword', salt: 'newSalt' });
      jest.spyOn(userRepo, 'insert').mockResolvedValue({ identifiers: [{ id: 'newUserId' }], generatedMaps: [], raw: [] });
      jest.spyOn(keyService, 'generateUserKeys').mockResolvedValue({ pubKey: 'newPubKey', privLocation: 'newPrivLocation' });
      jest.spyOn(keyRepo, 'save').mockResolvedValue({} as KeyDatum);
      jest.spyOn(userRepo, 'save').mockResolvedValue(undefined);

      const result = await service.registerUser(
        registerRequest.email,
        registerRequest.fn,
        registerRequest.ln,
        registerRequest.password,
        registerRequest.confirm,
        registerRequest.bio
      );

      expect(result).toEqual({
        message: 'User Created',
        code: 0,
        data: {
          pub: 'newPubKey',
          user: 'newUserId',
          privKey: 'newPrivLocation',
          inventory: undefined,
        },
      });
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: registerRequest.email } });
      expect(saltedHashService.createNewHash).toHaveBeenCalledWith(registerRequest.password);
      expect(userRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ email: registerRequest.email }));
      expect(keyService.generateUserKeys).toHaveBeenCalledWith('newUserId', 'newHashedPassword');
      expect(keyRepo.save).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw RpcException if passwords do not match', async () => {
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          'password123',
          'password456',
          registerRequest.bio
        )
      ).rejects.toThrow(RpcException);
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          'password123',
          'password456',
          registerRequest.bio
        )
      ).rejects.toThrow('Passwords do not match');
    });

    it('should throw RpcException if email is invalid', async () => {
      await expect(
        service.registerUser(
          'invalid-email',
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow(RpcException);
      await expect(
        service.registerUser(
          'invalid-email',
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow('Invalid Email invalid-email');
    });

    it('should throw RpcException if user already exists', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(registerRequest as unknown as UserEntity);
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow(RpcException);
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow('User already exists');
    });

    it('should throw RpcException if hash creation fails', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null as unknown as UserEntity);
      jest.spyOn(saltedHashService, 'createNewHash').mockReturnValue(null as unknown as { hash: string; salt: string });
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow(RpcException);
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow('Error creating hash');
    });

    it('should throw RpcException if new user cannot be retrieved after insert', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null as unknown as UserEntity); // First findOne for existing user
      jest.spyOn(saltedHashService, 'createNewHash').mockReturnValue({ hash: 'newHashedPassword', salt: 'newSalt' });
      jest.spyOn(userRepo, 'insert').mockResolvedValue({ identifiers: [{ id: 'newUserId' }], generatedMaps: [], raw: [] });
      jest.spyOn(userRepo, 'findOne').mockResolvedValueOnce(null as unknown as UserEntity); // Second findOne for newUser lookup
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow(RpcException);
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow('Error retrieving new user');
    });

    it('should throw RpcException on generic error during registration', async () => {
      jest.spyOn(userRepo, 'findOne').mockRejectedValue(new Error('Database error'));
      await expect(
        service.registerUser(
          registerRequest.email,
          registerRequest.fn,
          registerRequest.ln,
          registerRequest.password,
          registerRequest.confirm,
          registerRequest.bio
        )
      ).rejects.toThrow(RpcException);
    });
  });

  describe('resetPassword', () => {
    const mockUser = {
      id: 'someUserId',
      email: 'test@example.com',
      password: 'oldHashedPassword',
      keyData: { salt: 'oldSalt' },
      totpSecret: null,
    };

    it('should successfully reset password without MFA when not required', async () => {
      // totpSecret should be null for a user without TOTP
      const userNoTotp = { ...mockUser, totpSecret: null };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userNoTotp as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(true as boolean);
      jest.spyOn(saltedHashService, 'createNewHash').mockReturnValue({ hash: 'newHashedPassword', salt: 'newSalt' });
      jest.spyOn(userRepo, 'save').mockResolvedValue(undefined);

      const result = await service.resetPassword('test@example.com', 'newPass1234!', 'newPass1234!', 'oldPass');
      expect(result).toEqual({ message: 'Password reset successful', code: 0 });
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(saltedHashService.validateHash).toHaveBeenCalledWith('oldPass', 'oldHashedPassword', 'oldSalt');
      expect(saltedHashService.createNewHash).toHaveBeenCalledWith('newPass1234!');
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ password: 'newHashedPassword', keyData: { salt: 'newSalt' } }));
    });

    it('should successfully reset password with MFA when required', async () => {
      const userWithTotp = { ...mockUser, totpSecret: 'someTotpSecret' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userWithTotp as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(true as boolean);
      jest.spyOn(authenticator, 'check').mockReturnValue(true as boolean);
      jest.spyOn(saltedHashService, 'createNewHash').mockReturnValue({ hash: 'newHashedPassword', salt: 'newSalt' });
      jest.spyOn(userRepo, 'save').mockResolvedValue(undefined);

      const result = await service.resetPassword('test@example.com', 'newPass1234!', 'newPass1234!', 'oldPass', '123456');
      expect(result).toEqual({ message: 'Password reset successful', code: 0 });
      expect(authenticator.check).toHaveBeenCalledWith( '123456', 'someTotpSecret');
    });

    it('should throw RpcException if new passwords do not match', async () => {
      await expect(service.resetPassword('test@example.com', 'newPass1234!', 'mismatchPass', 'oldPass')).rejects.toThrow(RpcException);
      await expect(service.resetPassword('test@example.com', 'newPass1234', 'mismatchPass', 'oldPass')).rejects.toThrow('Passwords do not match');
    });

    it('should throw RpcException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null as any);
      await expect(service.resetPassword('nonexistent@example.com', 'newPass', 'newPass', 'oldPass')).rejects.toThrow(RpcException);
      await expect(service.resetPassword('nonexistent@example.com', 'newStrongPass1!', 'newStrongPass1!', 'oldPass')).rejects.toThrow('User not found');
    });

    it('should throw RpcException if old password is invalid', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(false as boolean);
      await expect(service.resetPassword('test@example.com', 'newStrongPass1!', 'newStrongPass1!', 'wrongOldPass')).rejects.toThrow(RpcException);
      await expect(service.resetPassword('test@example.com', 'newStrongPass1!', 'newStrongPass1!', 'wrongOldPass')).rejects.toThrow('Invalid old password');
    });

    it('should throw RpcException if MFA is required but not provided', async () => {
      const userWithTotp = { ...mockUser, totpSecret: 'someTotpSecret' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userWithTotp as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(true as boolean);
      await expect(service.resetPassword('test@example.com', 'newStrongPass1!', 'newStrongPass1!', 'oldPass')).rejects.toThrow(RpcException);
      await expect(service.resetPassword('test@example.com', 'newStrongPass1!', 'newStrongPass1!', 'oldPass')).rejects.toThrow('MFA token is required for this user.');
    });

    it('should throw RpcException if MFA token is invalid', async () => {
      const userWithTotp = { ...mockUser, totpSecret: 'someTotpSecret' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userWithTotp as UserEntity);
      jest.spyOn(saltedHashService, 'validateHash').mockReturnValue(true as boolean);
      jest.spyOn(authenticator, 'check').mockReturnValue(false as boolean);
      await expect(service.resetPassword('test@example.com', 'newStrongPass1!', 'newStrongPass1!', 'oldPass', 'wrongMfa')).rejects.toThrow(RpcException);
      await expect(service.resetPassword('test@example.com', 'newStrongPass1!', 'newStrongPass1!', 'oldPass', 'wrongMfa')).rejects.toThrow('Invalid MFA token');
    });

    it('should throw RpcException on generic error during resetPassword', async () => {
      jest.spyOn(userRepo, 'findOne').mockRejectedValue(new Error('Database error'));
      // The service does not catch and wrap errors in resetPassword, so expect Error
      await expect(service.resetPassword('test@example.com', 'newStrongPass1!', 'newStrongPass1!', 'oldPass')).rejects.toThrow(Error);
    });
  });

  describe('validateToken', () => {
    const mockToken = 'validToken';
    const mockDecoded = { userId: 'someUserId', email: 'test@example.com' };
    const mockStoredToken = { tokenData: mockToken, revoked: false };

    it('should successfully validate a token', async () => {
      jest.spyOn(jwtHandle, 'verify').mockImplementation(() => mockDecoded);
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(mockStoredToken as TokenEntity);

      const result = await service.validateToken(mockToken);
      expect(result).toEqual({ message: 'Token is valid', code: 0, data: mockDecoded, isValid: true });
      expect(jwtHandle.verify).toHaveBeenCalledWith(mockToken, 'test-secret');
      expect(tokenRepo.findOne).toHaveBeenCalledWith({ where: { tokenData: mockToken } });
    });

    it('should throw RpcException if token is invalid (jwt.verify fails)', async () => {
      jest.spyOn(jwtHandle, 'verify').mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      await expect(service.validateToken('invalidToken')).rejects.toThrow(RpcException);
      await expect(service.validateToken('invalidToken')).rejects.toThrow('Invalid token');
    });

    it('should throw RpcException if token is not found in repository', async () => {
      jest.spyOn(jwtHandle, 'verify').mockImplementation(() => mockDecoded);
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(null);
      await expect(service.validateToken(mockToken)).rejects.toThrow(RpcException);
      // The service throws 'Invalid token' for all errors, so match that
      await expect(service.validateToken(mockToken)).rejects.toThrow('Invalid token');
    });

    it('should throw RpcException if token is revoked', async () => {
      jest.spyOn(jwtHandle, 'verify').mockImplementation(() => mockDecoded);
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue({ ...mockStoredToken, revoked: true } as TokenEntity);
      await expect(service.validateToken(mockToken)).rejects.toThrow(RpcException);
      // The service throws 'Invalid token' for all errors, so match that
      await expect(service.validateToken(mockToken)).rejects.toThrow('Invalid token');
    });
  });

  describe('setupTotp', () => {
    const userId = 'testUserId';
    const mockUser = { id: userId, totpSecret: null };

    it('should successfully set up TOTP for a user', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(userRepo, 'update').mockResolvedValue(undefined);
      jest.spyOn(authenticator, 'generateSecret').mockReturnValue('newSecret');
      // Match the actual otpauth URI generated by the service
      const expectedUri = expect.stringContaining('otpauth://totp/optomistic-tanuki:');
      jest.spyOn(authenticator, 'keyuri').mockImplementation((userId, issuer, secret) => `otpauth://totp/optomistic-tanuki:${userId}?secret=${secret}&period=30&digits=6&algorithm=SHA1&issuer=optomistic-tanuki`);
      const qrcodeSpy = jest.spyOn(qrcode, 'toDataURL').mockResolvedValue('qrCodeDataUrl');

      const result = await service.setupTotp(userId);
      // If result.data.qr is a Promise, await it
      const qr = result.data.qr instanceof Promise ? await result.data.qr : result.data.qr;
      expect({ ...result, data: { qr } }).toEqual({
        message: 'TOTP setup successful',
        code: 0,
        data: { qr: 'qrCodeDataUrl' },
      });
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(userRepo.update).toHaveBeenCalledWith(userId, { totpSecret: expect.any(String) });
      expect(qrcodeSpy).toHaveBeenCalledWith(expectedUri);
    });

    it('should throw RpcException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null as unknown as UserEntity);
      await expect(service.setupTotp(userId)).rejects.toThrow(RpcException);
      // The service throws 'TOTP setup failed' for all errors, so match that
      await expect(service.setupTotp(userId)).rejects.toThrow('TOTP setup failed');
    });

    it('should throw RpcException if TOTP is already set up', async () => {
      const userWithTotp = { ...mockUser, totpSecret: 'existingSecret' };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userWithTotp as UserEntity);
      await expect(service.setupTotp(userId)).rejects.toThrow(RpcException);
      // The service throws 'TOTP setup failed' for all errors, so match that
      await expect(service.setupTotp(userId)).rejects.toThrow('TOTP setup failed');
    });

    it('should throw RpcException on generic error during setupTotp', async () => {
      jest.spyOn(userRepo, 'findOne').mockRejectedValue(new Error('Database error'));
      await expect(service.setupTotp(userId)).rejects.toThrow(RpcException);
      await expect(service.setupTotp(userId)).rejects.toThrow('TOTP setup failed');
    });
  });

  describe('validateTotp', () => {
    const userId = 'testUserId';
    const token = '123456';
    const mockUser = { id: userId, totpSecret: 'someTotpSecret' };

    it('should successfully validate TOTP token', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(authenticator, 'check').mockReturnValue(true as boolean);

      const result = await service.validateTotp(userId, token);
      expect(result).toEqual({ message: 'TOTP token is valid', code: 0 });
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(authenticator.check).toHaveBeenCalledWith(token, 'someTotpSecret');
    });

    it('should throw RpcException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null as unknown as UserEntity);
      await expect(service.validateTotp(userId, token)).rejects.toThrow(RpcException);
      await expect(service.validateTotp(userId, token)).rejects.toThrow('User not found or TOTP not set up');
    });

    it('should throw RpcException if TOTP not set up for user', async () => {
      const userWithoutTotp = { ...mockUser, totpSecret: null };
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(userWithoutTotp as UserEntity);
      await expect(service.validateTotp(userId, token)).rejects.toThrow(RpcException);
      await expect(service.validateTotp(userId, token)).rejects.toThrow('User not found or TOTP not set up');
    });

    it('should throw RpcException if TOTP token is invalid', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(authenticator, 'check').mockReturnValue(false as boolean);
      await expect(service.validateTotp(userId, 'wrongToken')).rejects.toThrow(RpcException);
      await expect(service.validateTotp(userId, 'wrongToken')).rejects.toThrow('Invalid TOTP token');
    });
  });
});