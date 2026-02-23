import { Controller, Get, Logger } from '@nestjs/common';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { validateRequiredFields } from '@optimistic-tanuki/database';
import { AppService } from './app.service';
import { OAuthService } from './oauth.service';
import {
  EnableMultiFactorRequest,
  LinkProviderRequest,
  LoginRequest,
  OAuthCallbackRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UnlinkProviderRequest,
  ValidateTokenRequest,
} from '@optimistic-tanuki/models';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly oauthService: OAuthService,
    private readonly l: Logger
  ) {}

  @MessagePattern({ cmd: AuthCommands.UserIdFromEmail })
  async userIdFromEmail(@Payload() data: { email: string }) {
    try {
      const missingFields = validateRequiredFields<{ email: string }>(data, [
        'email',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      const { email } = data;
      this.l.debug('userIdFromEmail:', email);
      const userId = await this.appService.getUserIdFromEmail(email);
      this.l.debug('userIdFromEmail result:', userId);
      return userId;
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.Login })
  async login(@Payload() data: LoginRequest & { profileId: string }) {
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
      return await this.appService.login(email, password, mfa, data.profileId);
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
        throw e;
      }
      throw new RpcException(e);
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
      return tokenValidation;
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.Issue })
  async issue(@Payload() data: { userId: string; profileId?: string }) {
    try {
      const { userId, profileId } = data;
      if (!userId) throw new RpcException('userId is required');
      return await this.appService.issueToken(userId, profileId);
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
      const missingFields = validateRequiredFields<EnableMultiFactorRequest>(
        data,
        ['userId', 'password', 'initialTotp']
      );
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
      const missingFields = validateRequiredFields<{
        userId: string;
        token: string;
      }>(data, ['userId', 'token']);
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

  @MessagePattern({ cmd: AuthCommands.OAuthLogin })
  async oauthLogin(
    @Payload()
    data: OAuthCallbackRequest & {
      providerUserId: string;
      email: string;
      displayName: string;
      accessToken?: string;
      refreshToken?: string;
      profileId?: string;
    }
  ) {
    try {
      const missingFields = validateRequiredFields(data, [
        'provider',
        'providerUserId',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      return await this.oauthService.oauthLogin(
        data.provider,
        data.providerUserId,
        data.email,
        data.displayName,
        data.accessToken,
        data.refreshToken,
        data.profileId
      );
    } catch (e) {
      if (e instanceof RpcException) throw e;
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.LinkProvider })
  async linkProvider(@Payload() data: LinkProviderRequest) {
    try {
      const missingFields = validateRequiredFields<LinkProviderRequest>(data, [
        'userId',
        'provider',
        'providerUserId',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      return await this.oauthService.linkProvider(
        data.userId,
        data.provider,
        data.providerUserId,
        data.accessToken,
        data.refreshToken,
        data.providerEmail,
        data.providerDisplayName
      );
    } catch (e) {
      if (e instanceof RpcException) throw e;
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.UnlinkProvider })
  async unlinkProvider(@Payload() data: UnlinkProviderRequest) {
    try {
      const missingFields = validateRequiredFields<UnlinkProviderRequest>(
        data,
        ['userId', 'provider']
      );
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      return await this.oauthService.unlinkProvider(data.userId, data.provider);
    } catch (e) {
      if (e instanceof RpcException) throw e;
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.GetLinkedProviders })
  async getLinkedProviders(@Payload() data: { userId: string }) {
    try {
      if (!data.userId) {
        throw new RpcException('userId is required');
      }
      return await this.oauthService.getLinkedProviders(data.userId);
    } catch (e) {
      if (e instanceof RpcException) throw e;
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.Logout })
  async logout(@Payload() data: { token: string }) {
    try {
      const missingFields = validateRequiredFields<{ token: string }>(data, [
        'token',
      ]);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      const { token } = data;
      return await this.appService.logout(token);
    } catch (e) {
      if (e instanceof RpcException) {
        throw e;
      }
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.SendMfaSetupEmail })
  async sendMfaSetupEmail(@Payload() data: { userId: string }) {
    try {
      if (!data.userId) {
        throw new RpcException('userId is required');
      }
      return await this.appService.sendMfaSetupEmail(data.userId);
    } catch (e) {
      if (e instanceof RpcException) throw e;
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.SendMfaVerificationEmail })
  async sendMfaVerificationEmail(
    @Payload() data: { userId: string; action: string }
  ) {
    try {
      const missingFields = validateRequiredFields<{
        userId: string;
        action: string;
      }>(data, ['userId', 'action']);
      if (missingFields.length > 0) {
        throw new RpcException(
          `Missing required fields: ${missingFields.join(' ')}`
        );
      }
      return await this.appService.sendMfaVerificationEmail(
        data.userId,
        data.action
      );
    } catch (e) {
      if (e instanceof RpcException) throw e;
      throw new RpcException(e);
    }
  }

  @MessagePattern({ cmd: AuthCommands.GetOAuthConfig })
  getOAuthConfig(@Payload() data: { domain?: string }) {
    return this.appService.getPublicOAuthConfig(data?.domain);
  }
}
