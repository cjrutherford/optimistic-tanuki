import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { SaltedHashService } from '@optimistic-tanuki/encryption';
import { KeyService } from './key.service';
import { RpcException } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { Logger } from '@nestjs/common';

describe('AppService', () => {
  let service: AppService;
  let userRepo: Repository<UserEntity>;
  let tokenRepo: Repository<TokenEntity>;
  let saltedHashService: SaltedHashService;
  let authenticator;
  let keyService: KeyService;
  let jwtHandle: typeof jwt;

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
            validateHash: jest.fn(),
            createNewHash: jest.fn(),
          },
        },
        {
          provide: KeyService,
          useValue: {
            generateUserKeys: jest.fn(),
          },
        },
        {
          provide: 'totp',
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: 'JWT_SECRET',
          useValue: 'test-secret',
        },
        {
          provide: 'jwt',
          useValue: {
            verify: jest.fn(),
            sign: jest.fn(),
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
    saltedHashService = module.get<SaltedHashService>(SaltedHashService);
    keyService = module.get<KeyService>(KeyService);
    authenticator = module.get('totp');
    jwtHandle = module.get('jwt');
  });

  const email = 'thomasmorrow@adayaway.com';
  const pw = 'password';
  // it("should throw an error on invalid email for login", async () => {
  //   const email = "blergnotanemail";
  //   const pw = "password";
  //   expect(service.login(email, pw)).rejects.toThrow(RpcException);
  // });
  describe('App Service Login User Errors', () => {
    it('should error when the user is not found', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.login(email, pw)).rejects.toThrow(RpcException);
    });

    it('should error when passwords do not match', async () => {
      (saltedHashService.validateHash as jest.Mock).mockResolvedValue(false);
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        email,
        password: 'wrongPassword',
        keyData: { salt: '' },
      });
      await expect(service.login(email, pw)).rejects.toThrow(RpcException);
    });

    it('should error when MFA is required but not provided', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        email,
        password: 'hashedPassword',
        keyData: { salt: '' },
        totpSecret: 'totpSecret',
      });
      (saltedHashService.validateHash as jest.Mock).mockResolvedValue(true);
      await expect(service.login(email, pw)).rejects.toThrow(RpcException);
    });

    it('should error when MFA is invalid', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        email,
        password: 'hashedPassword',
        keyData: { salt: '' },
        totpSecret: 'totpSecret',
      });
      (saltedHashService.validateHash as jest.Mock).mockResolvedValue(true);
      (authenticator.check as jest.Mock).mockReturnValue(false);
      await expect(service.login(email, pw, 'invalidMfa')).rejects.toThrow(
        RpcException
      );
    });
  });

  describe('App Service Login User Success', () => {
    it('should successfully login the user', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email,
        password: 'hashedPassword',
        keyData: { salt: 'salt' },
        firstName: 'Thomas',
        lastName: 'Morrow',
        totpSecret: 'totpSecret',
      });
      (saltedHashService.validateHash as jest.Mock).mockResolvedValue(true);
      (authenticator.check as jest.Mock).mockReturnValueOnce(true);
      const result = await service.login(email, pw, 'validMfa');
      expect(result.data).toHaveProperty('newToken');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('message');
      expect(result.code).toBe(0);
      expect(result.message).toBe('Login successful');
      expect(saltedHashService.validateHash).toHaveBeenCalledWith(
        pw,
        'hashedPassword',
        'salt'
      );
      expect(authenticator.check).toHaveBeenCalledWith(
        'validMfa',
        'totpSecret'
      );
    });
  });

  // Add more tests for registerUser, resetPassword, and validateToken methods
  describe('App Service Register User Errors', () => {
    it('should throw an error when passwords do not match during registration', async () => {
      expect(
        service.registerUser(email, 'Thomas', 'Morrow', pw, 'differentPassword', 'a day away')
      ).rejects.toThrow(RpcException);
    });

    it('should throw an error when the email is malformed during registration', async () => {
      expect(
        service.registerUser('invalidEmail', 'Thomas', 'Morrow', pw, pw, 'a day away')
      ).rejects.toThrow(RpcException);
    });

    it('should throw an error when the user already exists during registration', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({ email });
      await expect(
        service.registerUser(email, 'Thomas', 'Morrow', pw, pw, 'a day away')
      ).rejects.toThrow(RpcException);
    });
  });
  describe('App Service Register User Success', () => {
    it('should successfully register a user', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValueOnce(null);
      (saltedHashService.createNewHash as jest.Mock).mockResolvedValue({
        hash: 'hashedPassword',
        salt: 'salt',
      });
      (keyService.generateUserKeys as jest.Mock).mockResolvedValue({
        pubKey: 'publicKey',
        privLocation: 'private',
      });
      (userRepo.findOne as jest.Mock).mockResolvedValueOnce({ id: 'user-id', keyData: { salt: 'salt' } });
      (userRepo.insert as jest.Mock).mockResolvedValue({ identifiers: [{ id: 'user-id' }] });

      const result = await service.registerUser(
        email,
        'Thomas',
        'Morrow',
        pw,
        pw,
        'a day awaay'
      );
      expect(result).toHaveProperty('message');
      expect(result.message).toBe('User Created');
      expect(result).toHaveProperty('code');
      expect(result.code).toBe(0);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('pub');
      expect(result.data).toHaveProperty('user');
      expect(result.data).toHaveProperty('privKey');
      expect(result.data.pub).toBe('publicKey');
      expect(result.data.user).toBe('user-id');
      expect(result.data.privKey).toBe('private');
    });
  });

  describe('App Service Reset Password Errors', () => {
    it('should throw an error when the passwords do not match', () => {
      expect(
        service.resetPassword(email, pw, 'differentPassword', pw, pw)
      ).rejects.toThrow(RpcException);
    });

    it('should throw an error when the user is not found', () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);
      expect(service.resetPassword(email, pw, pw, pw, pw)).rejects.toThrow(
        RpcException
      );
    });

    it('should throw an error when the old password is invalid', () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        password: 'hashedPassword',
        keyData: { salt: 'salt' },
      });
      (saltedHashService.validateHash as jest.Mock).mockResolvedValue(false);
      expect(
        service.resetPassword(email, pw, pw, 'invalidOldPassword', pw)
      ).rejects.toThrow(RpcException);
    });

    it('should throw an error when MFA is required but not provided', () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        password: 'hashedPassword',
        keyData: { salt: 'salt' },
        totpSecret: 'totpSecret',
      });
      expect(service.resetPassword(email, pw, pw, pw)).rejects.toThrow(
        RpcException
      );
    });

    it('should throw an error when MFA is invalid', () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        password: 'hashedPassword',
        keyData: { salt: 'salt' },
        totpSecret: 'totpSecret',
      });
      (authenticator.check as jest.Mock).mockReturnValue(false);
      expect(
        service.resetPassword(email, pw, pw, pw, 'invalidMfa')
      ).rejects.toThrow(RpcException);
    });
  });
  describe('App Service Reset Password Success', () => {
    it("should successfully reset the user's password", async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        password: 'hashedPassword',
        keyData: { salt: 'salt' },
        totpSecret: 'totpSecret',
      });
      (saltedHashService.validateHash as jest.Mock).mockResolvedValue(true);
      (authenticator.check as jest.Mock).mockReturnValue(true);
      (saltedHashService.createNewHash as jest.Mock).mockResolvedValue({
        hash: 'newHash',
        salt: 'newSalt',
      });
      await service.resetPassword(email, pw, pw, pw, 'validMfa');
      expect(saltedHashService.createNewHash).toHaveBeenCalledWith(pw);
      expect(userRepo.save).toHaveBeenCalled();
    });
  });

  describe('App Service Validate Token Errors', () => {
    it('should throw an error when the token is invalid', () => {
      (jwtHandle.verify as jest.Mock).mockImplementation(() => {
        throw new Error();
      });
      expect(service.validateToken('invalidToken')).rejects.toThrow(
        RpcException
      );
    });

    it('should throw an error when the token is revoked', () => {
      (jwtHandle.verify as jest.Mock).mockReturnValue({ email });
      (tokenRepo.findOne as jest.Mock).mockResolvedValue({ revoked: true });
      expect(service.validateToken('validToken')).rejects.toThrow(RpcException);
    });
  });

  describe('App Service Setup Totp', () => {
    it('should return an error when the user is not found', () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);
      expect(service.setupTotp(email)).rejects.toThrow(RpcException);
    });

    it('should return an error when the user already has a totp secret', () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        totpSecret: 'totpSecret',
      });
      expect(service.setupTotp(email)).rejects.toThrow(RpcException);
    });

    it('should return the totp secret when successful', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        totpSecret: undefined,
      });
      (userRepo.update as jest.Mock).mockResolvedValue({ raw: [] });
      const result = await service.setupTotp(email);
      expect(result).toHaveProperty('message');
      expect(result.message).toBe('TOTP setup successful');
      expect(result).toHaveProperty('code');
      expect(result.code).toBe(0);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('qr');
    });
  });

  describe('App Service Validate token', () => {
    it('should return an error when the token is invalid', () => {
      (jwtHandle.verify as jest.Mock).mockImplementation(() => {
        throw new Error();
      });
      expect(service.validateToken('invalidToken')).rejects.toThrow(
        RpcException
      );
    });

    it('should return an error when the token is revoked', () => {
      (jwtHandle.verify as jest.Mock).mockReturnValue({ email });
      (tokenRepo.findOne as jest.Mock).mockResolvedValue({ revoked: true });
      expect(service.validateToken('validToken')).rejects.toThrow(RpcException);
    });

    it('should return the decoded token when successful', async () => {
      (jwtHandle.verify as jest.Mock).mockReturnValue({ email });
      (tokenRepo.findOne as jest.Mock).mockResolvedValue({ revoked: false });
      const result = await service.validateToken('validToken');
      expect(result).toHaveProperty('message');
      expect(result.message).toBe('Token is valid');
      expect(result).toHaveProperty('code');
      expect(result.code).toBe(0);
    });
  })
});
