import {
  EnableMultiFactorRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  ValidateTokenRequest,
} from '@optimistic-tanuki/models';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthCommands } from '@optimistic-tanuki/constants';
import { AuthenticationController } from './authentication.controller';
import { ClientProxy } from '@nestjs/microservices';
import { HttpException } from '@nestjs/common';
import { of } from 'rxjs';

describe('AuthenticationController', () => {
  let controller: AuthenticationController;
  let clientProxy: ClientProxy;

  beforeEach(async () => {
    clientProxy = {
      send: jest.fn().mockReturnValue(of(true)),
      connect: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<ClientProxy>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        {
          provide: 'AUTHENTICATION_SERVICE',
          useValue: clientProxy,
        },
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
    await expect(controller.loginUser(loginRequest)).resolves.toBe(true);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Login },
      loginRequest
    );
  });

  it('should throw HttpException if loginUser fails', async () => {
    const loginRequest: LoginRequest = {
      email: 'fail@test.com',
      password: 'fail',
    };
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => { throw new Error('login error'); });
    await expect(controller.loginUser(loginRequest)).rejects.toThrow(HttpException);
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
    await expect(controller.registerUser(registerRequest)).resolves.toBe(true);
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
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => { throw new Error('register error'); });
    await expect(controller.registerUser(registerRequest)).rejects.toThrow(HttpException);
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
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => { throw new Error('reset error'); });
    await expect(controller.resetPassword(resetPasswordRequest)).rejects.toThrow(HttpException);
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
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => { throw new Error('mfa error'); });
    await expect(controller.enableMfa(enableMfaRequest)).rejects.toThrow(HttpException);
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
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => { throw new Error('validate error'); });
    await expect(controller.validateToken(validateTokenRequest)).rejects.toThrow(HttpException);
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
    (clientProxy.send as jest.Mock).mockImplementationOnce(() => { throw new Error('validate mfa error'); });
    await expect(controller.validateMfa(validateMfaRequest)).rejects.toThrow(HttpException);
  });
});
