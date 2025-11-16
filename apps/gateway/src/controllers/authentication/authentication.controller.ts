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
      const effectiveUser = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.UserIdFromEmail },
          { email: data.email }
        )
      );
      const profile = await firstValueFrom(
        this.profileClient.send(
          { cmd: ProfileCommands.Get },
          { userId: effectiveUser, appScope }
        )
      );
      return await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.Login },
          { ...data, profileId: profile.id }
        )
      );
    } catch (error) {
      console.error('Error in loginUser:', error);
      throw new HttpException(
        `Login failed: ${error}`,
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
      console.log('registerUser:', data);
      const result = await firstValueFrom(
        this.authClient.send({ cmd: AuthCommands.Register }, data)
      );
      console.log('Registered user:', result);
      const newProfile: CreateProfileDto = {
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
      };
      console.log('Creating profile for new user:', newProfile);
      const createdProfile = await firstValueFrom(
        this.profileClient.send({ cmd: ProfileCommands.Create }, newProfile)
      );

      // Special handling for owner-console: assign owner roles for all app scopes
      if (appScope === 'owner-console') {
        this.logger.log(`Registering owner user for all app scopes`);
        const allAppScopes = [
          'global',
          'forgeofwill',
          'client-interface',
          'digital-homestead',
          'christopherrutherford-net',
          'blogging',
          'project-planning',
          'assets',
          'social',
          'authentication',
          'profile',
          'owner-console',
        ];
        
        for (const scope of allAppScopes) {
          const builder = new RoleInitBuilder()
            .setScopeName(scope)
            .setProfile(createdProfile.id)
            .addDefaultProfileOwner(createdProfile.id, scope);
          
          // For owner-console scope specifically, add owner role
          if (scope === 'owner-console') {
            builder.addAppScopeDefaults();
          }
          
          const roleInitOptions = builder.build();
          this.roleInit.enqueue(roleInitOptions);
        }
      } else {
        // Standard registration flow
        const profilePermissionsBuilder = new RoleInitBuilder()
          .setScopeName(appScope)
          .setProfile(createdProfile.id)
          .addDefaultProfileOwner(createdProfile.id, appScope)
          .addAppScopeDefaults()
          .addAssetOwnerPermissions();
        this.logger.log(`Initializing permissions for app scope: ${appScope}`);
        const roleInitOptions = profilePermissionsBuilder.build();
        this.roleInit.enqueue(roleInitOptions);
      }
      return result;
    } catch (error) {
      console.dir(error);
      console.error('Error in registerUser:', error);
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
