import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService } from './oauth.service';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OAuthProviderEntity } from '../oauth-providers/entities/oauth-provider.entity';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { OAuthConfigValidator } from './oauth-config.validator';

describe('OAuthService', () => {
  let service: OAuthService;
  let oauthRepo: Repository<OAuthProviderEntity>;
  let userRepo: Repository<UserEntity>;
  let tokenRepo: Repository<TokenEntity>;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Logger,
        OAuthService,
        {
          provide: getRepositoryToken(OAuthProviderEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TokenEntity),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: 'JWT_SECRET',
          useValue: 'test-secret',
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
        {
          provide: OAuthConfigValidator,
          useValue: {
            isProviderEnabled: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
    oauthRepo = module.get(getRepositoryToken(OAuthProviderEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    tokenRepo = module.get(getRepositoryToken(TokenEntity));
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('oauthLogin', () => {
    it('should login existing linked user and issue token', async () => {
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        emailVerifiedAt: new Date(),
        password: 'hash',
        keyData: null,
      };
      (oauthRepo.findOne as jest.Mock).mockResolvedValue({
        provider: 'google',
        providerUserId: 'google-123',
        user: mockUser,
      });
      (oauthRepo.save as jest.Mock).mockResolvedValue({});
      (tokenRepo.save as jest.Mock).mockResolvedValue({});

      const result = await service.oauthLogin(
        'google',
        'google-123',
        'test@example.com',
        'Test User'
      );

      expect(result.code).toBe(0);
      expect((result.data as any).newToken).toBe('mock-jwt-token');
    });

    it('persists profileId when issuing an OAuth session', async () => {
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        emailVerifiedAt: new Date(),
        password: 'hash',
        keyData: null,
      };
      (oauthRepo.findOne as jest.Mock).mockResolvedValue({
        provider: 'google',
        providerUserId: 'google-123',
        user: mockUser,
      });
      (oauthRepo.save as jest.Mock).mockResolvedValue({});
      (tokenRepo.save as jest.Mock).mockResolvedValue({});

      await service.oauthLogin(
        'google',
        'google-123',
        'test@example.com',
        'Test User',
        'profile-1'
      );

      expect(tokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: 'profile-1' })
      );
    });

    it('should auto-link when email matches an existing user and provider email is verified', async () => {
      (oauthRepo.findOne as jest.Mock).mockResolvedValue(null);
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        emailVerifiedAt: new Date(),
        password: 'hash',
        keyData: null,
      };
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUser);
      (oauthRepo.save as jest.Mock).mockResolvedValue({});
      (tokenRepo.save as jest.Mock).mockResolvedValue({});

      const result = await service.oauthLogin(
        'google',
        'google-123',
        'test@example.com',
        'Test User',
        undefined,
        true // provider asserts the email is verified
      );

      expect(result.code).toBe(0);
      expect((result.data as any).newToken).toBe('mock-jwt-token');
      expect(oauthRepo.save).toHaveBeenCalledWith({
        provider: 'google',
        providerUserId: 'google-123',
        providerEmail: 'test@example.com',
        providerDisplayName: 'Test User',
        userId: 'user-1',
      });
    });

    it('refuses to auto-link when the provider email is not verified', async () => {
      (oauthRepo.findOne as jest.Mock).mockResolvedValue(null);
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        emailVerifiedAt: new Date(),
        password: 'hash',
        keyData: null,
      };
      (userRepo.findOne as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.oauthLogin(
          'google',
          'google-123',
          'test@example.com',
          'Test User',
          undefined,
          false // provider did NOT verify the email
        )
      ).rejects.toThrow(RpcException);

      // No account was linked and no session issued for the takeover attempt.
      expect(oauthRepo.save).not.toHaveBeenCalled();
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });

    it('should return needsRegistration when no matching user found', async () => {
      (oauthRepo.findOne as jest.Mock).mockResolvedValue(null);
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.oauthLogin(
        'google',
        'google-123',
        'newuser@example.com',
        'New User'
      );

      expect(result.code).toBe(1);
      expect((result.data as any).needsRegistration).toBe(true);
    });

    it('does not issue a session until platform email verification completes', async () => {
      (oauthRepo.findOne as jest.Mock).mockResolvedValue({
        provider: 'google',
        providerUserId: 'google-123',
        user: {
          id: 'user-1',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          emailVerifiedAt: null,
        },
      });

      const result = await service.oauthLogin(
        'google',
        'google-123',
        'test@example.com',
        'Test User'
      );
      expect(result).toMatchObject({
        code: 2,
        data: { userId: 'user-1', verificationRequired: true },
      });
      expect(tokenRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('linkProvider', () => {
    it('should link a provider to a user', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      (oauthRepo.findOne as jest.Mock).mockResolvedValue(null);
      (oauthRepo.save as jest.Mock).mockResolvedValue({
        id: 'oauth-1',
        provider: 'github',
        providerEmail: 'test@github.com',
        providerDisplayName: 'testuser',
      });

      const result = await service.linkProvider(
        'user-1',
        'github',
        'github-456',
        'test@github.com',
        'testuser'
      );

      expect(result.code).toBe(0);
      expect(result.message).toContain('linked successfully');
    });

    it('should throw if user not found', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.linkProvider('nonexistent', 'github', 'github-456')
      ).rejects.toThrow(RpcException);
    });

    it('should throw if provider already linked to this user', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'user-1',
      });
      (oauthRepo.findOne as jest.Mock).mockResolvedValueOnce({
        provider: 'github',
        userId: 'user-1',
      });

      await expect(
        service.linkProvider('user-1', 'github', 'github-456')
      ).rejects.toThrow(RpcException);
    });

    it('should throw if provider account linked to different user', async () => {
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'user-1',
      });
      (oauthRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // Check by provider+userId
        .mockResolvedValueOnce({
          provider: 'github',
          userId: 'user-2',
          providerUserId: 'github-456',
        }); // Check by provider+providerUserId

      await expect(
        service.linkProvider('user-1', 'github', 'github-456')
      ).rejects.toThrow(RpcException);
    });
  });

  describe('unlinkProvider', () => {
    it('should unlink a provider from a user', async () => {
      (oauthRepo.findOne as jest.Mock).mockResolvedValue({
        provider: 'github',
        userId: 'user-1',
      });
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'user-1',
        password: 'hash',
      });
      (oauthRepo.count as jest.Mock).mockResolvedValue(2);
      (oauthRepo.remove as jest.Mock).mockResolvedValue({});

      const result = await service.unlinkProvider('user-1', 'github');

      expect(result.code).toBe(0);
      expect(result.message).toContain('unlinked successfully');
    });

    it('should throw if provider not linked', async () => {
      (oauthRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.unlinkProvider('user-1', 'github')).rejects.toThrow(
        RpcException
      );
    });

    it('should throw if trying to unlink last auth method without password', async () => {
      (oauthRepo.findOne as jest.Mock).mockResolvedValue({
        provider: 'github',
        userId: 'user-1',
      });
      (userRepo.findOne as jest.Mock).mockResolvedValue({
        id: 'user-1',
        password: null,
      });
      (oauthRepo.count as jest.Mock).mockResolvedValue(1);

      await expect(service.unlinkProvider('user-1', 'github')).rejects.toThrow(
        RpcException
      );
    });
  });

  describe('getLinkedProviders', () => {
    it('should return linked providers for a user', async () => {
      (oauthRepo.find as jest.Mock).mockResolvedValue([
        {
          id: 'oauth-1',
          provider: 'google',
          providerEmail: 'test@gmail.com',
          providerDisplayName: 'Test',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getLinkedProviders('user-1');

      expect(result.code).toBe(0);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].provider).toBe('google');
    });

    it('should return empty array when no providers linked', async () => {
      (oauthRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await service.getLinkedProviders('user-1');

      expect(result.code).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });
});
