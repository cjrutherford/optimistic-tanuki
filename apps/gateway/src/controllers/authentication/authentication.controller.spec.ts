import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticationController } from './authentication.controller';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';
import {
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  EnableMultiFactorRequest,
  ValidateTokenRequest,
} from '@optimistic-tanuki/models';

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
});
