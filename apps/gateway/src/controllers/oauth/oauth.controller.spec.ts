import { Test, TestingModule } from '@nestjs/testing';
import { OAuthController } from './oauth.controller';
import { ClientProxy } from '@nestjs/microservices';
import { HttpException, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import { AuthCommands } from '@optimistic-tanuki/constants';

describe('OAuthController', () => {
  let controller: OAuthController;
  let authClient: ClientProxy;

  beforeEach(async () => {
    authClient = {
      send: jest.fn().mockReturnValue(of(true)),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    const profileClient = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OAuthController],
      providers: [
        {
          provide: 'AUTHENTICATION_SERVICE',
          useValue: authClient,
        },
        {
          provide: 'PROFILE_SERVICE',
          useValue: profileClient,
        },
        {
          provide: RoleInitService,
          useValue: {
            initializeRoles: jest.fn().mockResolvedValue(undefined),
            enqueue: jest.fn().mockResolvedValue(undefined),
            processNow: jest.fn().mockResolvedValue(undefined),
          },
        },
        Logger,
      ],
    }).compile();

    controller = module.get<OAuthController>(OAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('oauthCallback', () => {
    it('should process OAuth callback and return token', async () => {
      const mockResult = {
        message: 'OAuth login successful',
        code: 0,
        data: { newToken: 'jwt-token' },
      };
      (authClient.send as jest.Mock).mockReturnValue(of(mockResult));

      const callbackRequest = {
        provider: 'google' as any,
        code: 'auth-code',
      };
      const result = await controller.oauthCallback(callbackRequest, 'test');

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.OAuthLogin },
        callbackRequest
      );
      expect(result).toEqual(mockResult);
    });

    it('should return needsRegistration when no linked account', async () => {
      const mockResult = {
        message: 'No linked account found',
        code: 1,
        data: { needsRegistration: true, provider: 'google' },
      };
      (authClient.send as jest.Mock).mockReturnValue(of(mockResult));

      const callbackRequest = {
        provider: 'google' as any,
        code: 'auth-code',
      };
      const result = await controller.oauthCallback(callbackRequest, 'test');

      expect(result.data.needsRegistration).toBe(true);
    });

    it('should throw HttpException on error', async () => {
      (authClient.send as jest.Mock).mockImplementation(() => {
        throw new Error('OAuth error');
      });

      const callbackRequest = {
        provider: 'google' as any,
        code: 'auth-code',
      };
      await expect(
        controller.oauthCallback(callbackRequest, 'test')
      ).rejects.toThrow(HttpException);
    });
  });

  describe('linkProvider', () => {
    it('should link a provider to the current user', async () => {
      const mockResult = {
        message: 'Provider google linked successfully',
        code: 0,
      };
      (authClient.send as jest.Mock).mockReturnValue(of(mockResult));

      const user = { userId: 'user-1', email: 'test@test.com', name: 'Test', profileId: 'p1', exp: 0, iat: 0 };
      const linkRequest = {
        provider: 'google' as any,
        providerUserId: 'google-123',
      };
      const result = await controller.linkProvider(linkRequest, user);

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.LinkProvider },
        { ...linkRequest, userId: 'user-1' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on error', async () => {
      (authClient.send as jest.Mock).mockImplementation(() => {
        throw new Error('link error');
      });

      const user = { userId: 'user-1', email: 'test@test.com', name: 'Test', profileId: 'p1', exp: 0, iat: 0 };
      const linkRequest = {
        provider: 'google' as any,
        providerUserId: 'google-123',
      };
      await expect(
        controller.linkProvider(linkRequest, user)
      ).rejects.toThrow(HttpException);
    });
  });

  describe('unlinkProvider', () => {
    it('should unlink a provider from the current user', async () => {
      const mockResult = {
        message: 'Provider google unlinked successfully',
        code: 0,
      };
      (authClient.send as jest.Mock).mockReturnValue(of(mockResult));

      const user = { userId: 'user-1', email: 'test@test.com', name: 'Test', profileId: 'p1', exp: 0, iat: 0 };
      const unlinkRequest = { provider: 'google' as any };
      const result = await controller.unlinkProvider(unlinkRequest, user);

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.UnlinkProvider },
        { ...unlinkRequest, userId: 'user-1' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on error', async () => {
      (authClient.send as jest.Mock).mockImplementation(() => {
        throw new Error('unlink error');
      });

      const user = { userId: 'user-1', email: 'test@test.com', name: 'Test', profileId: 'p1', exp: 0, iat: 0 };
      const unlinkRequest = { provider: 'google' as any };
      await expect(
        controller.unlinkProvider(unlinkRequest, user)
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getLinkedProviders', () => {
    it('should return linked providers for the current user', async () => {
      const mockResult = {
        message: 'Linked providers retrieved',
        code: 0,
        data: [{ provider: 'google', providerEmail: 'test@gmail.com' }],
      };
      (authClient.send as jest.Mock).mockReturnValue(of(mockResult));

      const user = { userId: 'user-1', email: 'test@test.com', name: 'Test', profileId: 'p1', exp: 0, iat: 0 };
      const result = await controller.getLinkedProviders(user);

      expect(authClient.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.GetLinkedProviders },
        { userId: 'user-1' }
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on error', async () => {
      (authClient.send as jest.Mock).mockImplementation(() => {
        throw new Error('providers error');
      });

      const user = { userId: 'user-1', email: 'test@test.com', name: 'Test', profileId: 'p1', exp: 0, iat: 0 };
      await expect(
        controller.getLinkedProviders(user)
      ).rejects.toThrow(HttpException);
    });
  });
});
