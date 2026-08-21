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
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  LeadAnalysisCommands,
  LeadApplicationCommands,
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
  MadLibAnalysisRequest,
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
import { LongRunning } from '../../decorators/request-timeout.decorator';
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
      this.leadClient.send(
        { cmd: LeadCommands.FIND_ALL },
        {
          status,
          source,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadTopicCommands.CREATE },
        {
          dto,
          context: this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadTopicCommands.UPDATE },
        {
          id,
          dto,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadTopicCommands.DELETE },
        {
          id,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadTopicCommands.RUN_DISCOVERY },
        {
          topicId: id,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadTopicCommands.GET_DISCOVERY_STATUS },
        {
          topicId: id,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadCommands.FIND_ONE },
        {
          id,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadCommands.CREATE },
        {
          dto,
          context: this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadCommands.UPDATE },
        {
          id,
          dto,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadCommands.UPDATE },
        {
          id,
          dto,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadCommands.DELETE },
        {
          id,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadFlagCommands.FIND_BY_LEAD },
        {
          leadId: id,
          ...this.getContext(user, appScope),
        }
      )
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
      this.leadClient.send(
        { cmd: LeadFlagCommands.CREATE },
        {
          leadId: id,
          dto,
          context: this.getContext(user, appScope),
        }
      )
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
    @Body() body: MadLibAnalysisRequest
  ): Promise<MadLibAnalysisResult> {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadOnboardingCommands.ANALYZE_MAD_LIB },
        body
      )
    );
  }

  @Post('onboarding/resume/parse')
  @LongRunning()
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({ summary: 'Parse a resume upload for onboarding prefill' })
  async parseResume(
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
    }
  ): Promise<ResumeParseResult> {
    if (!file) {
      throw new BadRequestException('Resume file is required.');
    }

    try {
      return await firstValueFrom(
        this.leadClient.send(
          { cmd: LeadOnboardingCommands.PARSE_RESUME },
          {
            filename: file.originalname,
            mimeType: file.mimetype,
            contentBase64: file.buffer.toString('base64'),
          }
        )
      );
    } catch (error) {
      // A file we cannot read is the user's problem to fix, not a server
      // fault, and the reason is the whole value of the message: "this looks
      // like a scan" tells them what to do, a 500 does not.
      const refusal = error as { statusCode?: number; message?: string };
      if (refusal?.statusCode === 400) {
        throw new BadRequestException(
          refusal.message || 'That file could not be read.'
        );
      }
      throw error;
    }
  }

  @Get('locations/autocomplete')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({
    summary: 'Autocomplete city/location inputs for Maps searches',
  })
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

  @Post('ats/company/lookup')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({
    summary: 'Resolve a company name to a verified ATS board token',
  })
  async lookupAtsCompany(@Body() body: { companyName?: string }) {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadOnboardingCommands.LOOKUP_ATS_COMPANY },
        body
      )
    );
  }

  @Get('ats/company/suggestions')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({
    summary: 'Suggest dream companies from lead history and past employers',
  })
  async suggestAtsCompanies(
    @User() user: UserContext,
    @AppScope() appScope: string
  ) {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadOnboardingCommands.SUGGEST_ATS_COMPANIES },
        { context: this.getContext(user, appScope) }
      )
    );
  }

  @Post('onboarding/disc/advance')
  @RequirePermissions('lead.onboarding.update')
  @ApiOperation({ summary: 'Advance the onboarding DISC interview' })
  async advanceDiscInterview(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Body() body: DiscInterviewRequest
  ) {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadOnboardingCommands.ADVANCE_DISC },
        // Context lets the service look up what this profile was asked in a
        // previous onboarding run so the questions are not repeated.
        { ...body, context: this.getContext(user, appScope) }
      )
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
      this.leadClient.send(
        { cmd: LeadOnboardingCommands.CONFIRM },
        {
          ...data,
          context: this.getContext(user, appScope),
        }
      )
    );
  }

  @Post(':id/application/generate')
  @LongRunning()
  @RequirePermissions('lead.update')
  @ApiOperation({
    summary: 'Generate a tailored resume and cover letter for a lead',
  })
  async generateApplication(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ) {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadApplicationCommands.GENERATE },
        { leadId: id, context: this.getContext(user, appScope) }
      )
    );
  }

  @Get(':id/application')
  @RequirePermissions('lead.read')
  @ApiOperation({ summary: 'Get the latest generated application for a lead' })
  async findApplication(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ) {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadApplicationCommands.FIND_LATEST },
        { leadId: id, context: this.getContext(user, appScope) }
      )
    );
  }

  @Get(':id/application/history')
  @RequirePermissions('lead.read')
  @ApiOperation({ summary: 'Get every generated version for a lead' })
  async findApplicationHistory(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string
  ) {
    return firstValueFrom(
      this.leadClient.send(
        { cmd: LeadApplicationCommands.FIND_HISTORY },
        { leadId: id, context: this.getContext(user, appScope) }
      )
    );
  }

  @Get(':id/application/export')
  @RequirePermissions('lead.read')
  @ApiOperation({ summary: 'Download a generated document as .odt or .docx' })
  async exportApplication(
    @User() user: UserContext,
    @AppScope() appScope: string,
    @Param('id') id: string,
    @Query('kind') kind: 'resume' | 'cover-letter',
    @Query('format') format: 'odt' | 'docx',
    @Res() response: Response
  ) {
    const exported = await firstValueFrom(
      this.leadClient.send(
        { cmd: LeadApplicationCommands.EXPORT },
        {
          leadId: id,
          kind: kind || 'resume',
          format: format || 'docx',
          candidateName: user?.userId || 'application',
          context: this.getContext(user, appScope),
        }
      )
    );

    if (!exported) {
      throw new NotFoundException(
        `No generated application exists for lead ${id}`
      );
    }

    // Streamed as a real download so the browser saves a usable file rather
    // than rendering base64 in a tab.
    response.setHeader('Content-Type', exported.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.filename}"`
    );
    response.send(Buffer.from(exported.contentBase64, 'base64'));
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
      this.leadClient.send(
        { cmd: LeadAnalysisCommands.RUN },
        {
          ...data,
          ...this.getContext(user, appScope),
        }
      )
    );
  }
}
