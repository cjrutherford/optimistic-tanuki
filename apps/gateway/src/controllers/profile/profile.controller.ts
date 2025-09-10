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
  GoalCommands,
  PersonaTelosCommands,
  ProfileCommands,
  ProjectCommands,
  ServiceTokens,
  TimelineCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateGoalDto,
  CreateProfileDto,
  CreateProjectDto,
  CreateTimelineDto,
  UpdateGoalDto,
  UpdateProfileDto,
  UpdateProjectDto,
  UpdateTimelineDto,
  ProfileDto,
  PersonaTelosDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';
import { firstValueFrom } from 'rxjs';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly l: Logger,
    @Inject(ServiceTokens.PROFILE_SERVICE) private readonly client: ClientProxy,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiClient: ClientProxy,
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telosDocsClient: ClientProxy
  ) {}

  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new profile' })
  @ApiResponse({
    status: 201,
    description: 'The profile has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @Post()
  async createProfile(@Body() createProfileDto: CreateProfileDto) {
    const createdProfile: ProfileDto = await firstValueFrom(
      this.client.send({ cmd: ProfileCommands.Create }, createProfileDto)
    );
    this.l.log(`Profile created with ID: ${createdProfile.id}`);
    firstValueFrom(
      this.aiClient.send(
        { cmd: AIOrchestrationCommands.PROFILE_INITIALIZE },
        { profileId: createdProfile.id }
      )
    ).then(() => {
      this.l.log(
        `AI orchestration initialized for profile ID: ${createdProfile.id}`
      );
    });

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
    console.log(user);
    console.log('Fetching all profiles for user:', user.userId);
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
  async getProfile(@Param('id') id: string) {
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
        avatarUrl: 'assets/ai-avatar.png',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.l.log(`Back-filled profile with ID: ${id}: PROFILE: '${JSON.stringify(personaProfile)}'`);
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
  deleteProfile(@Param('id') id: string) {
    return this.client.send({ cmd: ProfileCommands.Delete }, id);
  }

  // @UseGuards(AuthGuard)
  // @ApiTags('project')
  // @ApiOperation({ summary: 'Create a new project' })
  // @ApiResponse({ status: 201, description: 'The project has been successfully created.' })
  // @ApiResponse({ status: 400, description: 'Bad Request.' })
  // @Post('project')
  // createProject(@Body() createProjectDto: CreateProjectDto) {
  //     return this.client.send({ cmd: ProjectCommands.Create}, createProjectDto);
  // }

  // @UseGuards(AuthGuard)
  // @ApiTags('project')
  // @ApiOperation({ summary: 'Get a project by ID' })
  // @ApiResponse({ status: 200, description: 'The project has been successfully retrieved.' })
  // @ApiResponse({ status: 404, description: 'Project not found.' })
  // @Get('project/:id')
  // getProject(@Param('id') id: string) {
  //     return this.client.send({ cmd: ProjectCommands.Get }, id);
  // }

  // @UseGuards(AuthGuard)
  // @ApiTags('project')
  // @ApiOperation({ summary: 'Update a project by ID' })
  // @ApiResponse({ status: 200, description: 'The project has been successfully updated.' })
  // @ApiResponse({ status: 404, description: 'Project not found.' })
  // @Put('project/:id')
  // updateProject(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
  //     return this.client.send({ cmd: ProjectCommands.Update }, { id, ...updateProjectDto });
  // }

  // @UseGuards(AuthGuard)
  // @ApiTags('project')
  // @ApiOperation({ summary: 'Delete a project by ID' })
  // @ApiResponse({ status: 200, description: 'The project has been successfully deleted.' })
  // @ApiResponse({ status: 404, description: 'Project not found.' })
  // @Delete('project/:id')
  // deleteProject(@Param('id') id: string) {
  //     return this.client.send({ cmd: ProjectCommands.Delete }, id);
  // }

  // @UseGuards(AuthGuard)
  // @ApiTags('goal')
  // @ApiOperation({ summary: 'Create a new goal' })
  // @ApiResponse({ status: 201, description: 'The goal has been successfully created.' })
  // @ApiResponse({ status: 400, description: 'Bad Request.' })
  // @Post('goal')
  // createGoal(@Body() createGoalDto: CreateGoalDto) {
  //     return this.client.send({ cmd: GoalCommands.Create }, createGoalDto);
  // }

  // @UseGuards(AuthGuard)
  // @ApiTags('goal')
  // @ApiOperation({ summary: 'Get a goal by ID' })
  // @ApiResponse({ status: 200, description: 'The goal has been successfully retrieved.' })
  // @ApiResponse({ status: 404, description: 'Goal not found.' })
  // @Get('goal/:id')
  // getGoal(@Param('id') id: string) {
  //     return this.client.send({ cmd: GoalCommands.Get }, id);
  // }

  // @UseGuards(AuthGuard)
  // @ApiTags('goal')
  // @ApiOperation({ summary: 'Update a goal by ID' })
  // @ApiResponse({ status: 200, description: 'The goal has been successfully updated.' })
  // @ApiResponse({ status: 404, description: 'Goal not found.' })
  // @Put('goal/:id')
  // updateGoal(@Param('id') id: string, @Body() updateGoalDto: UpdateGoalDto) {
  //     return this.client.send({ cmd: GoalCommands.Update }, { id, ...updateGoalDto });
  // }

  // @UseGuards(AuthGuard)
  // @ApiTags('goal')
  // @ApiOperation({ summary: 'Delete a goal by ID' })
  // @ApiResponse({ status: 200, description: 'The goal has been successfully deleted.' })
  // @ApiResponse({ status: 404, description: 'Goal not found.' })
  // @Delete('goal/:id')
  // deleteGoal(@Param('id') id: string) {
  //     return this.client.send({ cmd: GoalCommands.Delete }, id);
  // }

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
