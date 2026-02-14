import {
  Body,
  Controller,
  Inject,
  Post,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CreateProfileDto,
  EnableMultiFactorRequest,
  LoginRequest,
  ProfileDto,
  RegisterRequest,
  ResetPasswordRequest,
  ValidateTokenRequest,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import {
  AuthCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { AppScope } from '../../decorators/appscope.decorator';
import {
  RoleInitBuilder,
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';
import {
  LoginAccountBootstrapService,
  RegisterAccountBootstrapService,
} from '@optimistic-tanuki/auth-feature-account-bootstrap';

import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';

@ApiTags('authentication')
@Controller('authentication')
export class AuthenticationController {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    private readonly logger: Logger,
    private readonly roleInit: RoleInitService,
    private readonly loginBootstrap: LoginAccountBootstrapService,
    private readonly registerBootstrap: RegisterAccountBootstrapService
  ) {
    this.authClient
      .connect()
      .then(() => {
        console.log('AuthenticationController connected to authClient');
      })
      .catch((e) => console.error(e));
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({ status: 201, description: 'User logged in successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async loginUser(@Body() data: LoginRequest, @AppScope() appScope: string) {
    try {
      this.logger.debug(`loginUser called for email=${data.email}`);
      return await this.loginBootstrap.login(data, appScope);
    } catch (error) {
      this.logger.error('Error in loginUser:', error?.message || error);
      throw new HttpException(
        `Login failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('issue')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Issue a token for the requested profile' })
  @ApiResponse({ status: 201, description: 'Token issued successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async issueTokenForProfile(
    @User() user: UserDetails,
    @Body() body: { profileId?: string }
  ) {
    try {
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.Issue },
          { userId: user.userId, profileId: body.profileId || user.profileId }
        )
      );
    } catch (error) {
      this.logger.error(
        'Error in issueTokenForProfile:',
        error?.message || error
      );
      throw new HttpException(
        `Token issue failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('exchange')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Exchange current token for a target app token' })
  @ApiResponse({ status: 201, description: 'Token exchanged successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid exchange request.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async exchangeTokenForApp(
    @User() user: UserDetails,
    @Body() body: { targetAppId?: string }
  ) {
    const targetAppId = body.targetAppId?.trim();
    if (!targetAppId) {
      throw new HttpException(
        'targetAppId is required',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const profile = await this.getOrCreateAppScopedProfile(user, targetAppId);
      const issueResult = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.Issue },
          { userId: user.userId, profileId: profile.id }
        )
      );
      const token =
        issueResult?.data?.newToken ||
        issueResult?.newToken ||
        issueResult?.token;

      if (!token) {
        throw new Error('Authentication service did not return a token');
      }

      return {
        token,
        targetAppId,
        profileId: profile.id,
      };
    } catch (error) {
      this.logger.error(
        'Error in exchangeTokenForApp:',
        error?.message || error
      );
      throw new HttpException(
        `Token exchange failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async registerUser(
    @Body() data: RegisterRequest,
    @AppScope() appScope: string
  ) {
    try {
      this.logger.debug('registerUser called');
      const result = await this.registerBootstrap.register(data, appScope);
      return result;
    } catch (error) {
      this.logger.error(
        'Error in registerUser:',
        error?.message || JSON.stringify(error)
      );
      throw new HttpException(
        `Registration failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiResponse({ status: 201, description: 'Password reset successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async resetPassword(@Body() data: ResetPasswordRequest) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.ResetPassword }, data)
      );
    } catch (error) {
      console.error('Error in resetPassword:', error);
      throw new HttpException(
        `Password reset failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('enable-mfa')
  @ApiOperation({ summary: 'Enable multi-factor authentication' })
  @ApiResponse({ status: 201, description: 'MFA enabled successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async enableMfa(@Body() data: EnableMultiFactorRequest) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.EnableMultiFactor }, data)
      );
    } catch (error) {
      console.error('Error in enableMfa:', error);
      throw new HttpException(
        `Enable MFA failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate authentication token' })
  @ApiResponse({ status: 201, description: 'Token validated successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async validateToken(@Body() data: ValidateTokenRequest) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.Validate }, data)
      );
    } catch (error) {
      console.error('Error in validateToken:', error);
      throw new HttpException(
        `Token validation failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('validate-mfa')
  @ApiOperation({ summary: 'Validate multi-factor authentication token' })
  @ApiResponse({
    status: 201,
    description: 'MFA token validated successfully.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async validateMfa(@Body() data: { userId: string; token: string }) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.ValidateTotp }, data)
      );
    } catch (error) {
      console.error('Error in validateMfa:', error);
      throw new HttpException(
        `MFA validation failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('send-mfa-setup-email')
  @ApiOperation({ summary: 'Send MFA setup confirmation email' })
  @ApiResponse({ status: 201, description: 'MFA setup email sent.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async sendMfaSetupEmail(@Body() data: { userId: string }) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.SendMfaSetupEmail }, data)
      );
    } catch (error) {
      this.logger.error('Error in sendMfaSetupEmail:', error?.message || error);
      throw new HttpException(
        `Send MFA setup email failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('send-mfa-verification-email')
  @ApiOperation({ summary: 'Send MFA verification notification email' })
  @ApiResponse({ status: 201, description: 'MFA verification email sent.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async sendMfaVerificationEmail(
    @Body() data: { userId: string; action: string }
  ) {
    try {
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.SendMfaVerificationEmail },
          data
        )
      );
    } catch (error) {
      this.logger.error(
        'Error in sendMfaVerificationEmail:',
        error?.message || error
      );
      throw new HttpException(
        `Send MFA verification email failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout a user and invalidate token' })
  @ApiResponse({ status: 201, description: 'User logged out successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async logoutUser(@Body() data: { token: string }) {
    try {
      this.logger.debug('logoutUser called');
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.Logout }, data)
      );
    } catch (error) {
      console.error('Error in logoutUser:', error);
      throw new HttpException(
        `Logout failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('send-mfa-setup-email')
  @ApiOperation({ summary: 'Send MFA setup confirmation email' })
  @ApiResponse({ status: 201, description: 'MFA setup email sent.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async sendMfaSetupEmail(@Body() data: { userId: string }) {
    try {
      return await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.SendMfaSetupEmail }, data)
      );
    } catch (error) {
      this.logger.error('Error in sendMfaSetupEmail:', error?.message || error);
      throw new HttpException(
        `Send MFA setup email failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async getOrCreateAppScopedProfile(
    user: UserDetails,
    targetAppId: string
  ): Promise<ProfileDto> {
    const effectiveAppScope =
      targetAppId === 'owner-console' ? 'global' : targetAppId;
    const profiles = (await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.GetAll },
        { where: { userId: user.userId } }
      )
    )) as ProfileDto[];
    const appScopedProfile = profiles.find(
      (profile) => profile.appScope === effectiveAppScope
    );
    if (appScopedProfile) {
      return appScopedProfile;
    }

    const globalProfile = profiles.find(
      (profile) => !profile.appScope || profile.appScope === 'global'
    );
    const seedProfile = globalProfile || profiles[0] || null;
    if (!seedProfile) {
      throw new Error('No profile available for user');
    }

    const newProfile: CreateProfileDto & {
      appScope: string;
      copyPermissionsFromGlobalProfile?: boolean;
    } = {
      userId: seedProfile.userId,
      name: seedProfile.profileName || user.email,
      description: '',
      profilePic: seedProfile.avatarUrl || '',
      coverPic: '',
      bio: seedProfile.bio || '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      appScope: effectiveAppScope,
      copyPermissionsFromGlobalProfile: false,
    };

    const createdProfile = (await firstValueFrom(
      this.profileClient.send({ cmd: ProfileCommands.Create }, newProfile)
    )) as ProfileDto;
    const roleInitOptions = new RoleInitBuilder()
      .setScopeName(effectiveAppScope)
      .setProfile(createdProfile.id)
      .addDefaultProfileOwner(createdProfile.id, effectiveAppScope)
      .addAppScopeDefaults()
      .addAssetOwnerPermissions()
      .build();

    await this.roleInit.processNow(roleInitOptions);
    return createdProfile;
  }

  @Post('send-mfa-verification-email')
  @ApiOperation({ summary: 'Send MFA verification notification email' })
  @ApiResponse({ status: 201, description: 'MFA verification email sent.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async sendMfaVerificationEmail(
    @Body() data: { userId: string; action: string }
  ) {
    try {
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.SendMfaVerificationEmail },
          data
        )
      );
    } catch (error) {
      this.logger.error(
        'Error in sendMfaVerificationEmail:',
        error?.message || error
      );
      throw new HttpException(
        `Send MFA verification email failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
