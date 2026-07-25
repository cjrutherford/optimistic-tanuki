import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthCommands, RoleCommands } from '@optimistic-tanuki/constants';
import { AuthGuard } from './auth.guard';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { JwtService } from '@nestjs/jwt';

describe('AuthGuard', () => {
  let authGuard: AuthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientProxy: any;
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  let permissionsClient: any;

  const mockUserDetails = {
    userId: '123450',
    email: 'test@example.com',
    name: 'Test User',
    iat: 1234567890,
    exp: 1234567890,
    profileId: 'aslkdjfla',
  };

  beforeEach(() => {
    reflector = new Reflector(); // Create a Reflector instance
    reflector.getAllAndOverride = jest.fn().mockReturnValue(false); // Default to non-public route
    clientProxy = {
      send: jest.fn().mockReturnValue(of({})),
    };
    permissionsClient = {
      send: jest.fn().mockReturnValue(of([])),
    };
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue(mockUserDetails),
      decode: jest.fn(), // Add decode mock if it's used elsewhere
    } as unknown as JwtService; // Cast to JwtService to satisfy type checking

    authGuard = new AuthGuard(
      clientProxy,
      reflector,
      jwtService,
      permissionsClient
    );
  });

  describe('canActivate', () => {
    it('should return true if the user is authenticated', async () => {
      // Mock ExecutionContext and Reflector to simulate an authenticated user
      clientProxy.send = jest.fn().mockReturnValue(of({ isValid: true }));
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockUserDetails); // Ensure verifyAsync resolves

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token', // Simulate a valid token
            },
          }),
        }),
        getHandler: jest.fn(), // Mock getHandler
        getClass: jest.fn(), // Mock getClass
      } as unknown as jest.Mocked<ExecutionContext>;

      const canActivate = await authGuard.canActivate(context);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.Validate },
        { token: 'valid-token', userId: mockUserDetails.userId }
      );
      expect(canActivate).toBe(true); // Assuming your guard validates 'valid-token'
    });

    it('should throw UnauthorizedException if no authorization header is provided', async () => {
      // Mock ExecutionContext to simulate an unauthenticated user (no token)
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {}, // No authorization header
          }),
        }),
        getHandler: jest.fn(), // Mock getHandler
        getClass: jest.fn(), // Mock getClass
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).rejects.toThrowError(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException if authorization header is present but token is missing', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer', // No token after Bearer
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).rejects.toThrowError(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      clientProxy.send = jest.fn().mockReturnValue(of({ isValid: false }));
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockUserDetails); // Still resolves, but authService says invalid

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer invalid-token', // Simulate an invalid token
            },
          }),
        }),
        getHandler: jest.fn(), // Mock getHandler
        getClass: jest.fn(), // Mock getClass
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).rejects.toThrowError(
        UnauthorizedException
      );
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('invalid-token');
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.Validate },
        { token: 'invalid-token', userId: mockUserDetails.userId }
      );
    });

    it('should throw UnauthorizedException if jwtService.verifyAsync rejects', async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid JWT')
      );
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer malformed-token',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).rejects.toThrowError(
        UnauthorizedException
      );
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('malformed-token');
    });

    it('should throw UnauthorizedException if introspectToken returns a nullish value', async () => {
      clientProxy.send = jest.fn().mockReturnValue(of(null));
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockUserDetails);

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).rejects.toThrowError(
        UnauthorizedException
      );
    });

    it('rejects a non-owner attempting to claim the owner-console scope', async () => {
      clientProxy.send = jest.fn().mockReturnValue(of({ isValid: true }));
      permissionsClient.send = jest.fn().mockReturnValue(of([]));
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token',
              'x-ot-appscope': 'owner-console',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      expect(permissionsClient.send).toHaveBeenCalledWith(
        { cmd: RoleCommands.GetUserRoles },
        { profileId: mockUserDetails.profileId, appScope: 'owner-console' }
      );
    });

    it('allows the owner-console role in the owner-console scope', async () => {
      clientProxy.send = jest.fn().mockReturnValue(of({ isValid: true }));
      permissionsClient.send = jest
        .fn()
        .mockReturnValue(of([{ role: { name: 'owner_console_owner' } }]));
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token',
              'x-ot-appscope': 'owner-console',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).resolves.toBe(true);
      expect(permissionsClient.send).toHaveBeenCalledWith(
        { cmd: RoleCommands.GetUserRoles },
        { profileId: mockUserDetails.profileId, appScope: 'owner-console' }
      );
    });

    it('allows a global administrator to use the global scope', async () => {
      clientProxy.send = jest.fn().mockReturnValue(of({ isValid: true }));
      permissionsClient.send = jest
        .fn()
        .mockReturnValue(of([{ role: { name: 'global_admin' } }]));
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token',
              'x-ot-appscope': 'global',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).resolves.toBe(true);
    });

    it('fails closed when privileged role lookup fails', async () => {
      clientProxy.send = jest.fn().mockReturnValue(of({ isValid: true }));
      permissionsClient.send = jest
        .fn()
        .mockReturnValue(
          throwError(() => new Error('permissions unavailable'))
        );
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token',
              'x-ot-appscope': 'owner-console',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('does not look up owner roles for ordinary app scopes', async () => {
      clientProxy.send = jest.fn().mockReturnValue(of({ isValid: true }));
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token',
              'x-ot-appscope': 'business-site',
            },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as jest.Mocked<ExecutionContext>;

      await expect(authGuard.canActivate(context)).resolves.toBe(true);
      expect(permissionsClient.send).not.toHaveBeenCalled();
    });
  });
});
