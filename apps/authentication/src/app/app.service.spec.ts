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

let service: AppService;
let userRepo: Repository<UserEntity>;
let tokenRepo: Repository<TokenEntity>;
let keyRepo: Repository<KeyDatum>;
let saltedHashService: SaltedHashService;
let authenticator: any;
let keyService: KeyService;
let jwtHandle: typeof jwt;
let jwtService: JwtService;

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
            config,
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
          provide: SaltedHashService,
          useValue: {
            validateHash: jest.fn((p, h, s) => Promise.resolve(true)),
            createNewHash: jest.fn((p) =>
              Promise.resolve({ hash: 'mockHash', salt: 'mockSalt' }),
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
              'test-secret',
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
      getRepositoryToken(UserEntity),
    );
    tokenRepo = module.get<Repository<TokenEntity>>(
      getRepositoryToken(TokenEntity),
    );
    keyRepo = module.get<Repository<KeyDatum>>(getRepositoryToken(KeyDatum));
    saltedHashService = module.get<SaltedHashService>(SaltedHashService);
    keyService = module.get<KeyService>(KeyService);
    authenticator = module.get('totp');
    jwtHandle = module.get('jwt');
    jwtService = module.get<JwtService>(JwtService);
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
        'someSalt',
      );
      expect(signSpy).toHaveBeenCalled();
      expect(tokenRepo.save).toHaveBeenCalled();
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
        '123456',
      );
      expect(result).toEqual({
        message: 'Login successful',
        code: 0,
        data: { newToken: 'mockToken' },
      });
      expect(authenticator.check).toHaveBeenCalledWith(
        '123456',
        'someTotpSecret',
      );
    });
  });
});
