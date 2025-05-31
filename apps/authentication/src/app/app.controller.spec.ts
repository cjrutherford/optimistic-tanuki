import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RpcException } from '@nestjs/microservices';
import { 
EnableMultiFactorRequest, 
LoginRequest, 
RegisterRequest, 
ResetPasswordRequest, 
ValidateTokenRequest 
} from '@optimistic-tanuki/models';
import { Logger } from '@nestjs/common';

describe('AppController', () => {
let appController: AppController;
let appService: AppService;

beforeEach(async () => {
  const app: TestingModule = await Test.createTestingModule({
    controllers: [AppController],
    providers: [
      Logger,
      {
        provide: AppService,
        useValue: {
          login: jest.fn(),
          registerUser: jest.fn(),
          resetPassword: jest.fn(),
          validateToken: jest.fn(),
          setupTotp: jest.fn(),
          validateTotp: jest.fn(),
        },
      },
    ],
  }).compile();

  appController = app.get<AppController>(AppController);
  appService = app.get<AppService>(AppService);
});

describe('login', () => {
  it('should call appService.login with correct parameters', async () => {
    const loginRequest: LoginRequest = { email: 'test@example.com', password: 'password', mfa: '123456' };
    await appController.login(loginRequest);
    expect(appService.login).toHaveBeenCalledWith('test@example.com', 'password', '123456');
  });

  it('should throw RpcException on error', async () => {
    const loginRequest: LoginRequest = { email: 'test@example.com', password: 'password', mfa: '123456' };
    jest.spyOn(appService, 'login').mockRejectedValue(new Error('Error'));
    await expect(appController.login(loginRequest)).rejects.toThrow(RpcException);
  });
});

describe('register', () => {
  it('should call appService.registerUser with correct parameters', async () => {
    const registerRequest: RegisterRequest = { email: 'test@example.com', fn: 'First', ln: 'Last', password: 'password', confirm: 'password', bio: '  ' };
    await appController.register(registerRequest);
    expect(appService.registerUser).toHaveBeenCalledWith('test@example.com', 'First', 'Last', 'password', 'password','  ');
  });

  it('should throw RpcException on error', async () => {
    const registerRequest: RegisterRequest = { email: 'test@example.com', fn: 'First', ln: 'Last', password: 'password', confirm: 'password', bio: '  ' };
    jest.spyOn(appService, 'registerUser').mockRejectedValue(new Error('Error'));
    await expect(appController.register(registerRequest)).rejects.toThrow(RpcException);
  });
});

describe('resetPassword', () => {
  it('should call appService.resetPassword with correct parameters', async () => {
    const resetPasswordRequest: ResetPasswordRequest = { email: 'test@example.com', newPass: 'newPass', newConf: 'newConf', oldPass: 'oldPass', mfa: '123456' };
    await appController.resetPassword(resetPasswordRequest);
    expect(appService.resetPassword).toHaveBeenCalledWith('test@example.com', 'newPass', 'newConf', 'oldPass', '123456');
  });

  it('should throw RpcException on error', async () => {
    const resetPasswordRequest: ResetPasswordRequest = { email: 'test@example.com', newPass: 'newPass', newConf: 'newConf', oldPass: 'oldPass', mfa: '123456' };
    jest.spyOn(appService, 'resetPassword').mockRejectedValue(new Error('Error'));
    await expect(appController.resetPassword(resetPasswordRequest)).rejects.toThrow(RpcException);
  });
});

describe('validate', () => {
  it('should call appService.validateToken with correct parameters', async () => {
    const validateTokenRequest: ValidateTokenRequest = { token: 'token', userId: 'userId' };
    await appController.validate(validateTokenRequest);
    expect(appService.validateToken).toHaveBeenCalledWith('token');
  });

  it('should throw RpcException on error', async () => {
    const validateTokenRequest: ValidateTokenRequest = { token: 'token', userId: 'userId' };
    jest.spyOn(appService, 'validateToken').mockRejectedValue(new Error('Error'));
    await expect(appController.validate(validateTokenRequest)).rejects.toThrow(RpcException);
  });
});

describe('enableMfa', () => {
  it('should call appService.setupTotp with correct parameters', async () => {
    const enableMfaRequest: EnableMultiFactorRequest = { userId: 'userId', password: 'password', initialTotp: '088899' };
    await appController.enableMfa(enableMfaRequest);
    expect(appService.setupTotp).toHaveBeenCalledWith('userId');
  });

  it('should throw RpcException on error', async () => {
    const enableMfaRequest: EnableMultiFactorRequest = { userId: 'userId', password: 'password', initialTotp: '088899' };
    jest.spyOn(appService, 'setupTotp').mockRejectedValue(new Error('Error'));
    await expect(appController.enableMfa(enableMfaRequest)).rejects.toThrow(RpcException);
  });
});

describe('validateTotp', () => {
  it('should call appService.validateTotp with correct parameters', async () => {
    const validateTotpRequest = { userId: 'userId', token: 'token' };
    await appController.validateTotp(validateTotpRequest);
    expect(appService.validateTotp).toHaveBeenCalledWith('userId', 'token');
  });

  it('should throw RpcException on error', async () => {
    const validateTotpRequest = { userId: 'userId', token: 'token' };
    jest.spyOn(appService, 'validateTotp').mockRejectedValue(new Error('Error'));
    await expect(appController.validateTotp(validateTotpRequest)).rejects.toThrow(RpcException);
  });
});
});
