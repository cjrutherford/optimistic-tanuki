import { Controller, Get, Logger } from '@nestjs/common';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { AppService } from './app.service';
import { EnableMultiFactorRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, ValidateTokenRequest } from '@optimistic-tanuki/models';
import { Ctx, MessagePattern, Payload, RmqContext, RpcException } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly l: Logger) {}

  @MessagePattern({ cmd: AuthCommands.Login })
  async login(@Payload() data: LoginRequest) {
    try {
      this.l.log('login:', data);
      const { email, password, mfa } = data;
      this.l.log('login:', email, password, mfa);
      return await this.appService.login(email, password, mfa);
    } catch (e) {
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.Register })
  async register(@Payload() data: RegisterRequest) {
    try {
      const { email, fn, ln, password, confirm, bio } = data;
      const userReg =  await this.appService.registerUser(email, fn, ln, password, confirm, bio);
      return userReg;
    } catch (e) {
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.ResetPassword })
  async resetPassword(@Payload() data: ResetPasswordRequest) {
    try {
      const {email, newPass, newConf, oldPass, mfa } = data;
      return await this.appService.resetPassword(email, newPass, newConf, oldPass, mfa);
    } catch (e) {
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.Validate })
  async validate(@Payload() data: ValidateTokenRequest) {
    try {
      const { token } = data;
      return await this.appService.validateToken(token);
    } catch (e) {
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.EnableMultiFactor })
  async enableMfa(@Payload() data: EnableMultiFactorRequest) {
    try {
      const { userId } = data;
      return await this.appService.setupTotp(userId);
    } catch (e) {
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.ValidateTotp })
  async validateTotp(@Payload() data: { userId: string, token: string }) {
    try {
      const { userId, token } = data;
      return await this.appService.validateTotp(userId, token);
    } catch (e) {
      throw new RpcException(e);
    }
  }
}
