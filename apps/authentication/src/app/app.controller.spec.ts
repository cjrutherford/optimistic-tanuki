import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RpcException } from '@nestjs/microservices';
import {
  EnableMultiFactorRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  ValidateTokenRequest,
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
      (appService.login as jest.Mock).mockResolvedValue({
        userId: 'userId',
        token: 'token',
        valid: true,
      });
      const loginRequest: LoginRequest & { profileId: string } = {
        email: 'test@example.com',
        password: 'password',
        mfa: '123456',
        profileId: 'profile123',
      };
      const loginResponse = await appController.login(loginRequest);
      expect(appService.login).toHaveBeenCalledWith(
        'test@example.com',
        'password',
        '123456',
        'profile123'
      );
      expect(loginResponse).toEqual({
        userId: 'userId',
        token: 'token',
        valid: true,
      });
    });

    it('should throw RpcException on service error', async () => {
      const loginRequest: LoginRequest & { profileId: string } = {
        email: 'test@example.com',
        password: 'password',
        mfa: '123456',
        profileId: 'profile123',
      };
      jest.spyOn(appService, 'login').mockRejectedValue(new Error('Error'));
      await expect(appController.login(loginRequest)).rejects.toThrow(
        new RpcException("Error")
      );
    });

    it('should thow RpcException if missing fields', async () => {
      const loginRequest: LoginRequest & { profileId: string } = {
        email: '',
        password: 'password',
        mfa: '123456',
        profileId: 'profile123',
      };
      await expect(appController.login(loginRequest)).rejects.toThrow(
        new RpcException('Missing required fields: email')
      );
      const loginRequest2: LoginRequest & { profileId: string } = {
        email: '',
        password: '',
        mfa: '123456',
        profileId: 'profile123',
      };
      await expect(appController.login(loginRequest2)).rejects.toThrow(
        new RpcException('Missing required fields: email password')
      );
    });
  });

  describe('register', () => {
    it('should call appService.registerUser with correct parameters', async () => {
      (appService.registerUser as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'User registered successfully',
      });
      const registerRequest: RegisterRequest = {
        email: 'test@example.com',
        fn: 'First',
        ln: 'Last',
        password: 'password',
        confirm: 'password',
        bio: '  ',
      };
      const registerResponse = await appController.register(registerRequest);
      expect(appService.registerUser).toHaveBeenCalledWith(
        'test@example.com',
        'First',
        'Last',
        'password',
        'password',
        '  '
      );
      expect(registerResponse).toEqual({
        code: 0,
        message: 'User registered successfully',
      });
    });

    it('should throw RpcException on error', async () => {
      const registerRequest: RegisterRequest = {
        email: 'test@example.com',
        fn: 'First',
        ln: 'Last',
        password: 'password',
        confirm: 'password',
        bio: '  ',
      };
      jest
        .spyOn(appService, 'registerUser')
        .mockRejectedValue(new Error('Error'));
      await expect(appController.register(registerRequest)).rejects.toThrow(
        new RpcException('Error')
      );
    });

    it('should throw RpcException if email is missing', async () => {
      const registerRequest: RegisterRequest = {
        email: '',
        fn: 'First',
        ln: 'Last',
        password: 'password',
        confirm: 'password',
        bio: '  ',
      };
      await expect(appController.register(registerRequest)).rejects.toThrow(
        new RpcException('Missing required fields: email')
      );
    });

    it('should throw RpcException if password is missing', async () => {
      const registerRequest: RegisterRequest = {
        email: 'someone@somewhere.net',
        fn: 'First',
        ln: 'Last',
        password: '',
        confirm: 'password',
        bio: '  ',
      };
      await expect(appController.register(registerRequest)).rejects.toThrow(
        new RpcException('Missing required fields: password')
      );
    });
  });

  describe('resetPassword', () => {
    it('should call appService.resetPassword with correct parameters', async () => {
      (appService.resetPassword as jest.Mock).mockResolvedValue({
        message: 'Password reset successfully',
        code: 0,
      });
      const resetPasswordRequest: ResetPasswordRequest = {
        email: 'test@example.com',
        newPass: 'newPass',
        newConf: 'newConf',
        oldPass: 'oldPass',
        mfa: '123456',
      };
      const resetResponse = await appController.resetPassword(resetPasswordRequest);
      expect(appService.resetPassword).toHaveBeenCalledWith(
        'test@example.com',
        'newPass',
        'newConf',
        'oldPass',
        '123456'
      );
      expect(resetResponse).toEqual({
        message: 'Password reset successfully',
        code: 0,
      });
    });

    it('should throw RpcException on error', async () => {
      const resetPasswordRequest: ResetPasswordRequest = {
        email: 'test@example.com',
        newPass: 'newPass',
        newConf: 'newConf',
        oldPass: 'oldPass',
        mfa: '123456',
      };
      jest
        .spyOn(appService, 'resetPassword')
        .mockRejectedValue(new Error('Error'));
      await expect(
        appController.resetPassword(resetPasswordRequest)
      ).rejects.toThrow(new RpcException("Error"));
    });

    it('should throw RpcException if missing fields', async () => {
      const resetPasswordRequest: ResetPasswordRequest = {
        email: '',
        newPass: 'newPass',
        newConf: 'newConf',
        oldPass: 'oldPass',
        mfa: '123456',
      };
      await expect(
        appController.resetPassword(resetPasswordRequest)
      ).rejects.toThrow(new RpcException('Missing required fields: email'));
      const resetPasswordRequest2: ResetPasswordRequest = {
        email: '',
        newPass: '',
        newConf: '',
        oldPass: 'oldPass',
        mfa: '123456',
      };
      await expect(
        appController.resetPassword(resetPasswordRequest2)
      ).rejects.toThrow(
        new RpcException('Missing required fields: email newPass newConf')
      );
    });
  });

  describe('validate', () => {
    it('should call appService.validateToken with correct parameters', async () => {
      (appService.validateToken as jest.Mock).mockResolvedValue({
        userId: 'userId',
        valid: true,
      });
      const validateTokenRequest: ValidateTokenRequest = {
        token: 'token',
        userId: 'userId',
      };
      const validateTokenResponse = await appController.validate(validateTokenRequest);
      expect(appService.validateToken).toHaveBeenCalledWith('token');
      expect(validateTokenResponse).toEqual({ userId: 'userId', valid: true });
    });

    it('should throw RpcException on error', async () => {
      const validateTokenRequest: ValidateTokenRequest = {
        token: 'token',
        userId: 'userId',
      };
      jest
        .spyOn(appService, 'validateToken')
        .mockRejectedValue(new Error('Error'));
      await expect(
        appController.validate(validateTokenRequest)
      ).rejects.toThrow(new RpcException("Error"));
    });

    it('should throw RpcException if missing fields', async () => {
      const validateTokenRequest: ValidateTokenRequest = {
        token: '',
        userId: 'userId',
      };
      await expect(
        appController.validate(validateTokenRequest)
      ).rejects.toThrow(new RpcException('Missing required fields: token'));
      const validateTokenRequest2: ValidateTokenRequest = {
        token: '',
        userId: '',
      };
      await expect(
        appController.validate(validateTokenRequest2)
      ).rejects.toThrow(
        new RpcException('Missing required fields: token userId')
      );
    });
  });

  describe('enableMfa', () => {
    it('should call appService.setupTotp with correct parameters', async () => {
      (appService.setupTotp as jest.Mock).mockResolvedValue({
        message: 'MFA enabled successfully',
      });
      const enableMfaRequest: EnableMultiFactorRequest = {
        userId: 'userId',
        password: 'password',
        initialTotp: '088899',
      };
      const enableResponse = await appController.enableMfa(enableMfaRequest);
      expect(appService.setupTotp).toHaveBeenCalledWith('userId');
      expect(enableResponse).toEqual({
        message: 'MFA enabled successfully',
      });
    });

    it('should throw RpcException on error', async () => {
      const enableMfaRequest: EnableMultiFactorRequest = {
        userId: 'userId',
        password: 'password',
        initialTotp: '088899',
      };
      jest.spyOn(appService, 'setupTotp').mockRejectedValue(new Error('Error'));
      await expect(appController.enableMfa(enableMfaRequest)).rejects.toThrow(
        new RpcException("Error")
      );
    });

    it('should throw RpcException if missing fields', async () => {
      const enableMfaRequest: EnableMultiFactorRequest = {
        userId: '',
        password: 'password',
        initialTotp: '088899',
      };
      await expect(appController.enableMfa(enableMfaRequest)).rejects.toThrow(
        new RpcException('Missing required fields: userId')
      );
      const enableMfaRequest2: EnableMultiFactorRequest = {
        userId: '',
        password: '',
        initialTotp: '088899',
      };
      await expect(appController.enableMfa(enableMfaRequest2)).rejects.toThrow(
        new RpcException('Missing required fields: userId password')
      );
    });
  });

  describe('validateTotp', () => {
    it('should call appService.validateTotp with correct parameters', async () => {
      (appService.validateTotp as jest.Mock).mockResolvedValue({
        message: 'TOTP validated successfully',
      });
      const validateTotpRequest = { userId: 'userId', token: 'token' };
      const validateResponse = await appController.validateTotp(validateTotpRequest);
      expect(appService.validateTotp).toHaveBeenCalledWith('userId', 'token');
      expect(validateResponse).toEqual({
        message: 'TOTP validated successfully',
      });
    });

    it('should throw RpcException on error', async () => {
      const validateTotpRequest = { userId: 'userId', token: 'token' };
      jest
        .spyOn(appService, 'validateTotp')
        .mockRejectedValue(new Error('Error'));
      await expect(
        appController.validateTotp(validateTotpRequest)
      ).rejects.toThrow(new RpcException("Error"));
    });

    it('should throw RpcException if missing fields', async () => {
      const validateTotpRequest = { userId: '', token: 'token' };
      await expect(
        appController.validateTotp(validateTotpRequest)
      ).rejects.toThrow(new RpcException('Missing required fields: userId'));
      const validateTotpRequest2 = { userId: '', token: '' };
      await expect(
        appController.validateTotp(validateTotpRequest2)
      ).rejects.toThrow(
        new RpcException('Missing required fields: userId token')
      );
    });
  });
});
