import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  LeadAnalysisCommands,
  LeadCommands,
  LeadFlagCommands,
  LeadOnboardingCommands,
  LeadTopicCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  ConfirmOnboardingRequest,
  CreateLeadDto,
  CreateLeadFlagDto,
  CreateLeadTopicDto,
  DiscInterviewRequest,
  LeadTopicDiscoveryResultDto,
  LocationAutocompleteSuggestion,
  MadLibAnalysisResult,
  ResumeParseResult,
  UpdateLeadDto,
  UpdateLeadTopicDto,
} from '@optimistic-tanuki/models/leads-contracts';
import { UserContext } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { AppScope } from '../../decorators/appscope.decorator';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';

@ApiTags('leads')
@Controller('leads')
@UseGuards(AuthGuard, PermissionsGuard)
export class LeadsController {
  constructor(
    @Inject(ServiceTokens.LEAD_SERVICE)
    private readonly leadClient: ClientProxy
  ) {}

  private getContext(user: UserContext, appScope: string) {
    if (!user?.profileId) {
      throw new ForbiddenException('An active leads profile is required.');
    }

    return {
      userId: user.userId,
      profileId: user.profileId,
      appScope,
    };
  }

  @Get()
  @RequirePermissions('lead.read')
  @ApiOperation({ summary: 'Get all leads' })
  async findAll(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Query('status') status?: string,
    @Query('source') source?: string
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.FIND_ALL }, {
        status,
        source,
        ...this.getContext(user, appScope),
      })
    );
  }

  @Get('stats/overview')
  @RequirePermissions('lead.read')
  @ApiOperation({ summary: 'Get lead statistics' })
  async getStats(@User() user: UserContext, @AppScope() appScope: string) {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadCommands.GET_STATS },
        this.getContext(user, appScope)
      )
    );
  }

  @Get('topics')
  @RequirePermissions('lead.topic.read')
  @ApiOperation({ summary: 'Get all lead topics' })
  async findAllTopics(@User() user: UserContext, @AppScope() appScope: string) {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadTopicCommands.FIND_ALL },
        this.getContext(user, appScope)
      )
    );
  }

  @Post('topics')
  @RequirePermissions('lead.topic.create')
  @ApiOperation({ summary: 'Create lead topic' })
  async createTopic(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Body() dto: CreateLeadTopicDto
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadTopicCommands.CREATE }, {
        dto,
        context: this.getContext(user, appScope),
      })
    );
  }

  @Patch('topics/:id')
  @RequirePermissions('lead.topic.update')
  @ApiOperation({ summary: 'Update lead topic' })
  async updateTopic(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadTopicDto
  ) {
    const topic = await firstValueFrom(
      this.leadClient.send({ cmd: LeadTopicCommands.UPDATE }, {
        id,
        dto,
        ...this.getContext(user, appScope),
      })
    );

    if (!topic) {
      throw new NotFoundException(`Lead topic ${id} not found`);
    }

    return topic;
  }

  @Delete('topics/:id')
  @RequirePermissions('lead.topic.delete')
  @ApiOperation({ summary: 'Delete lead topic' })
  async deleteTopic(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadTopicCommands.DELETE }, {
        id,
        ...this.getContext(user, appScope),
      })
    );
  }

  @Post('topics/:id/discover')
  @HttpCode(200)
  @RequirePermissions('lead.topic.run')
  @ApiOperation({ summary: 'Run discovery for a lead topic' })
  async runTopicDiscovery(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ): Promise<LeadTopicDiscoveryResultDto> {
    const result = await firstValueFrom(
      this.leadClient.send({ cmd: LeadTopicCommands.RUN_DISCOVERY }, {
        topicId: id,
        ...this.getContext(user, appScope),
      })
    );

    if (!result) {
      throw new NotFoundException(`Lead topic ${id} not found`);
    }

    return result;
  }

  @Get('topics/:id/discovery-status')
  @RequirePermissions('lead.topic.read')
  @ApiOperation({ summary: 'Get discovery status for a lead topic' })
  async getTopicDiscoveryStatus(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ): Promise<LeadTopicDiscoveryResultDto> {
    const result = await firstValueFrom(
      this.leadClient.send({ cmd: LeadTopicCommands.GET_DISCOVERY_STATUS }, {
        topicId: id,
        ...this.getContext(user, appScope),
      })
    );

    if (!result) {
      throw new NotFoundException(`Lead topic ${id} not found`);
    }

    return result;
  }

  @Get(':id')
  @RequirePermissions('lead.read')
  @ApiOperation({ summary: 'Get lead by ID' })
  async findOne(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ) {
    const lead = await firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.FIND_ONE }, {
        id,
        ...this.getContext(user, appScope),
      })
    );

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return lead;
  }

  @Post()
  @RequirePermissions('lead.create')
  @ApiOperation({ summary: 'Create lead' })
  async create(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Body() dto: CreateLeadDto
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.CREATE }, {
        dto,
        context: this.getContext(user, appScope),
      })
    );
  }

  @Patch(':id')
  @RequirePermissions('lead.update')
  @ApiOperation({ summary: 'Partially update lead' })
  async patch(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto
  ) {
    const lead = await firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.UPDATE }, {
        id,
        dto,
        ...this.getContext(user, appScope),
      })
    );

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return lead;
  }

  @Put(':id')
  @RequirePermissions('lead.update')
  @ApiOperation({ summary: 'Update lead' })
  async update(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto
  ) {
    const lead = await firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.UPDATE }, {
        id,
        dto,
        ...this.getContext(user, appScope),
      })
    );

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    return lead;
  }

  @Delete(':id')
  @RequirePermissions('lead.delete')
  @ApiOperation({ summary: 'Delete lead' })
  async delete(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadCommands.DELETE }, {
        id,
        ...this.getContext(user, appScope),
      })
    );
  }

  @Get(':id/flags')
  @RequirePermissions('lead.flag.read')
  @ApiOperation({ summary: 'Get flags for a lead' })
  async findFlagsByLead(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadFlagCommands.FIND_BY_LEAD }, {
        leadId: id,
        ...this.getContext(user, appScope),
      })
    );
  }

  @Post(':id/flags')
  @RequirePermissions('lead.flag.create')
  @ApiOperation({ summary: 'Create a flag for a lead' })
  async createFlag(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string,
    @Body() dto: CreateLeadFlagDto
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadFlagCommands.CREATE }, {
        leadId: id,
        dto,
        context: this.getContext(user, appScope),
      })
    );
  }

  @Post('onboarding/analyze')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({ summary: 'Analyze onboarding profile and generate topics' })
  async analyzeOnboarding(@Body() profile: Record<string, any>) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadOnboardingCommands.ANALYZE }, profile)
    );
  }

  @Post('onboarding/mad-lib/analyze')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({ summary: 'Analyze a mad-lib onboarding prompt' })
  async analyzeMadLib(
    @Body() body: { text: string }
  ): Promise<MadLibAnalysisResult> {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadOnboardingCommands.ANALYZE_MAD_LIB }, body)
    );
  }

  @Post('onboarding/resume/parse')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({ summary: 'Parse a resume upload for onboarding prefill' })
  async parseResume(
    @UploadedFile()
    file: { originalname: string; mimetype: string; buffer: Buffer }
  ): Promise<ResumeParseResult> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadOnboardingCommands.PARSE_RESUME },
        {
          filename: file.originalname,
          mimeType: file.mimetype,
          contentBase64: file.buffer.toString('base64'),
        }
      )
    );
  }

  @Get('locations/autocomplete')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({ summary: 'Autocomplete city/location inputs for Maps searches' })
  async autocompleteLocations(
    @Query('q') query?: string
  ): Promise<LocationAutocompleteSuggestion[]> {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadOnboardingCommands.AUTOCOMPLETE_LOCATIONS },
        { query: query || '' }
      )
    );
  }

  @Post('onboarding/disc/advance')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({ summary: 'Advance the onboarding DISC interview' })
  async advanceDiscInterview(@Body() body: DiscInterviewRequest) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadOnboardingCommands.ADVANCE_DISC }, body)
    );
  }

  @Post('onboarding/confirm')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({ summary: 'Confirm and create topics from onboarding' })
  async confirmOnboarding(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Body() data: ConfirmOnboardingRequest
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadOnboardingCommands.CONFIRM }, {
        ...data,
        context: this.getContext(user, appScope),
      })
    );
  }

  @Post('analysis/run')
  @RequirePermissions('lead.read')
  @ApiOperation({ summary: 'Run lead analysis for a lead and topic' })
  async runLeadAnalysis(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Body() data: { leadId: string; topicId: string }
  ) {
    return firstValueFrom(
      this.leadClient.send({ cmd: LeadAnalysisCommands.RUN }, {
        ...data,
        ...this.getContext(user, appScope),
      })
    );
  }
}
