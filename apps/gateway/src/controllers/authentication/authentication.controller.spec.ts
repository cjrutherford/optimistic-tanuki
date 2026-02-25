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

describe('AuthenticationController', () => {
  let controller: AuthenticationController;
  let clientProxy: ClientProxy;
  let profileService: ClientProxy;
  let roleInitService: { processNow: jest.Mock };

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

    const module: TestingModule = await Test.createTestingModule({
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
        Logger,
      ],
    }).compile();

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
    // Mock UserIdFromEmail to return a valid userId
    (clientProxy.send as jest.Mock)
      .mockReturnValueOnce(of('user-1')) // UserIdFromEmail
      .mockReturnValueOnce(of(true)); // Login
    await expect(controller.loginUser(loginRequest, 'test')).resolves.toBe(
      true
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Login },
      { ...loginRequest, profileId: 'profile-1' }
    );
  });

  it('should auto-create app-scoped profile for cross-app users and login with it', async () => {
    const loginRequest: LoginRequest = {
      email: 'cross@app.com',
      password: 'test',
    };

    (clientProxy.send as jest.Mock).mockImplementation((pattern) => {
      if (pattern?.cmd === AuthCommands.UserIdFromEmail) {
        return of('user-1');
      }
      if (pattern?.cmd === AuthCommands.Login) {
        return of(true);
      }
      return of(true);
    });

    (profileService.send as jest.Mock).mockImplementation((pattern, payload) => {
      if (pattern?.cmd === ProfileCommands.GetAll) {
        return of([
          {
            id: 'profile-client',
            userId: 'user-1',
            profileName: 'Client Profile',
            appScope: 'client-interface',
            profilePic: 'pic',
            coverPic: 'cover',
            bio: 'bio',
            location: 'loc',
            occupation: 'occ',
            interests: 'int',
            skills: 'skills',
          },
        ]);
      }

      if (pattern?.cmd === ProfileCommands.Create) {
        expect(payload).toEqual(
          expect.objectContaining({
            userId: 'user-1',
            name: 'Client Profile',
            appScope: 'forgeofwill',
            copyPermissionsFromGlobalProfile: false,
          })
        );
        return of({
          id: 'profile-forge',
          userId: 'user-1',
          profileName: 'Client Profile',
          appScope: 'forgeofwill',
        });
      }

      return of([]);
    });

    await expect(controller.loginUser(loginRequest, 'forgeofwill')).resolves.toBe(
      true
    );

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Login },
      { ...loginRequest, profileId: 'profile-forge' }
    );
    expect(roleInitService.processNow).toHaveBeenCalled();
  });

  it('should throw HttpException if loginUser fails', async () => {
    const loginRequest: LoginRequest = {
      email: 'fail@test.com',
      password: 'fail',
    };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => {
      throw new Error('login error');
    });
    await expect(controller.loginUser(loginRequest, 'test')).rejects.toThrow(
      HttpException
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
    jest.spyOn(clientProxy, 'send').mockReturnValueOnce(of(mockResult));
    await expect(
      controller.registerUser(registerRequest, 'test')
    ).resolves.toEqual(mockResult);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Register },
      registerRequest
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
