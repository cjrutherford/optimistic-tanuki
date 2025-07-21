import { Controller, Get, Logger } from '@nestjs/common';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { validateRequiredFields } from '@optimistic-tanuki/database';
import { AppService } from './app.service';
import {
  EnableMultiFactorRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  ValidateTokenRequest,
} from '@optimistic-tanuki/models';
import {
  MessagePattern,
  Payload,
  RpcException,
} from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly l: Logger
  ) {}

  @MessagePattern({ cmd: AuthCommands.Login })
  async login(@Payload() data: LoginRequest) {
    try {
      this.l.log('login:', data);
      const missingFields = validateRequiredFields<LoginRequest>(data, [
        'email',
        'password',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      const { email, password, mfa } = data;
      this.l.log('login:', email, password, mfa);
      return await this.appService.login(email, password, mfa);
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.Register })
  async register(@Payload() data: RegisterRequest) {
    try {
      const missingFields = validateRequiredFields<RegisterRequest>(data, [
        'email',
        'fn',
        'ln',
        'password',
        'confirm',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }

      const { email, fn, ln, password, confirm, bio } = data;
      const userReg = await this.appService.registerUser(
        email,
        fn,
        ln,
        password,
        confirm,
        bio
      );
      return userReg;
    } catch (e) {
      if (e instanceof RpcException) {
        return { status: 'error', message: e.message, code: 1 };
      }
      return { status: 'error', message: e.message, code: 1 };
    }
  }

  @MessagePattern({ cmd: AuthCommands.ResetPassword })
  async resetPassword(@Payload() data: ResetPasswordRequest) {
    try {
      const missingFields = validateRequiredFields<ResetPasswordRequest>(data, [
        'email',
        'newPass',
        'newConf',
        'oldPass',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      const { email, newPass, newConf, oldPass, mfa } = data;
      return await this.appService.resetPassword(
        email,
        newPass,
        newConf,
        oldPass,
        mfa
      );
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.Validate })
  async validate(@Payload() data: ValidateTokenRequest) {
    try {
      const missingFields = validateRequiredFields<ValidateTokenRequest>(data, [
        'token',
        'userId',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      const { token } = data;
      const tokenValidation = await this.appService.validateToken(token);
      console.log('Token validation result:', tokenValidation);
      return tokenValidation;
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.EnableMultiFactor })
  async enableMfa(@Payload() data: EnableMultiFactorRequest) {
    try {
      const missingFields = validateRequiredFields<EnableMultiFactorRequest>(data, [
        'userId',
        'password',
        'initialTotp',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      const { userId } = data;
      return await this.appService.setupTotp(userId);
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.ValidateTotp })
  async validateTotp(@Payload() data: { userId: string; token: string }) {
    try {
      const missingFields = validateRequiredFields<{ userId: string; token: string }>(data, [
        'userId',
        'token',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      const { userId, token } = data;
      return await this.appService.validateTotp(userId, token);
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }
}
