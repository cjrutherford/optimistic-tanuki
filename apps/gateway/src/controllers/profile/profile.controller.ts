import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AIOrchestrationCommands,
  PersonaTelosCommands,
  ProfileCommands,
  AuthCommands,
  ServiceTokens,
  TimelineCommands,
  RoleCommands,
  AppScopeCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateProfileDto,
  CreateTimelineDto,
  UpdateProfileDto,
  UpdateTimelineDto,
  ProfileDto,
  PersonaTelosDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { AppScope } from '../../decorators/appscope.decorator';
import {
  RoleInitService,
  RoleInitBuilder,
} from '@optimistic-tanuki/permission-lib';

@ApiTags('profile')
@Controller('profile')
@UseGuards(AuthGuard, PermissionsGuard)
export class ProfileController {
  private readonly OWNER_ROLE_NAMES = [
    'owner_console_owner',
    'global_admin',
    'system_admin',
  ];

  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.PROFILE_SERVICE) private readonly client: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiClient: ClientProxy,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsClient: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    private readonly roleInit: RoleInitService
  ) {}

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new profile' })
  @ApiResponse({
    status: 201,
    description: 'The profile has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @Post()
  async createProfile(
    @Body() createProfileDto: CreateProfileDto & { appId?: string },
    @AppScope() appScope: string
  ) {
    const createdProfile: ProfileDto = await firstValueFrom(
      this.client.send({ cmd: ProfileCommands.Create }, createProfileDto)
    );
    this.l.log(`Profile created with ID: ${createdProfile.id}`);
    if (['forgeofwill'].includes(createProfileDto.appId))
      firstValueFrom(
        this.aiClient.send(
          { cmd: AIOrchestrationCommands.PROFILE_INITIALIZE },
          { profileId: createdProfile.id, appId: createProfileDto.appId }
        )
      )
        .then(() => {
          this.l.log(
            `AI orchestration initialized for profile ID: ${createdProfile.id}`
          );
        })
        .catch((e) => this.l.error('Error initializing AI orchestration:', e));

    // Initialize permissions for the profile
    await this.initializeProfilePermissions(
      createdProfile,
      createProfileDto.userId,
      appScope
    );

    // Attempt to request a refreshed token that includes the profileId so callers can switch tokens
    try {
      const issueResp: any = await firstValueFrom(
        this.authClient.send(
          { cmd: AuthCommands.Issue },
          { userId: createProfileDto.userId, profileId: createdProfile.id }
        )
      );
      const newToken = issueResp?.data?.newToken || issueResp?.newToken || null;
      if (newToken) {
        return { profile: createdProfile, newToken };
      }
    } catch (e) {
      this.l.warn(
        'Could not issue refreshed token for profile creation:',
        e?.message || e
      );
    }

    return createdProfile;
  }

  /**
   * Initialize permissions for a newly created profile.
   * Checks for existing global roles to determine if user should get owner or standard roles.
   * Always includes asset permissions for profile picture/cover uploads.
   */
  private async initializeProfilePermissions(
    profile: ProfileDto,
    userId: string,
    appScope: string
  ): Promise<void> {
    try {
      const effectiveAppScope =
        appScope === 'owner-console' ? 'global' : appScope;

      // Check if user has existing global owner roles
      const hasGlobalOwnerRoles = await this.checkUserHasGlobalOwnerRoles(
        profile.id
      );

      const builder = new RoleInitBuilder()
        .setScopeName(effectiveAppScope)
        .setProfile(profile.id)
        .addDefaultProfileOwner(profile.id, effectiveAppScope)
        .addAssetOwnerPermissions(); // Always allow asset operations for profile updates

      if (hasGlobalOwnerRoles) {
        // User has global owner roles, assign owner roles for this app scope
        this.l.log(
          `User has global owner roles, assigning owner roles for ${effectiveAppScope}`
        );
        builder.addOwnerScopeDefaults();
      } else {
        // Assign standard user roles for the app scope
        this.l.log(`Assigning standard user roles for ${effectiveAppScope}`);
        builder.addAppScopeDefaults();
      }

      const roleInitOptions = builder.build();
      this.l.debug(
        `initializeProfilePermissions built role init options for profile=${profile.id} scope=${effectiveAppScope}`
      );
      // Use processNow to wait for permissions to be set up before returning
      await this.roleInit.processNow(roleInitOptions);
    } catch (e) {
      this.l.error('Error initializing profile permissions:', e?.message || e);
    }
  }

  /**
   * Check if user has global owner-level roles.
   */
  private async checkUserHasGlobalOwnerRoles(
    profileId: string
  ): Promise<boolean> {
    try {
      const globalScope = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: AppScopeCommands.GetByName },
          'global'
        )
      );

      if (!globalScope) return false;

      const userRoles = await firstValueFrom(
        this.permissionsClient.send(
          { cmd: RoleCommands.GetUserRoles },
          { profileId, appScopeId: globalScope.id }
        )
      );

      // Check if any role is an owner-level role
      return (
        userRoles?.some((assignment: any) =>
          this.OWNER_ROLE_NAMES.includes(assignment.role?.name)
        ) ?? false
      );
    } catch (e) {
      this.l.warn('Could not check global owner roles:', e?.message || e);
      return false;
    }
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get all profiles' })
  @ApiResponse({
    status: 200,
    description: 'The profiles have been successfully retrieved.',
  })
  @ApiResponse({ status: 404, description: 'Profiles not found.' })
  @Get()
  getAllProfiles(
    @User() user: UserDetails,
    @Param('query') query: Partial<ProfileDto>
  ) {
    this.l.debug(`User payload: ${JSON.stringify(user)}`);
    this.l.log(`Fetching all profiles for user: ${user.userId}`);
    return this.client.send(
      { cmd: ProfileCommands.GetAll },
      { userId: user.userId, query }
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get a profile by ID' })
  @ApiResponse({
    status: 200,
    description: 'The profile has been successfully retrieved.',
  })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  @Get(':id')
  async getProfile(@Param('id') id: string, @AppScope() appScope: string) {
    try {
      const profile: ProfileDto = await firstValueFrom(
        this.client.send({ cmd: ProfileCommands.Get }, { id })
      );
      this.l.log(
        `Retrieved profile with ID: ${id}, appScope=${
          profile?.appScope ?? 'unknown'
        }`
      );
      if (!profile) {
        this.l.warn(
          `Profile not found for ID: ${id} attempting to back-fill with ai persona`
        );
        const telos: PersonaTelosDto = await firstValueFrom(
          this.telosDocsClient.send(
            { cmd: PersonaTelosCommands.FIND_ONE },
            { id }
          )
        );
        if (!telos) {
          this.l.error(`No persona found for ID: ${id}`);
          throw new RpcException(
            `Profile with ID ${id} not found and no persona available to back-fill.`
          );
        }
        const personaProfile: ProfileDto = {
          id: telos.id,
          userId: telos.id,
          profileName: telos.name,
          bio: '',
          email: `${telos.name}@optimisitic-tanuki.com`,
          avatarUrl: `assets/${telos.name}-avatar.png`,
          createdAt: new Date(),
          updatedAt: new Date(),
          appScope: appScope === 'owner-console' ? 'global' : appScope,
        };
        this.l.log(
          `Back-filled profile with ID: ${id}, appScope=${personaProfile.appScope}`
        );
        return personaProfile;
      }
      return profile;
    } catch (error) {
      this.l.error(`Error retrieving profile with ID: ${id}`, error);
      throw new RpcException(
        `Failed to retrieve profile with ID ${id}: ${error.message || error}`
      );
    }
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update a profile by ID' })
  @ApiResponse({
    status: 200,
    description: 'The profile has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  @Put(':id')
  @RequirePermissions('profile.update')
  updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return this.client.send(
      { cmd: ProfileCommands.Update },
      { id, ...updateProfileDto }
    );
  }

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a profile by ID' })
  @ApiResponse({
    status: 200,
    description: 'The profile has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Profile not found.' })
  @Delete(':id')
  @RequirePermissions('profile.delete')
  deleteProfile(@Param('id') id: string) {
    return this.client.send({ cmd: ProfileCommands.Delete }, id);
  }

  // Removed unused project/goal endpoint stubs to reduce commented-out scaffolding. See git history if needed.

  @UseGuards(AuthGuard)
  @ApiTags('timeline')
  @ApiOperation({ summary: 'Create a new timeline' })
  @ApiResponse({
    status: 201,
    description: 'The timeline has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @Post('timeline')
  createTimeline(@Body() createTimelineDto: CreateTimelineDto) {
    return this.client.send(
      { cmd: TimelineCommands.Create },
      createTimelineDto
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('timeline')
  @ApiOperation({ summary: 'Get a timeline by ID' })
  @ApiResponse({
    status: 200,
    description: 'The timeline has been successfully retrieved.',
  })
  @ApiResponse({ status: 404, description: 'Timeline not found.' })
  @Get('timeline/:id')
  getTimeline(@Param('id') id: string) {
    return this.client.send({ cmd: TimelineCommands.Get }, id);
  }

  @UseGuards(AuthGuard)
  @ApiTags('timeline')
  @ApiOperation({ summary: 'Update a timeline by ID' })
  @ApiResponse({
    status: 200,
    description: 'The timeline has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Timeline not found.' })
  @Put('timeline/:id')
  updateTimeline(
    @Param('id') id: string,
    @Body() updateTimelineDto: UpdateTimelineDto
  ) {
    return this.client.send(
      { cmd: TimelineCommands.Update },
      { id, ...updateTimelineDto }
    );
  }

  @UseGuards(AuthGuard)
  @ApiTags('timeline')
  @ApiOperation({ summary: 'Delete a timeline by ID' })
  @ApiResponse({
    status: 200,
    description: 'The timeline has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Timeline not found.' })
  @Delete('timeline/:id')
  deleteTimeline(@Param('id') id: string) {
    return this.client.send({ cmd: TimelineCommands.Delete }, id);
  }
}
