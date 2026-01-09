import {
  Body,
  Controller,
  Inject,
  Post,
  HttpException,
  HttpStatus,
  Logger,
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
  ALL_APP_SCOPES,
} from '@optimistic-tanuki/constants';
import { AppScope } from '../../decorators/appscope.decorator';
import {
  RoleInitBuilder,
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';

@ApiTags('authentication')
@Controller('authentication')
export class AuthenticationController {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    private readonly logger: Logger,
    private readonly roleInit: RoleInitService
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
      const effectiveUser: { userId: string } = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.UserIdFromEmail },
          { email: data.email }
        )
      );
      this.logger.debug(
        `loginUser resolved userId=${effectiveUser?.userId} for email=${data.email}`
      );
      const profiles = await firstValueFrom(
        this.profileClient.send(
          { cmd: ProfileCommands.GetAll },
          { where: { userId: effectiveUser.userId } }
        )
      );
      this.logger.debug(
        `loginUser found ${profiles?.length || 0} profile(s) for userId=${
          effectiveUser.userId
        }`
      );

      const effectiveAppScope =
        appScope === 'owner-console' ? 'global' : appScope;

      // Prefer an app-scoped profile; fall back to global if necessary
      let appScopedProfile = profiles.find(
        (p: ProfileDto) => p.appScope === effectiveAppScope
      );
      const globalProfile = profiles.find(
        (p: ProfileDto) => !p.appScope || p.appScope === 'global'
      );

      // If the user is signing into a new app for the first time,
      // create an app-scoped profile and initialize permissions now.
      if (
        !appScopedProfile &&
        effectiveAppScope !== 'global' &&
        globalProfile
      ) {
        this.logger.log(
          `No app-scoped profile found for userId=${effectiveUser.userId} in scope=${effectiveAppScope}. Creating one from global profile ${globalProfile.id}.`
        );

        const newProfile: CreateProfileDto & { appScope: string } = {
          userId: globalProfile.userId,
          name: globalProfile.profileName || data.email,
          description: '',
          profilePic: '',
          coverPic: '',
          bio: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          appScope: effectiveAppScope,
        };

        const createdProfile: ProfileDto = await firstValueFrom(
          this.profileClient.send({ cmd: ProfileCommands.Create }, newProfile)
        );

        this.logger.log(
          `Created app-scoped profile ${createdProfile.id} for userId=${effectiveUser.userId} in scope=${effectiveAppScope}`
        );

        // Initialize permissions for this new app-scoped profile so that
        // profile.update and asset.* operations work immediately.
        const builder = new RoleInitBuilder()
          .setScopeName(effectiveAppScope)
          .setProfile(createdProfile.id)
          .addDefaultProfileOwner(createdProfile.id, effectiveAppScope)
          .addAppScopeDefaults()
          .addAssetOwnerPermissions();

        const roleInitOptions = builder.build();
        this.logger.debug(
          `loginUser initializing permissions for profile=${createdProfile.id} scope=${effectiveAppScope}`
        );
        await this.roleInit.processNow(roleInitOptions);

        appScopedProfile = createdProfile;
      }

      const profileToUse =
        appScopedProfile || globalProfile || profiles[0] || null;

      if (!profileToUse) {
        this.logger.error(
          `loginUser could not resolve a profile for userId=${effectiveUser.userId}`
        );
        throw new Error('No profile available for user');
      }

      this.logger.debug(
        `loginUser using profileId=${profileToUse.id} appScope=${profileToUse.appScope}`
      );
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.Login },
          { ...data, profileId: profileToUse.id }
        )
      );
    } catch (error) {
      this.logger.error('Error in loginUser:', error?.message || error);
      throw new HttpException(
        `Login failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async registerUser(
    @Body() data: RegisterRequest,
    @AppScope() appScope: string
  ) {
    try {
      this.logger.debug('registerUser called');
      const result = await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.Register }, data)
      );
      this.logger.log(
        `Registered user with id=${result?.data?.user?.id} email=${result?.data?.user?.email}`
      );
      const newProfile: CreateProfileDto & { appScope: string } = {
        userId: result.data.user.id,
        name: `${result.data.user.firstName} ${result.data.user.lastName}`,
        coverPic: '',
        profilePic: '',
        bio: '',
        location: '',
        description: '',
        occupation: '',
        interests: '',
        skills: '',
        appScope: appScope === 'owner-console' ? 'global' : appScope,
      };
      this.logger.debug(
        `Creating initial profile for userId=${newProfile.userId} scope=${newProfile.appScope}`
      );
      const createdProfile = await firstValueFrom(
        this.profileClient.send({ cmd: ProfileCommands.Create }, newProfile)
      );

      // Special handling for owner-console: create profiles for all app scopes with owner roles
      if (appScope === 'owner-console') {
        this.logger.log(
          `Registering owner user - initializing global owner permissions`
        );

        // Assign owner-level roles for this scope with full control permissions
        const builder = new RoleInitBuilder()
          .setScopeName('global')
          .setProfile(createdProfile.id)
          .assignOwnerRole()
          .addOwnerScopeDefaults()
          .addAssetOwnerPermissions();

        const roleInitOptions = builder.build();
        this.logger.debug(
          `registerUser enqueueing owner permissions for profile=${createdProfile.id} scope=global`
        );
        this.roleInit.enqueue(roleInitOptions);
      } else {
        // Standard registration flow
        const profilePermissionsBuilder = new RoleInitBuilder()
          .setScopeName(appScope)
          .setProfile(createdProfile.id)
          .addDefaultProfileOwner(createdProfile.id, appScope)
          .addAppScopeDefaults()
          .addAssetOwnerPermissions();
        this.logger.log(
          `Initializing standard permissions for userId=${newProfile.userId} scope=${appScope}`
        );
        const roleInitOptions = profilePermissionsBuilder.build();
        this.logger.debug(
          `registerUser enqueueing standard permissions for profile=${createdProfile.id} scope=${appScope}`
        );
        this.roleInit.enqueue(roleInitOptions);
      }
      return result;
    } catch (error) {
      this.logger.error('Error in registerUser:', error?.message || error);
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
}
