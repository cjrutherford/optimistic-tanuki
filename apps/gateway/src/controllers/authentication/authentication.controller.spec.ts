import {
  EnableMultiFactorRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  ValidateTokenRequest,
} from '@optimistic-tanuki/models';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
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

describe('AuthenticationController', () => {
  let controller: AuthenticationController;
  let clientProxy: ClientProxy;
  let profileService: ClientProxy;
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
});
