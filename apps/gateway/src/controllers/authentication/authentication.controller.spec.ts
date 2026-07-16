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
import { HttpException, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { RoleInitService } from '@optimistic-tanuki/permission-lib';
import {
  LoginAccountBootstrapService,
  RegisterAccountBootstrapService,
} from '@optimistic-tanuki/auth-feature-account-bootstrap';
import { AuthGuard } from '../../auth/auth.guard';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.controller';

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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should login user', async () => {
    const loginRequest: LoginRequest = {
      email: 'test@test.com',
      password: 'test',
    };
    await expect(controller.loginUser(loginRequest, 'test')).resolves.toBe(
      true
    );
    expect(loginBootstrap.login).toHaveBeenCalledWith(loginRequest, 'test');
  });

  it('should auto-create app-scoped profile for cross-app users and login with it', async () => {
    const loginRequest: LoginRequest = {
      email: 'cross@app.com',
      password: 'test',
    };

    await expect(
      controller.loginUser(loginRequest, 'forgeofwill')
    ).resolves.toBe(true);

    expect(loginBootstrap.login).toHaveBeenCalledWith(
      loginRequest,
      'forgeofwill'
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

  it('should issue a fresh token for the requested profile', async () => {
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ data: { newToken: 'fresh-token' } })
    );

    await expect(
      controller.issueTokenForProfile(
        { userId: 'user-1', email: 'u@example.com', name: 'U' } as any,
        { profileId: 'profile-2' }
      )
    ).resolves.toEqual({ data: { newToken: 'fresh-token' } });

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Issue },
      { userId: 'user-1', profileId: 'profile-2' }
    );
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
      controller.registerUser(registerRequest, 'test')
    ).resolves.toEqual(mockResult);
    expect(registerBootstrap.register).toHaveBeenCalledWith(
      registerRequest,
      'test'
    );
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

    await controller.registerUser(
      registration,
      'system-configurator',
      'system-configurator'
    );

    expect(requestSpy).toHaveBeenCalledWith(
      'system-configurator',
      'verification',
      { email: 'builder@example.com', returnPath: '/' }
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
      'system-configurator'
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
      controller.registerUser(registerRequest, 'leads-app')
    ).resolves.toEqual(mockResult);

    expect(registerBootstrap.register).toHaveBeenCalledWith(
      registerRequest,
      'leads-app'
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
    expect(storeService.send).toHaveBeenCalledWith(
      ProductCommands.FIND_OWNER_PRODUCTS,
      'user-1'
    );
    expect(storeService.send).toHaveBeenCalledWith(
      ProductCommands.CREATE_PRODUCT,
      expect.objectContaining({
        ownerId: 'user-1',
        type: 'service',
        active: true,
      })
    );
  });

  it('does not seed starter products when the owner already has products', async () => {
    (profileService.send as jest.Mock).mockReturnValueOnce(
      of([
        {
          id: 'profile-1',
          userId: 'user-1',
          appScope: 'business-site',
        },
      ])
    );
    (storeService.send as jest.Mock).mockImplementation((command: any) => {
      if (command === ProductCommands.FIND_OWNER_PRODUCTS) {
        return of([
          {
            id: 'product-1',
            ownerId: 'user-1',
            type: 'service',
          },
        ]);
      }

      return of({});
    });

    await controller.claimOwnerAccess(
      {
        userId: 'user-1',
        email: 'owner@example.com',
        profileId: 'profile-1',
      } as any,
      'business-site'
    );

    expect(storeService.send).toHaveBeenCalledWith(
      ProductCommands.FIND_OWNER_PRODUCTS,
      'user-1'
    );
    expect(storeService.send).not.toHaveBeenCalledWith(
      ProductCommands.CREATE_PRODUCT,
      expect.anything()
    );
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
      controller.registerUser(registerRequest, 'finance')
    ).resolves.toEqual(mockResult);

    expect(registerBootstrap.register).toHaveBeenCalledWith(
      registerRequest,
      'finance'
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
      validateTokenRequest
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
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ data: { newToken: 'target-token' } })
    );

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
      { userId: 'user-1', profileId: 'profile-target' }
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
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ data: { newToken: 'target-token' } })
    );

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
