import {
  EnableMultiFactorRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  ValidateTokenRequest,
} from '@optimistic-tanuki/models';
import { Test, TestingModule } from '@nestjs/testing';

import {
  AuthCommands,
  ProductCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';
import { AuthenticationController } from './authentication.controller';
import { ClientProxy } from '@nestjs/microservices';
import { ForbiddenException, HttpException, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import {
  LoginAccountBootstrapService,
  RegisterAccountBootstrapService,
} from '@optimistic-tanuki/auth-feature-account-bootstrap';
import { AuthGuard } from '../../auth/auth.guard';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.controller';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { DEFAULT_APP_REGISTRY } from '@optimistic-tanuki/app-registry-backend';

describe('AuthenticationController', () => {
  let controller: AuthenticationController;
  let clientProxy: ClientProxy;
  let profileService: ClientProxy;
  let storeService: ClientProxy;
  let roleInitService: { processNow: jest.Mock };
  let loginBootstrap: { login: jest.Mock };
  let registerBootstrap: { register: jest.Mock };

  beforeEach(async () => {
    clientProxy = {
      send: jest.fn().mockReturnValue(of(true)),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    profileService = {
      send: jest
        .fn()
        .mockReturnValue(of([{ id: 'profile-1', appScope: 'test' }])),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    storeService = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    roleInitService = {
      processNow: jest.fn().mockResolvedValue(undefined),
    };
    loginBootstrap = {
      login: jest.fn().mockResolvedValue(true),
    };
    registerBootstrap = {
      register: jest.fn().mockResolvedValue({
        data: {
          user: { id: '12345', firstName: 'Test', lastName: 'Testerson' },
        },
      }),
    };

    const moduleRef = Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        {
          provide: 'AUTHENTICATION_SERVICE',
          useValue: clientProxy,
        },
        {
          provide: 'PROFILE_SERVICE',
          useValue: profileService,
        },
        {
          provide: 'STORE_SERVICE',
          useValue: storeService,
        },
        {
          provide: RoleInitService,
          useValue: roleInitService,
        },
        {
          provide: LoginAccountBootstrapService,
          useValue: loginBootstrap,
        },
        {
          provide: RegisterAccountBootstrapService,
          useValue: registerBootstrap,
        },
        Logger,
        {
          provide: GATEWAY_APP_REGISTRY,
          useValue: {
            version: '1',
            generatedAt: '2026-07-13T00:00:00Z',
            apps: [
              {
                appId: 'client-interface',
                name: 'Optimistic Tanuki',
                domain: 'optimistic-tanuki.com',
                uiBaseUrl: 'https://optimistic-tanuki.com',
                apiBaseUrl: 'https://optimistic-tanuki.com/api',
                appType: 'client',
                visibility: 'public',
                authEmail: {
                  enabled: true,
                  from: 'no-reply@optimistic-tanuki.com',
                },
              },
              {
                appId: 'local-hub',
                name: 'Towne Square',
                domain: 'towne-square.com',
                uiBaseUrl: 'https://towne-square.com',
                apiBaseUrl: 'https://towne-square.com/api',
                appType: 'client',
                visibility: 'public',
                authEmail: {
                  enabled: true,
                  from: 'no-reply@towne-square.com',
                },
              },
              {
                appId: 'system-configurator',
                name: 'HAI Computer',
                domain: 'hopefulaspirationsindustries.com',
                uiBaseUrl: 'https://hardware.hopefulaspirationsindustries.com',
                apiBaseUrl:
                  'https://hardware.hopefulaspirationsindustries.com/api',
                appType: 'client',
                visibility: 'public',
                authEmail: {
                  enabled: true,
                  from: 'no-reply@hopefulaspirationsindustries.com',
                },
              },
              {
                appId: 'opportunity-compass',
                name: 'Opportunity Compass',
                domain: 'christopherrutherford.net',
                uiBaseUrl: 'https://opportunities.example.com',
                apiBaseUrl: 'https://opportunities.example.com/api',
                appType: 'client',
                visibility: 'public',
                authEmail: {
                  enabled: true,
                  from: 'no-reply@christopherrutherford.net',
                },
              },
              {
                appId: 'fin-commander',
                name: 'Fin Commander',
                domain: 'christopherrutherford.net',
                uiBaseUrl: 'https://finance.example.com',
                apiBaseUrl: 'https://finance.example.com/api',
                appType: 'client',
                visibility: 'public',
                authEmail: {
                  enabled: true,
                  from: 'no-reply@christopherrutherford.net',
                },
              },
              ...DEFAULT_APP_REGISTRY.apps.filter(
                (app) => app.appId === 'configurable-client'
              ),
            ],
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) });

    const module: TestingModule = await moduleRef.compile();

    controller = module.get<AuthenticationController>(AuthenticationController);
  });

  it('allows logout to clear an expired browser session', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller.logoutUser)).toBe(
      true
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('exposes guardian-authorized continuation retry as a public rate-limited control', async () => {
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ sent: false }));

    await expect(
      controller.resendGuardianApplicantContinuation({
        token: 'guardian-control-token',
      })
    ).resolves.toEqual({ sent: false });

    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        controller.resendGuardianApplicantContinuation
      )
    ).toBe(true);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.ResendGuardianApplicantContinuation },
      { token: 'guardian-control-token' }
    );
  });

  it('returns the guard-verified identity for a browser session without exposing a token', async () => {
    expect(
      controller.currentSession({
        userId: 'user-1',
        email: 'session@example.test',
        name: 'Session User',
        profileId: 'profile-1',
      } as any)
    ).toEqual({
      data: {
        userId: 'user-1',
        email: 'session@example.test',
        name: 'Session User',
        profileId: 'profile-1',
      },
    });
  });

  it('confirms email verification without invoking the session-issuing email action', async () => {
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ message: 'Email verified', code: 0 })
    );

    await expect(
      controller.confirmEmailVerification({ token: 'verification-token' })
    ).resolves.toEqual({ message: 'Email verified', code: 0 });
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.ConfirmEmailVerification },
      { token: 'verification-token' }
    );
    expect(clientProxy.send).not.toHaveBeenCalledWith(
      { cmd: AuthCommands.ConsumeEmailAuthAction },
      expect.anything()
    );
  });

  it('should login user', async () => {
    const loginRequest: LoginRequest = {
      email: 'test@test.com',
      password: 'test',
    };
    await expect(
      controller.loginUser(
        loginRequest,
        'client-interface',
        'client-interface',
        'https://optimistic-tanuki.com',
        undefined,
        undefined,
        { headers: { host: 'optimistic-tanuki.com' } } as any
      )
    ).resolves.toBe(true);
    expect(loginBootstrap.login).toHaveBeenCalledWith(
      loginRequest,
      'client-interface',
      'client-interface'
    );
  });

  it('uses a session-free eligibility precheck and scopes the issued login token', async () => {
    const loginRequest = {
      email: 'adult@example.invalid',
      password: 'password',
      dateOfBirth: '1990-01-01',
    } as any;
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ code: 0, data: { eligibilityChecked: true } })
    );
    loginBootstrap.login.mockResolvedValueOnce({
      code: 0,
      data: { newToken: 'client-scoped-token' },
    });

    await expect(
      controller.loginUser(
        loginRequest,
        'client-interface',
        'client-interface',
        'https://optimistic-tanuki.com',
        undefined,
        undefined,
        { headers: { host: 'optimistic-tanuki.com' } } as any
      )
    ).resolves.toEqual({
      code: 0,
      data: { newToken: 'client-scoped-token' },
    });

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Login },
      expect.objectContaining({
        appId: 'client-interface',
        deferSession: true,
        ageAssessment: expect.objectContaining({ dateOfBirth: '1990-01-01' }),
      })
    );
    expect(loginBootstrap.login).toHaveBeenCalledWith(
      loginRequest,
      'client-interface',
      'client-interface'
    );
  });

  it('binds a registered origin to an app-specific request host when available', () => {
    expect(
      (controller as any).resolveRegistrationAppId(
        'client-interface',
        'client-interface',
        'https://optimistic-tanuki.com',
        'towne-square.com'
      )
    ).toBeNull();
    expect(
      (controller as any).resolveRegistrationAppId(
        'local-hub',
        'local-hub',
        'https://towne-square.com',
        'towne-square.com'
      )
    ).toBe('local-hub');
  });

  it('does not return the private age expiry field in a public registration response', async () => {
    const dateOfBirth = new Date();
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 30);
    registerBootstrap.register.mockResolvedValue({
      data: {
        user: {
          id: 'new-user',
          emailVerifiedAt: new Date(),
          ageEligibilityEndsAt: '2044-01-01',
        },
      },
    });

    const result = await controller.registerUser(
      {
        email: 'person@example.invalid',
        fn: 'Person',
        ln: 'Example',
        password: 'password',
        confirm: 'password',
        dateOfBirth: dateOfBirth.toISOString().slice(0, 10),
      } as any,
      'client-interface',
      'client-interface',
      'https://optimistic-tanuki.com',
      { headers: { host: 'optimistic-tanuki.com' } } as any
    );

    expect(result.data.user).not.toHaveProperty('ageEligibilityEndsAt');
    expect(registerBootstrap.register).toHaveBeenCalledWith(
      expect.not.objectContaining({ dateOfBirth: expect.anything() }),
      'client-interface',
      'adult'
    );
  });

  it('blocks an under-13 registration before account bootstrap', async () => {
    await expect(
      controller.registerUser(
        { dateOfBirth: '2016-01-01' } as any,
        'client-interface',
        'client-interface'
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(registerBootstrap.register).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials before invoking account bootstrap', async () => {
    const loginRequest: LoginRequest = {
      email: 'invalid@test.com',
      password: 'wrong-password',
    };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Invalid password');
    });

    await expect(
      controller.loginUser(loginRequest, 'test')
    ).rejects.toMatchObject({
      status: 500,
    });
    expect(loginBootstrap.login).not.toHaveBeenCalled();
  });

  it('authenticates before invoking account bootstrap', async () => {
    const callOrder: string[] = [];
    (clientProxy.send as jest.Mock).mockImplementation(
      (pattern: { cmd: string }) => {
        callOrder.push(pattern.cmd);
        return of({ code: 0, data: { newToken: 'authenticated-token' } });
      }
    );
    loginBootstrap.login.mockImplementation(async () => {
      callOrder.push('bootstrap');
      return { code: 0, data: { newToken: 'authenticated-token' } };
    });

    await expect(
      controller.loginUser(
        { email: 'valid@test.com', password: 'correct-password' },
        'test'
      )
    ).resolves.toEqual({ code: 0, data: { newToken: 'authenticated-token' } });
    expect(callOrder).toEqual([AuthCommands.Login, 'bootstrap']);
  });

  it('returns bounded service unavailability when bootstrap does not emit', async () => {
    jest.useFakeTimers();
    loginBootstrap.login.mockReturnValueOnce(new Promise(() => undefined));

    const loginPromise = controller.loginUser(
      { email: 'valid@test.com', password: 'correct-password' },
      'test'
    );
    const rejection = expect(loginPromise).rejects.toMatchObject({
      status: 503,
    });

    await jest.advanceTimersByTimeAsync(5000);
    await rejection;
    jest.useRealTimers();
  });

  it('preserves the existing internal-error convention for a rejected bootstrap', async () => {
    loginBootstrap.login.mockRejectedValueOnce(
      new Error('profile service failed')
    );

    await expect(
      controller.loginUser(
        { email: 'valid@test.com', password: 'correct-password' },
        'test'
      )
    ).rejects.toMatchObject({
      status: 500,
      message: 'Login failed: profile service failed',
    });
  });

  it('does not log passwords or issued tokens during login', async () => {
    const debugSpy = jest.spyOn(Logger.prototype, 'debug');
    const errorSpy = jest.spyOn(Logger.prototype, 'error');
    const password = 'correct-password';
    const token = 'authenticated-token';
    loginBootstrap.login.mockResolvedValueOnce({
      code: 0,
      data: { newToken: token },
    });
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ code: 0, data: { newToken: token } })
    );

    await controller.loginUser({ email: 'valid@test.com', password }, 'test');

    expect(debugSpy.mock.calls.flat().join(' ')).not.toContain(password);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(password);
    expect(debugSpy.mock.calls.flat().join(' ')).not.toContain(token);
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(token);
    debugSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('contains a cookie-mode login token in an HttpOnly gateway cookie', async () => {
    const response = { cookie: jest.fn() };
    loginBootstrap.login.mockResolvedValueOnce({
      data: { newToken: 'browser-session-token', profileId: 'profile-1' },
    });

    await expect(
      controller.loginUser(
        { email: 'test@test.com', password: 'test' },
        'client-interface',
        'client-interface',
        'https://optimistic-tanuki.com',
        'cookie',
        response as any,
        { headers: { host: 'optimistic-tanuki.com' } } as any
      )
    ).resolves.toEqual({ data: { profileId: 'profile-1' } });

    expect(response.cookie).toHaveBeenCalledWith(
      'ot_session',
      'browser-session-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
    );
  });

  it('clears browser sessions with the same site-wide cookie scope', async () => {
    const response = { clearCookie: jest.fn() };

    await expect(
      controller.logoutUser({}, { cookies: {} } as any, response as any)
    ).resolves.toEqual({ success: true });

    expect(response.clearCookie).toHaveBeenCalledWith(
      'ot_session',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      })
    );
  });

  it('honours an explicit insecure cookie setting for HTTP review runtimes', async () => {
    const original = process.env.AUTH_COOKIE_SECURE;
    process.env.AUTH_COOKIE_SECURE = 'false';
    const response = { cookie: jest.fn() };
    loginBootstrap.login.mockResolvedValueOnce({
      data: { newToken: 'review-token' },
    });

    try {
      await controller.loginUser(
        { email: 'test@test.com', password: 'test' },
        'client-interface',
        'client-interface',
        'https://optimistic-tanuki.com',
        'cookie',
        response as any,
        { headers: { host: 'optimistic-tanuki.com' } } as any
      );
    } finally {
      if (original === undefined) delete process.env.AUTH_COOKIE_SECURE;
      else process.env.AUTH_COOKIE_SECURE = original;
    }

    expect(response.cookie).toHaveBeenCalledWith(
      'ot_session',
      'review-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      })
    );
  });

  it('returns only non-secret session identity for an authenticated session', () => {
    expect(
      controller.currentSession({
        userId: 'user-1',
        email: 'user@example.com',
        name: 'User',
        profileId: 'profile-1',
      } as any)
    ).toEqual({
      data: {
        userId: 'user-1',
        email: 'user@example.com',
        name: 'User',
        profileId: 'profile-1',
      },
    });
  });

  it('should auto-create app-scoped profile for cross-app users and login with it', async () => {
    const loginRequest: LoginRequest = {
      email: 'cross@app.com',
      password: 'test',
    };

    await expect(
      controller.loginUser(
        loginRequest,
        'opportunity-compass',
        'opportunity-compass',
        'https://opportunities.example.com',
        undefined,
        undefined,
        { headers: { host: 'opportunities.example.com' } } as any
      )
    ).resolves.toBe(true);

    expect(loginBootstrap.login).toHaveBeenCalledWith(
      loginRequest,
      'opportunity-compass',
      'opportunity-compass'
    );
  });

  it('should throw HttpException if loginUser fails', async () => {
    const loginRequest: LoginRequest = {
      email: 'fail@test.com',
      password: 'fail',
    };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('login error');
    });
    loginBootstrap.login.mockRejectedValueOnce(new Error('login error'));
    await expect(controller.loginUser(loginRequest, 'test')).rejects.toThrow(
      HttpException
    );
  });

  describe('issueTokenForProfile', () => {
    const currentUser = {
      userId: 'user-1',
      email: 'u@example.com',
      name: 'U',
      profileId: 'profile-current',
    } as any;
    const browserResponse = () => ({ cookie: jest.fn() }) as any;

    it('issues a same-profile refresh after verifying ownership, even without app scope', async () => {
      const response = browserResponse();
      profileService.send = jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'profile-current',
            userId: 'user-1',
            appScope: 'leads-app',
          },
        ])
      ) as any;
      clientProxy.send = jest.fn().mockReturnValueOnce(
        of({ data: { newToken: 'fresh-token' } })
      ) as any;

      await expect(
        controller.issueTokenForProfile(currentUser, {}, undefined, 'cookie', response)
      ).resolves.toEqual({ data: {} });

      expect(profileService.send).toHaveBeenCalledWith(
        { cmd: ProfileCommands.GetAll },
        { where: { userId: 'user-1' } }
      );
      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.Issue },
        { userId: 'user-1', profileId: 'profile-current', appId: null }
      );
      expect(response.cookie).toHaveBeenCalledWith(
        'ot_session',
        'fresh-token',
        expect.any(Object)
      );
    });

    it('allows an owned current-app profile and a global profile in cookie mode', async () => {
      const response = browserResponse();
      profileService.send = jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'profile-current',
            userId: 'user-1',
            appScope: 'client-interface',
          },
          {
            id: 'profile-global',
            userId: 'user-1',
            appScope: 'global',
          },
        ])
      ) as any;
      clientProxy.send = jest.fn().mockReturnValueOnce(
        of({ data: { newToken: 'global-token' } })
      ) as any;

      await expect(
        controller.issueTokenForProfile(
          currentUser,
          { profileId: 'profile-global' },
          'leads-app',
          'cookie',
          response
        )
      ).resolves.toEqual({ data: {} });

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.Issue },
        { userId: 'user-1', profileId: 'profile-global', appId: 'opportunity-compass' }
      );
      expect(response.cookie).toHaveBeenCalledWith(
        'ot_session',
        'global-token',
        expect.any(Object)
      );
    });

    it('allows an owned profile whose app scope matches the registered current app', async () => {
      profileService.send = jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'lead-profile',
            userId: 'user-1',
            appScope: 'opportunity-compass',
          },
        ])
      ) as any;

      await expect(
        controller.issueTokenForProfile(
          currentUser,
          { profileId: 'lead-profile' },
          'leads-app'
        )
      ).resolves.toEqual(true);
    });

    it('allows an owned app-scope alias after canonicalizing it', async () => {
      const user = { ...currentUser, profileId: 'global-profile' };
      profileService.send = jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'global-profile',
            userId: 'user-1',
            appScope: 'global',
          },
          {
            id: 'lead-profile',
            userId: 'user-1',
            appScope: 'opportunity-compass',
          },
        ])
      ) as any;
      clientProxy.send = jest.fn().mockReturnValueOnce(
        of({ data: { newToken: 'lead-token' } })
      ) as any;

      await expect(
        controller.issueTokenForProfile(
          user,
          { profileId: 'lead-profile' },
          'leads-app'
        )
      ).resolves.toEqual({ data: { newToken: 'lead-token' } });

      expect(clientProxy.send).toHaveBeenCalledWith(
        { cmd: AuthCommands.Issue },
        { userId: 'user-1', profileId: 'lead-profile', appId: 'opportunity-compass' }
      );
    });

    it('allows a null-scope profile with a registered app scope', async () => {
      profileService.send = jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'profile-null-scope',
            userId: 'user-1',
            appScope: null,
          },
        ])
      ) as any;
      clientProxy.send = jest.fn().mockReturnValueOnce(
        of({ data: { newToken: 'null-scope-token' } })
      ) as any;

      await expect(
        controller.issueTokenForProfile(
          currentUser,
          { profileId: 'profile-null-scope' },
          'leads-app'
        )
      ).resolves.toEqual({ data: { newToken: 'null-scope-token' } });
    });

    it.each([
      ['another user profile', 'leads-app', 'other-user'],
      ['a foreign app-scope profile', 'leads-app', 'user-1'],
    ])('denies %s before issuing or setting a cookie', async (reason, scope, ownerId) => {
      const response = browserResponse();
      const profileScope = reason === 'a foreign app-scope profile' ? 'fin-commander' : 'leads-app';
      profileService.send = jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'profile-target',
            userId: ownerId,
            appScope: profileScope,
          },
        ])
      ) as any;

      await expect(
        controller.issueTokenForProfile(
          currentUser,
          { profileId: 'profile-target' },
          scope,
          'cookie',
          response
        )
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(clientProxy.send).not.toHaveBeenCalledWith(
        { cmd: AuthCommands.Issue },
        expect.anything()
      );
      expect(response.cookie).not.toHaveBeenCalled();
    });

    it.each([undefined, 'not-registered'])('denies a different profile when scope is %s', async (scope) => {
      const response = browserResponse();
      profileService.send = jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'profile-target',
            userId: 'user-1',
            appScope: 'leads-app',
          },
        ])
      ) as any;

      await expect(
        controller.issueTokenForProfile(
          currentUser,
          { profileId: 'profile-target' },
          scope,
          'cookie',
          response
        )
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(clientProxy.send).not.toHaveBeenCalledWith(
        { cmd: AuthCommands.Issue },
        expect.anything()
      );
      expect(response.cookie).not.toHaveBeenCalled();
    });

    it('rejects a current-profile refresh if that profile is not owned by the authenticated user', async () => {
      const response = browserResponse();
      profileService.send = jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'profile-current',
            userId: 'someone-else',
            appScope: 'client-interface',
          },
        ])
      ) as any;

      await expect(
        controller.issueTokenForProfile(currentUser, {}, 'leads-app', 'cookie', response)
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(clientProxy.send).not.toHaveBeenCalledWith(
        { cmd: AuthCommands.Issue },
        expect.anything()
      );
      expect(response.cookie).not.toHaveBeenCalled();
    });
  });

  it('should register user', async () => {
    const registerRequest: RegisterRequest = {
      fn: 'Test',
      ln: 'Testerson',
      password: 'test',
      email: 'test@test.com',
      confirm: 'test',
      bio: "I'm just a test, and life is a nightmare.",
    };
    const mockResult = {
      data: {
        user: {
          id: '12345',
          profileId: '54321',
          firstName: 'Test',
          lastName: 'Testerson',
        },
      },
    };
    registerBootstrap.register.mockResolvedValueOnce(mockResult);
    await expect(
      controller.registerUser(
        registerRequest,
        'system-configurator',
        'system-configurator',
        'https://hardware.hopefulaspirationsindustries.com'
      )
    ).resolves.toEqual({
      ...mockResult,
      data: { ...mockResult.data, verificationPending: true },
    });
    expect(registerBootstrap.register).toHaveBeenCalledWith(
      registerRequest,
      'system-configurator',
      undefined
    );
  });

  it('reports guardian email delivery failure without claiming it was sent', async () => {
    const request = {
      dateOfBirth: '2010-06-01',
      email: 'teen@example.com',
      guardianEmail: 'guardian@example.com',
    } as RegisterRequest & { guardianEmail: string };
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ pending: true, sent: false })
    );

    await expect(
      controller.registerUser(
        request,
        'client-interface',
        'client-interface',
        'https://optimistic-tanuki.com',
        { headers: { host: 'optimistic-tanuki.com' } } as any
      )
    ).resolves.toEqual({
      message: 'Guardian permission request is pending, but the email could not be sent.',
      data: {
        guardianConsentPending: true,
        request: { pending: true, sent: false },
      },
    });
    expect(registerBootstrap.register).not.toHaveBeenCalled();
  });

  it('rejects public owner-console registration in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    await expect(
      controller.registerUser(
        {
          fn: 'Owner',
          ln: 'User',
          email: 'owner@example.com',
          password: 'OwnerPassword!123',
          confirm: 'OwnerPassword!123',
          bio: '',
        },
        'owner-console',
        'owner-console'
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(registerBootstrap.register).not.toHaveBeenCalled();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('sends verification after a successful app registration', async () => {
    const requestSpy = jest
      .spyOn(controller, 'requestEmailAction')
      .mockResolvedValue({ accepted: true });
    const registration = {
      fn: 'System',
      ln: 'Builder',
      email: 'builder@example.com',
      password: 'long-password',
      confirm: 'long-password',
      bio: '',
    };

    await expect(
      controller.registerUser(
        registration,
        'system-configurator',
        'system-configurator',
        'https://hardware.hopefulaspirationsindustries.com'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ verificationPending: true }),
      })
    );

    expect(requestSpy).toHaveBeenCalledWith(
      'system-configurator',
      'verification',
      { email: 'builder@example.com', returnPath: '/' }
    );
  });

  it('registers configurable-client through its explicit email authentication configuration', async () => {
    const requestSpy = jest
      .spyOn(controller, 'requestEmailAction')
      .mockResolvedValue({ accepted: true });
    const registration: RegisterRequest = {
      fn: 'Configurable',
      ln: 'Owner',
      email: 'configurable-owner@example.com',
      password: 'long-password',
      confirm: 'long-password',
      bio: '',
    };

    await expect(
      controller.registerUser(
        registration,
        'configurable-client',
        'configurable-client',
        DEFAULT_APP_REGISTRY.apps.find((app) => app.appId === 'configurable-client')!.uiBaseUrl
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ verificationPending: true }),
      })
    );

    expect(registerBootstrap.register).toHaveBeenCalledWith(
      registration,
      'configurable-client',
      undefined
    );
    expect(requestSpy).toHaveBeenCalledWith(
      'configurable-client',
      'verification',
      { email: registration.email, returnPath: '/' }
    );
  });

  it('keeps an unverified registration usable for a resend when delivery fails', async () => {
    jest
      .spyOn(controller, 'requestEmailAction')
      .mockRejectedValue(new Error('SMTP rejected the sender alias'));

    await expect(
      controller.registerUser(
        {
          fn: 'Delivery',
          ln: 'Retry',
          email: 'retry@example.com',
          password: 'long-password',
          confirm: 'long-password',
          bio: '',
        },
        'system-configurator',
        'system-configurator',
        'https://hardware.hopefulaspirationsindustries.com'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ verificationPending: true }),
      })
    );
  });

  it('rejects registration when no configured application can be resolved', async () => {
    await expect(
      controller.registerUser(
        {
          fn: 'Unroutable',
          ln: 'User',
          email: 'unroutable@example.com',
          password: 'long-password',
          confirm: 'long-password',
          bio: '',
        },
        'unknown-app'
      )
    ).rejects.toThrow('Email authentication is not configured');

    expect(registerBootstrap.register).not.toHaveBeenCalled();
  });

  it('resolves the registry sender from the browser origin when app headers are absent', async () => {
    const requestSpy = jest
      .spyOn(controller, 'requestEmailAction')
      .mockResolvedValue({ accepted: true });

    await controller.registerUser(
      {
        fn: 'Origin',
        ln: 'Resolved',
        email: 'origin@example.com',
        password: 'long-password',
        confirm: 'long-password',
        bio: '',
      },
      null as any,
      undefined,
      'https://hardware.hopefulaspirationsindustries.com'
    );

    expect(requestSpy).toHaveBeenCalledWith(
      'system-configurator',
      'verification',
      { email: 'origin@example.com', returnPath: '/' }
    );
  });

  it('does not send verification for an already verified development seed user', async () => {
    registerBootstrap.register.mockResolvedValueOnce({
      data: {
        user: {
          id: 'seed-user',
          emailVerifiedAt: '2026-07-14T00:00:00.000Z',
        },
      },
    });
    const requestSpy = jest.spyOn(controller, 'requestEmailAction');

    await controller.registerUser(
      {
        fn: 'Seed',
        ln: 'User',
        email: 'seed@example.test',
        password: 'long-password',
        confirm: 'long-password',
        bio: '',
      },
      'system-configurator',
      'system-configurator',
      'https://hardware.hopefulaspirationsindustries.com'
    );

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('requests a magic link using trusted registry email metadata', async () => {
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ accepted: true, sent: true })
    );

    await expect(
      controller.requestEmailAction('system-configurator', 'magic-link', {
        email: 'person@example.com',
        returnPath: '/review',
      })
    ).resolves.toEqual({ accepted: true });

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.RequestEmailAuthAction },
      expect.objectContaining({
        email: 'person@example.com',
        context: expect.objectContaining({
          appId: 'system-configurator',
          from: 'no-reply@hopefulaspirationsindustries.com',
          returnPath: '/review',
        }),
      })
    );
  });

  it('rejects email actions for unknown application ids', async () => {
    await expect(
      controller.requestEmailAction('unknown-app', 'verification', {
        email: 'person@example.com',
      })
    ).rejects.toThrow('Email authentication is not configured');
    expect(clientProxy.send).not.toHaveBeenCalled();
  });

  it('rejects email actions when email is missing', async () => {
    await expect(
      controller.requestEmailAction(
        'system-configurator',
        'verification',
        {} as { email: string }
      )
    ).rejects.toThrow('Email is required');
    expect(clientProxy.send).not.toHaveBeenCalled();
  });

  it('provisions minimum leads permissions during leads-app registration', async () => {
    const registerRequest: RegisterRequest = {
      fn: 'Lead',
      ln: 'User',
      password: 'test',
      email: 'lead@test.com',
      confirm: 'test',
      bio: '',
    };
    const mockResult = {
      data: {
        user: {
          id: 'lead-user',
          profileId: 'lead-profile',
          firstName: 'Lead',
          lastName: 'User',
        },
      },
    };

    registerBootstrap.register.mockResolvedValueOnce(mockResult);

    await expect(
      controller.registerUser(
        registerRequest,
        'leads-app',
        'leads-app',
        'https://opportunities.example.com'
      )
    ).resolves.toEqual({
      ...mockResult,
      data: { ...mockResult.data, verificationPending: true },
    });

    expect(registerBootstrap.register).toHaveBeenCalledWith(
      registerRequest,
      'leads-app',
      undefined
    );
  });

  it('claims owner access for the current app-scoped profile', async () => {
    (profileService.send as jest.Mock).mockReturnValueOnce(
      of([
        {
          id: 'profile-1',
          userId: 'user-1',
          appScope: 'business-site',
        },
      ])
    );

    const user = {
      userId: 'user-1',
      email: 'owner@example.com',
      profileId: 'profile-1',
    } as any;

    await expect(
      controller.claimOwnerAccess(user, 'business-site')
    ).resolves.toEqual({
      profileId: 'profile-1',
      appScope: 'business-site',
      ownerAccess: true,
    });

    expect(roleInitService.processNow).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeName: 'business-site',
        assignments: expect.arrayContaining([
          expect.objectContaining({ roleName: 'business_site_owner' }),
        ]),
      })
    );
    expect(storeService.send).not.toHaveBeenCalled();
  });

  it('does not grant configurable-client owner access at the app scope during login-time claiming', async () => {
    (profileService.send as jest.Mock).mockReturnValueOnce(
      of([
        {
          id: 'configurable-profile-1',
          userId: 'user-1',
          appScope: 'configurable-client',
        },
      ])
    );

    await expect(
      controller.claimOwnerAccess(
        {
          userId: 'user-1',
          email: 'owner@example.com',
          profileId: 'configurable-profile-1',
        } as any,
        'configurable-client'
      )
    ).resolves.toEqual({
      profileId: 'configurable-profile-1',
      appScope: 'configurable-client',
      ownerAccess: true,
    });

    const options = roleInitService.processNow.mock.calls[0][0];
    expect(options.scopeName).toBe('configurable-client');
    expect(options.assignments).not.toContainEqual(
      expect.objectContaining({ roleName: 'configurable_client_owner' })
    );
  });

  it('never lets an authenticated user self-grant global owner access', async () => {
    await expect(
      controller.claimOwnerAccess(
        {
          userId: 'user-1',
          email: 'member@example.com',
          profileId: 'profile-1',
        } as any,
        'owner-console'
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(roleInitService.processNow).not.toHaveBeenCalled();
  });

  it('does not create owner-global products before a business workspace exists', async () => {
    (profileService.send as jest.Mock).mockReturnValueOnce(
      of([
        {
          id: 'profile-1',
          userId: 'user-1',
          appScope: 'business-site',
        },
      ])
    );
    await controller.claimOwnerAccess(
      {
        userId: 'user-1',
        email: 'owner@example.com',
        profileId: 'profile-1',
      } as any,
      'business-site'
    );

    expect(storeService.send).not.toHaveBeenCalled();
  });

  it('provisions solo finance permissions during fin-commander registration', async () => {
    const registerRequest: RegisterRequest = {
      fn: 'Finance',
      ln: 'User',
      password: 'test',
      email: 'finance@test.com',
      confirm: 'test',
      bio: '',
    };
    const mockResult = {
      data: {
        user: {
          id: 'finance-user',
          profileId: 'finance-profile',
          firstName: 'Finance',
          lastName: 'User',
        },
      },
    };

    registerBootstrap.register.mockResolvedValueOnce(mockResult);

    await expect(
      controller.registerUser(
        registerRequest,
        'finance',
        'finance',
        'https://finance.example.com'
      )
    ).resolves.toEqual({
      ...mockResult,
      data: { ...mockResult.data, verificationPending: true },
    });

    expect(registerBootstrap.register).toHaveBeenCalledWith(
      registerRequest,
      'finance',
      undefined
    );
  });

  it('should throw HttpException if registerUser fails', async () => {
    const registerRequest: RegisterRequest = {
      fn: 'Test',
      ln: 'Testerson',
      password: 'fail',
      email: 'fail@test.com',
      confirm: 'fail',
      bio: 'fail',
    };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('register error');
    });
    registerBootstrap.register.mockRejectedValueOnce(
      new Error('register error')
    );
    await expect(
      controller.registerUser(registerRequest, 'test')
    ).rejects.toThrow(HttpException);
  });

  it('should reset password', async () => {
    const resetPasswordRequest: ResetPasswordRequest = {
      oldPass: 'test',
      newPass: 'test1',
      newConf: 'test1',
      email: 'test@test.com',
    };
    await expect(controller.resetPassword(resetPasswordRequest)).resolves.toBe(
      true
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.ResetPassword },
      resetPasswordRequest
    );
  });

  it('should throw HttpException if resetPassword fails', async () => {
    const resetPasswordRequest: ResetPasswordRequest = {
      oldPass: 'fail',
      newPass: 'fail',
      newConf: 'fail',
      email: 'fail@test.com',
    };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('reset error');
    });
    await expect(
      controller.resetPassword(resetPasswordRequest)
    ).rejects.toThrow(HttpException);
  });

  it('should enable MFA', async () => {
    const enableMfaRequest: EnableMultiFactorRequest = {
      userId: '123',
      password: 'test',
      initialTotp: '123456',
    };
    await expect(controller.enableMfa(enableMfaRequest)).resolves.toBe(true);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.EnableMultiFactor },
      enableMfaRequest
    );
  });

  it('should throw HttpException if enableMfa fails', async () => {
    const enableMfaRequest: EnableMultiFactorRequest = {
      userId: 'fail',
      password: 'fail',
      initialTotp: 'fail',
    };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('mfa error');
    });
    await expect(controller.enableMfa(enableMfaRequest)).rejects.toThrow(
      HttpException
    );
  });

  it('should validate token', async () => {
    const validateTokenRequest: ValidateTokenRequest = {
      token: 'test-token',
      userId: 'userId',
    };
    await expect(controller.validateToken(validateTokenRequest)).resolves.toBe(
      true
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Validate },
      { ...validateTokenRequest, appId: null }
    );
  });

  it('should exchange a token for an existing app-scoped profile', async () => {
    (profileService.send as jest.Mock).mockReturnValueOnce(
      of([
        {
          id: 'profile-target',
          userId: 'user-1',
          appScope: 'hai',
        },
      ])
    );
    (clientProxy.send as jest.Mock)
      .mockReturnValueOnce(of(true))
      .mockReturnValueOnce(of({ data: { newToken: 'target-token' } }));

    await expect(
      controller.exchangeTokenForApp(
        {
          userId: 'user-1',
          email: 'user@example.com',
          name: 'User',
          profileId: 'profile-source',
          exp: 1,
          iat: 1,
        },
        { targetAppId: 'hai' }
      )
    ).resolves.toEqual({
      token: 'target-token',
      targetAppId: 'hai',
      profileId: 'profile-target',
    });
    expect(profileService.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.GetAll },
      { where: { userId: 'user-1' } }
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Issue },
      { userId: 'user-1', profileId: 'profile-target', appId: 'hai' }
    );
  });

  it('should create a target app profile before exchanging when missing', async () => {
    (profileService.send as jest.Mock)
      .mockReturnValueOnce(
        of([
          {
            id: 'profile-global',
            userId: 'user-1',
            profileName: 'User',
            avatarUrl: 'avatar.png',
            bio: 'Bio',
            appScope: 'global',
          },
        ])
      )
      .mockReturnValueOnce(
        of({
          id: 'profile-target',
          userId: 'user-1',
          appScope: 'forgeofwill',
        })
      );
    (clientProxy.send as jest.Mock)
      .mockReturnValueOnce(of(true))
      .mockReturnValueOnce(of({ data: { newToken: 'target-token' } }));

    await expect(
      controller.exchangeTokenForApp(
        {
          userId: 'user-1',
          email: 'user@example.com',
          name: 'User',
          profileId: 'profile-source',
          exp: 1,
          iat: 1,
        },
        { targetAppId: 'forgeofwill' }
      )
    ).resolves.toEqual({
      token: 'target-token',
      targetAppId: 'forgeofwill',
      profileId: 'profile-target',
    });
    expect(profileService.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Create },
      expect.objectContaining({
        userId: 'user-1',
        name: 'User',
        appScope: 'forgeofwill',
      })
    );
    expect(roleInitService.processNow).toHaveBeenCalled();
  });

  it('blocks an unassessed foreign-app account before bootstrapping an OTTS profile', async () => {
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      throwError(() => new Error('AGE_CHECK_REQUIRED'))
    );

    await expect(
      controller.exchangeTokenForApp(
        {
          userId: 'new-foreign-app-user',
          email: 'new-user@example.com',
          name: 'New User',
          profileId: 'profile-foreign',
          exp: 1,
          iat: 1,
        },
        { targetAppId: 'client-interface' }
      )
    ).rejects.toBeInstanceOf(HttpException);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.CheckGuardianAccess },
      { userId: 'new-foreign-app-user', appId: 'client-interface' }
    );
    expect(profileService.send).not.toHaveBeenCalled();
    expect(clientProxy.send).not.toHaveBeenCalledWith(
      { cmd: AuthCommands.Issue },
      expect.anything()
    );
  });

  it('should reject token exchange without a target app', async () => {
    await expect(
      controller.exchangeTokenForApp(
        {
          userId: 'user-1',
          email: 'user@example.com',
          name: 'User',
          profileId: 'profile-source',
          exp: 1,
          iat: 1,
        },
        {}
      )
    ).rejects.toThrow(HttpException);
  });

  it('should throw HttpException if validateToken fails', async () => {
    const validateTokenRequest: ValidateTokenRequest = {
      token: 'fail',
      userId: 'fail',
    };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('validate error');
    });
    await expect(
      controller.validateToken(validateTokenRequest)
    ).rejects.toThrow(HttpException);
  });

  it('should validate MFA', async () => {
    const validateMfaRequest = { userId: '123', token: '123456' };
    await expect(controller.validateMfa(validateMfaRequest)).resolves.toBe(
      true
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.ValidateTotp },
      validateMfaRequest
    );
  });

  it('should throw HttpException if validateMfa fails', async () => {
    const validateMfaRequest = { userId: 'fail', token: 'fail' };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('validate mfa error');
    });
    await expect(controller.validateMfa(validateMfaRequest)).rejects.toThrow(
      HttpException
    );
  });

  describe('credential-endpoint rate limiting', () => {
    // The gateway ThrottlerModule configures named throttlers
    // ('short'/'medium'/'long'), and ThrottlerGuard only honors @Throttle
    // metadata keyed to a configured name. A `{ default: ... }` override is
    // silently ignored, which is exactly the regression these tests catch.
    const CONFIGURED_THROTTLER_NAME = 'long';
    const limitFor = (handler: unknown): number | undefined =>
      Reflect.getMetadata(
        `THROTTLER:LIMIT${CONFIGURED_THROTTLER_NAME}`,
        handler as object
      );

    const protectedHandlers: Array<[string, unknown, number]> = [
      ['loginUser', AuthenticationController.prototype.loginUser, 10],
      [
        'confirmPasswordReset',
        AuthenticationController.prototype.confirmPasswordReset,
        10,
      ],
      ['resetPassword', AuthenticationController.prototype.resetPassword, 10],
      ['enableMfa', AuthenticationController.prototype.enableMfa, 10],
      ['validateMfa', AuthenticationController.prototype.validateMfa, 10],
      [
        'confirmEmailVerification',
        AuthenticationController.prototype.confirmEmailVerification,
        20,
      ],
      [
        'confirmMagicLink',
        AuthenticationController.prototype.confirmMagicLink,
        20,
      ],
      [
        'requestEmailAction',
        AuthenticationController.prototype.requestEmailAction,
        5,
      ],
      ['registerUser', AuthenticationController.prototype.registerUser, 100],
      // The session endpoint is the hottest auth route (SSR validation +
      // client restore on every navigation) and the loop's main amplifier.
      // It gets a generous multiplex-tolerant limit, not the strict
      // credential limits above.
      [
        'currentSession',
        AuthenticationController.prototype.currentSession,
        300,
      ],
    ];

    it.each(protectedHandlers)(
      '%s declares a strict limit on the configured "long" throttler',
      (_name, handler, expectedLimit) => {
        expect(limitFor(handler)).toBe(expectedLimit);
      }
    );

    it('does not rely on an unconfigured "default" throttler for login', () => {
      expect(
        Reflect.getMetadata(
          'THROTTLER:LIMITdefault',
          AuthenticationController.prototype.loginUser
        )
      ).toBeUndefined();
    });
  });
});
