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
  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.PROFILE_SERVICE) private readonly client: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiClient: ClientProxy,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsClient: ClientProxy,
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
    // this is where we will initialize the permissions for the user in the app scope we are making the profile for.

    // const profilePermissionsBuilder = new RoleInitBuilder()
    //   .addDefaultProfileOwner(createdProfile.id, createProfileDto.userId)
    //   .setScopeName(appScope)
    //   .addAppScopeDefaults()
    //   .addAssetOwnerPermissions();
    // this.l.log(`Initializing permissions for app scope: ${appScope}`);
    // // Build role-init options and enqueue a job to initialize the default permissions
    // // Note: CreateProfileDto may not declare `initialPermissions` in the shared models;
    // // if callers provide additional permissions they can be merged here before enqueue.
    // const roleInitOptions = profilePermissionsBuilder.build();
    // this.roleInit.enqueue(roleInitOptions);
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
    const profile: ProfileDto = await firstValueFrom(
      this.client.send({ cmd: ProfileCommands.Get }, { id })
    );
    this.l.log(
      `Retrieved profile with ID: ${id}: PROFILE: '${JSON.stringify(profile)}'`
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
        profileName: telos.name,
        bio: '',
        email: '',
        avatarUrl: `assets/${telos.name}-avatar.png`,
        createdAt: new Date(),
        updatedAt: new Date(),
        appScope: appScope === 'owner-console' ? 'global' : appScope,
      };
      this.l.log(
        `Back-filled profile with ID: ${id}: PROFILE: '${JSON.stringify(
          personaProfile
        )}'`
      );
      return personaProfile;
    }
    return profile;
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
