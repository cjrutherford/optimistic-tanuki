import { Body, Controller, Delete, Get, Inject, Logger, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { 
    GoalCommands, ProfileCommands, 
    ProjectCommands, ServiceTokens,
    TimelineCommands
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
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
    constructor(
        private readonly l: Logger,
        @Inject(ServiceTokens.PROFILE_SERVICE) private readonly client: ClientProxy,
        @Inject(ServiceTokens.ASSETS_SERVICE) private readonly assetClient: ClientProxy
    ) {}
    
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Create a new profile' })
    @ApiResponse({ status: 201, description: 'The profile has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @Post()
    createProfile(@Body() createProfileDto: CreateProfileDto) {
        return this.client.send({ cmd: ProfileCommands.Create }, createProfileDto);
    }

    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get all profiles' })
    @ApiResponse({ status: 200, description: 'The profiles have been successfully retrieved.' })
    @ApiResponse({ status: 404, description: 'Profiles not found.' })
    @Get()
    getAllProfiles(@User() user: UserDetails, @Param('query') query: Partial<ProfileDto>) {
        console.log(user);
        console.log("Fetching all profiles for user:", user.userId);
        return this.client.send({ cmd: ProfileCommands.GetAll }, { userId: user.userId, query });

    }

    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get a profile by ID' })
    @ApiResponse({ status: 200, description: 'The profile has been successfully retrieved.' })
    @ApiResponse({ status: 404, description: 'Profile not found.' })
    @Get(':id')
    getProfile(@Param('id') id: string) {
        return this.client.send({ cmd: ProfileCommands.Get }, { id });
    }

    /**
 * Controller for handling profile-related API requests.
 */
@ApiTags('profile')
@Controller('profile')
export class ProfileController {
    /**
     * Creates an instance of ProfileController.
     * @param l The logger instance.
     * @param client Client proxy for the profile microservice.
     * @param assetClient Client proxy for the assets microservice.
     */
    constructor(
        private readonly l: Logger,
        @Inject(ServiceTokens.PROFILE_SERVICE) private readonly client: ClientProxy,
        @Inject(ServiceTokens.ASSETS_SERVICE) private readonly assetClient: ClientProxy
    ){}
    
    /**
     * Creates a new profile.
     * @param createProfileDto The data for creating the profile.
     * @returns A Promise that resolves to the created profile.
     */
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Create a new profile' })
    @ApiResponse({ status: 201, description: 'The profile has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @Post()
    createProfile(@Body() createProfileDto: CreateProfileDto) {
        return this.client.send({ cmd: ProfileCommands.Create }, createProfileDto);
    }

    /**
     * Retrieves all profiles for the authenticated user.
     * @param user The authenticated user details.
     * @param query Optional query parameters for filtering profiles.
     * @returns A Promise that resolves to an array of profiles.
     */
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get all profiles' })
    @ApiResponse({ status: 200, description: 'The profiles have been successfully retrieved.' })
    @ApiResponse({ status: 404, description: 'Profiles not found.' })
    @Get()
    getAllProfiles(@User() user: UserDetails, @Param('query') query: Partial<ProfileDto>) {
        console.log(user);
        console.log("Fetching all profiles for user:", user.userId);
        return this.client.send({ cmd: ProfileCommands.GetAll }, { userId: user.userId, query });

    }

    /**
     * Retrieves a profile by its ID.
     * @param id The ID of the profile to retrieve.
     * @returns A Promise that resolves to the retrieved profile.
     */
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Get a profile by ID' })
    @ApiResponse({ status: 200, description: 'The profile has been successfully retrieved.' })
    @ApiResponse({ status: 404, description: 'Profile not found.' })
    @Get(':id')
    getProfile(@Param('id') id: string) {
        return this.client.send({ cmd: ProfileCommands.Get }, { id });
    }

    /**
     * Updates a profile by its ID.
     * @param id The ID of the profile to update.
     * @param updateProfileDto The data for updating the profile.
     * @returns A Promise that resolves to the updated profile.
     */
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Update a profile by ID' })
    @ApiResponse({ status: 200, description: 'The profile has been successfully updated.' })
    @ApiResponse({ status: 404, description: 'Profile not found.' })
    @Put(':id')
    updateProfile(@Param('id') id: string, @Body() updateProfileDto: UpdateProfileDto) {
        return this.client.send({ cmd: ProfileCommands.Update }, { id, ...updateProfileDto });
    }

    /**
     * Deletes a profile by its ID.
     * @param id The ID of the profile to delete.
     * @returns A Promise that resolves when the profile is deleted.
     */
    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Delete a profile by ID' })
    @ApiResponse({ status: 200, description: 'The profile has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'Profile not found.' })
    @Delete(':id')
    deleteProfile(@Param('id') id: string) {
        return this.client.send({ cmd: ProfileCommands.Delete}, id);
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

    /**
     * Creates a new timeline.
     * @param createTimelineDto The data for creating the timeline.
     * @returns A Promise that resolves to the created timeline.
     */
    @UseGuards(AuthGuard)
    @ApiTags('timeline')
    @ApiOperation({ summary: 'Create a new timeline' })
    @ApiResponse({ status: 201, description: 'The timeline has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @Post('timeline')
    createTimeline(@Body() createTimelineDto: CreateTimelineDto) {
        return this.client.send({ cmd: TimelineCommands.Create }, createTimelineDto);
    }

    /**
     * Retrieves a timeline by its ID.
     * @param id The ID of the timeline to retrieve.
     * @returns A Promise that resolves to the retrieved timeline.
     */
    @UseGuards(AuthGuard)
    @ApiTags('timeline')
    @ApiOperation({ summary: 'Get a timeline by ID' })
    @ApiResponse({ status: 200, description: 'The timeline has been successfully retrieved.' })
    @ApiResponse({ status: 404, description: 'Timeline not found.' })
    @Get('timeline/:id')
    getTimeline(@Param('id') id: string) {
        return this.client.send({ cmd: TimelineCommands.Get }, id);
    }

    /**
     * Updates a timeline by its ID.
     * @param id The ID of the timeline to update.
     * @param updateTimelineDto The data for updating the timeline.
     * @returns A Promise that resolves to the updated timeline.
     */
    @UseGuards(AuthGuard)
    @ApiTags('timeline')
    @ApiOperation({ summary: 'Update a timeline by ID' })
    @ApiResponse({ status: 200, description: 'The timeline has been successfully updated.' })
    @ApiResponse({ status: 404, description: 'Timeline not found.' })
    @Put('timeline/:id')
    updateTimeline(@Param('id') id: string, @Body() updateTimelineDto: UpdateTimelineDto) {
        return this.client.send({ cmd: TimelineCommands.Update }, { id, ...updateTimelineDto });
    }

    /**
     * Deletes a timeline by its ID.
     * @param id The ID of the timeline to delete.
     * @returns A Promise that resolves when the timeline is deleted.
     */
    @UseGuards(AuthGuard)
    @ApiTags('timeline')
    @ApiOperation({ summary: 'Delete a timeline by ID' })
    @ApiResponse({ status: 200, description: 'The timeline has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'Timeline not found.' })
    @Delete('timeline/:id')
    deleteTimeline(@Param('id') id: string) {
        return this.client.send({ cmd: TimelineCommands.Delete }, id);
    }
}

    @UseGuards(AuthGuard)
    @ApiOperation({ summary: 'Delete a profile by ID' })
    @ApiResponse({ status: 200, description: 'The profile has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'Profile not found.' })
    @Delete(':id')
    deleteProfile(@Param('id') id: string) {
        return this.client.send({ cmd: ProfileCommands.Delete}, id);
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
    @ApiResponse({ status: 201, description: 'The timeline has been successfully created.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @Post('timeline')
    createTimeline(@Body() createTimelineDto: CreateTimelineDto) {
        return this.client.send({ cmd: TimelineCommands.Create }, createTimelineDto);
    }

    @UseGuards(AuthGuard)
    @ApiTags('timeline')
    @ApiOperation({ summary: 'Get a timeline by ID' })
    @ApiResponse({ status: 200, description: 'The timeline has been successfully retrieved.' })
    @ApiResponse({ status: 404, description: 'Timeline not found.' })
    @Get('timeline/:id')
    getTimeline(@Param('id') id: string) {
        return this.client.send({ cmd: TimelineCommands.Get }, id);
    }

    @UseGuards(AuthGuard)
    @ApiTags('timeline')
    @ApiOperation({ summary: 'Update a timeline by ID' })
    @ApiResponse({ status: 200, description: 'The timeline has been successfully updated.' })
    @ApiResponse({ status: 404, description: 'Timeline not found.' })
    @Put('timeline/:id')
    updateTimeline(@Param('id') id: string, @Body() updateTimelineDto: UpdateTimelineDto) {
        return this.client.send({ cmd: TimelineCommands.Update }, { id, ...updateTimelineDto });
    }

    @UseGuards(AuthGuard)
    @ApiTags('timeline')
    @ApiOperation({ summary: 'Delete a timeline by ID' })
    @ApiResponse({ status: 200, description: 'The timeline has been successfully deleted.' })
    @ApiResponse({ status: 404, description: 'Timeline not found.' })
    @Delete('timeline/:id')
    deleteTimeline(@Param('id') id: string) {
        return this.client.send({ cmd: TimelineCommands.Delete }, id);
    }
}
