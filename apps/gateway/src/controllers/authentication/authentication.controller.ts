import {
  Body,
  Controller,
  Inject,
  Post,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CreateProductDto,
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
  ProductCommands,
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
import type {
  AppRegistry,
  AppRegistration,
} from '@optimistic-tanuki/app-registry-backend';
import { isApprovedAuthEmailSender } from '@optimistic-tanuki/app-registry-backend';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.controller';
import { Public } from '../../decorators/public.decorator';

type EmailActionPurpose = 'verification' | 'password-reset' | 'magic-link';

@ApiTags('authentication')
@Controller('authentication')
export class AuthenticationController {
  private static readonly BUSINESS_OWNER_STARTER_PRODUCTS: CreateProductDto[] =
    [
      {
        name: 'Discovery Session',
        description:
          'Starter consultation offer to help new owners publish a store-backed service catalog immediately.',
        price: 95,
        type: 'service',
        stock: 0,
        active: true,
      },
      {
        name: 'Signature Service',
        description:
          'Publish-ready starter service product you can rename, reprice, and tailor to your workflow.',
        price: 250,
        type: 'service',
        stock: 0,
        active: true,
      },
    ];

  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    @Inject(ServiceTokens.STORE_SERVICE)
    private readonly storeClient: ClientProxy,
    private readonly logger: Logger,
    private readonly roleInit: RoleInitService,
    private readonly loginBootstrap: LoginAccountBootstrapService,
    private readonly registerBootstrap: RegisterAccountBootstrapService,
    @Inject(GATEWAY_APP_REGISTRY)
    private readonly appRegistry: AppRegistry
  ) {
    this.authClient
      .connect()
      .then(() => {
        console.log('AuthenticationController connected to authClient');
      })
      .catch((e) => console.error(e));
  }

  @Post('email-action/request')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async requestEmailAction(
    @Headers('x-ot-app-id') appId: string,
    @Body('purpose') purpose: EmailActionPurpose,
    @Body()
    body: { email: string; purpose?: EmailActionPurpose; returnPath?: string }
  ) {
    const app = this.resolveEmailApp(appId);
    const allowedPurposes: EmailActionPurpose[] = [
      'verification',
      'password-reset',
      'magic-link',
    ];
    if (!allowedPurposes.includes(purpose)) {
      throw new HttpException(
        'Invalid email action purpose',
        HttpStatus.BAD_REQUEST
      );
    }
    if (typeof body.email !== 'string' || body.email.trim().length === 0) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }
    const email = body.email.trim();
    await firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.RequestEmailAuthAction },
        {
          email,
          purpose,
          context: {
            appId: app.appId,
            appName: app.name,
            uiBaseUrl: app.uiBaseUrl,
            from: app.authEmail!.from,
            replyTo: app.authEmail!.replyTo,
            returnPath: this.safeReturnPath(body.returnPath),
          },
        }
      )
    );
    return { accepted: true };
  }

  @Post('email-verification/confirm')
  @Public()
  confirmEmailVerification(@Body() body: { token: string }) {
    return this.consumeEmailLogin(body.token, 'verification');
  }

  @Post('magic-link/confirm')
  @Public()
  confirmMagicLink(@Body() body: { token: string }) {
    return this.consumeEmailLogin(body.token, 'magic-link');
  }

  @Post('password-reset/confirm')
  @Public()
  confirmPasswordReset(
    @Body() body: { token: string; password: string; confirmation: string }
  ) {
    return firstValueFrom(
      this.authClient.send({ cmd: AuthCommands.ConfirmPasswordReset }, body)
    );
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
        `Login failed: ${this.errorMessage(error)}`,
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
        `Token issue failed: ${this.errorMessage(error)}`,
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
        `Token exchange failed: ${this.errorMessage(error)}`,
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
    @AppScope() appScope: string,
    @Headers('x-ot-app-id') appId?: string
  ) {
    try {
      this.logger.debug('registerUser called');
      const result = await this.registerBootstrap.register(data, appScope);
      const canonicalAppId = appId || this.canonicalAppForScope(appScope);
      if (canonicalAppId && !result?.data?.user?.emailVerifiedAt) {
        try {
          await this.requestEmailAction(canonicalAppId, 'verification', {
            email: data.email,
            returnPath: '/',
          });
        } catch (deliveryError) {
          this.logger.error(
            'Registration succeeded but verification delivery failed',
            this.errorMessage(deliveryError)
          );
        }
      }
      return result;
    } catch (error) {
      this.logger.error(
        'Error in registerUser:',
        error?.message || JSON.stringify(error)
      );
      throw new HttpException(
        `Registration failed: ${this.errorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('owner-access')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Grant owner access for the current user in the active app scope',
  })
  @ApiResponse({ status: 201, description: 'Owner access granted.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async claimOwnerAccess(
    @User() user: UserDetails,
    @AppScope() appScope: string
  ) {
    const effectiveAppScope =
      appScope === 'owner-console' ? 'global' : appScope;

    try {
      const profile = await this.getOrCreateAppScopedProfile(
        user,
        effectiveAppScope
      );

      await this.roleInit.processNow(
        new RoleInitBuilder()
          .setScopeName(effectiveAppScope)
          .setProfile(profile.id)
          .addDefaultProfileOwner(profile.id, effectiveAppScope)
          .addOwnerScopeDefaults()
          .addAssetOwnerPermissions()
          .build()
      );

      await this.seedBusinessOwnerProductsIfNeeded(
        user.userId,
        effectiveAppScope
      );

      return {
        profileId: profile.id,
        appScope: effectiveAppScope,
        ownerAccess: true,
      };
    } catch (error) {
      this.logger.error(
        'Error in claimOwnerAccess:',
        error?.message || JSON.stringify(error)
      );
      throw new HttpException(
        `Owner access failed: ${this.errorMessage(error)}`,
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
        `Password reset failed: ${this.errorMessage(error)}`,
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
        `Enable MFA failed: ${this.errorMessage(error)}`,
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
        `Token validation failed: ${this.errorMessage(error)}`,
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
        `MFA validation failed: ${this.errorMessage(error)}`,
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
        `Send MFA setup email failed: ${this.errorMessage(error)}`,
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
        `Send MFA verification email failed: ${this.errorMessage(error)}`,
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
        `Logout failed: ${this.errorMessage(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private resolveEmailApp(appId: string): AppRegistration {
    const app = this.appRegistry.apps.find((entry) => entry.appId === appId);
    if (!app?.authEmail?.enabled || !app.authEmail.from) {
      throw new HttpException(
        'Email authentication is not configured for this application',
        HttpStatus.BAD_REQUEST
      );
    }
    if (!isApprovedAuthEmailSender(app.authEmail.from)) {
      throw new HttpException(
        'Email authentication sender must use an approved root domain',
        HttpStatus.BAD_REQUEST
      );
    }
    if (
      process.env.NODE_ENV === 'production' &&
      /localhost|127\.0\.0\.1/.test(app.uiBaseUrl)
    ) {
      throw new HttpException(
        'Email authentication callback URL is not production-ready',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    return app;
  }

  private safeReturnPath(path?: string): string {
    return path?.startsWith('/') && !path.startsWith('//') ? path : '/';
  }

  private async consumeEmailLogin(
    token: string,
    purpose: 'verification' | 'magic-link'
  ) {
    const inspected = (await firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.InspectEmailAuthAction },
        { token, purpose }
      )
    )) as { userId: string; email: string; appId: string; returnPath: string };
    this.resolveEmailApp(inspected.appId);
    const profileScope = this.profileScopeForApp(inspected.appId);
    const profile = await this.getOrCreateAppScopedProfile(
      {
        userId: inspected.userId,
        email: inspected.email,
      } as UserDetails,
      profileScope
    );
    return firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.ConsumeEmailAuthAction },
        { token, purpose, profileId: profile.id }
      )
    );
  }

  private profileScopeForApp(appId: string): string {
    return (
      (
        {
          'opportunity-compass': 'leads-app',
          'fin-commander': 'finance',
          'video-platform': 'video-platform',
          d6: 'D6',
        } as Record<string, string>
      )[appId] || appId
    );
  }

  private canonicalAppForScope(appScope: string): string | null {
    const alias = (
      {
        'leads-app': 'opportunity-compass',
        finance: 'fin-commander',
        'video-client': 'video-platform',
        D6: 'd6',
      } as Record<string, string>
    )[appScope];
    const appId = alias || appScope;
    return this.appRegistry.apps.some((app) => app.appId === appId)
      ? appId
      : null;
  }

  private errorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unknown authentication error';
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

  private async seedBusinessOwnerProductsIfNeeded(
    ownerId: string,
    appScope: string
  ): Promise<void> {
    if (appScope !== 'business-site') {
      return;
    }

    const existingProducts =
      ((await firstValueFrom(
        this.storeClient.send(ProductCommands.FIND_OWNER_PRODUCTS, ownerId)
      )) as Array<{ ownerId?: string | null }>) ?? [];

    const hasOwnedProducts = existingProducts.some(
      (product) => product?.ownerId === ownerId
    );

    if (hasOwnedProducts) {
      return;
    }

    for (const product of AuthenticationController.BUSINESS_OWNER_STARTER_PRODUCTS) {
      await firstValueFrom(
        this.storeClient.send(ProductCommands.CREATE_PRODUCT, {
          ...product,
          ownerId,
        })
      );
    }
  }
}
