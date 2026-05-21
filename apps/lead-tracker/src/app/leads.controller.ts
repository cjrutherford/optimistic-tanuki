import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  DiscInterviewRequest,
  LeadAuthContext,
  MadLibAnalysisResult,
  ResumeParseRequest,
  CreateLeadDto,
  CreateLeadFlagDto,
  CreateLeadTopicDto,
  LeadAnalysisDto,
  LeadDiscoverySource,
  LocationAutocompleteSuggestion,
  LeadTopicDiscoveryResultDto,
  RunLeadTopicDiscoveryDto,
  UpdateLeadDto,
  UpdateLeadTopicDto,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';
import { DiscoveryService } from './discovery.service';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadsService } from './leads.service';
import { GoogleMapsLocationAutocompleteService } from './google-maps-location-autocomplete.service';
import { OnboardingAnalysisService } from './onboarding-analysis.service';
import {
  LeadAnalysisCommands,
  LeadCommands,
  LeadFlagCommands,
  LeadOnboardingCommands,
  LeadTopicCommands,
} from '@optimistic-tanuki/constants';

@Controller()
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly discoveryService: DiscoveryService,
    private readonly googleMapsLocationAutocompleteService: GoogleMapsLocationAutocompleteService,
    private readonly onboardingAnalysisService: OnboardingAnalysisService,
    private readonly leadQualificationService: LeadQualificationService
  ) {}

  @MessagePattern({ cmd: LeadCommands.FIND_ALL })
  async findAll(
    @Payload() filters?: { status?: string; source?: string; profileId: string }
  ) {
    return this.leadsService.findAll(filters);
  }

  @MessagePattern({ cmd: LeadCommands.FIND_ONE })
  async findOne(@Payload() data: { id: string; profileId: string }) {
    return this.leadsService.findOne(data.id, data.profileId);
  }

  @MessagePattern({ cmd: LeadCommands.CREATE })
  async create(
    @Payload() data: { dto: CreateLeadDto; context: LeadAuthContext }
  ) {
    return this.leadsService.create(data.dto, data.context);
  }

  @MessagePattern({ cmd: LeadCommands.UPDATE })
  async update(
    @Payload()
    data: { id: string; dto: UpdateLeadDto; profileId: string }
  ) {
    return this.leadsService.update(data.id, data.dto, data.profileId);
  }

  @MessagePattern({ cmd: LeadCommands.DELETE })
  async delete(@Payload() data: { id: string; profileId: string }) {
    return this.leadsService.delete(data.id, data.profileId);
  }

  @MessagePattern({ cmd: LeadCommands.GET_STATS })
  async getStats(@Payload() data: { profileId: string }) {
    return this.leadsService.getStats(data.profileId);
  }

  @MessagePattern({ cmd: LeadTopicCommands.FIND_ALL })
  async findAllTopics(@Payload() data: { profileId: string }) {
    return this.leadsService.findAllTopics(data.profileId);
  }

  @MessagePattern({ cmd: LeadTopicCommands.CREATE })
  async createTopic(
    @Payload() data: { dto: CreateLeadTopicDto; context: LeadAuthContext }
  ) {
    const topic = await this.leadsService.createTopic(data.dto, data.context);
    if (!topic.enabled) {
      return topic;
    }

    await this.discoveryService.request(topic.id, data.context.profileId);
    return this.leadsService.findTopicById(topic.id, data.context.profileId);
  }

  @MessagePattern({ cmd: LeadTopicCommands.UPDATE })
  async updateTopic(
    @Payload()
    data: { id: string; dto: UpdateLeadTopicDto; profileId: string }
  ) {
    const existing = await this.leadsService.findTopicById(
      data.id,
      data.profileId
    );
    const topic = await this.leadsService.updateTopic(
      data.id,
      data.dto,
      data.profileId
    );

    if (topic && this.shouldRunDiscovery(existing, topic, data.dto)) {
      await this.discoveryService.request(topic.id, data.profileId);
      return this.leadsService.findTopicById(topic.id, data.profileId);
    }

    return topic;
  }

  @MessagePattern({ cmd: LeadTopicCommands.DELETE })
  async deleteTopic(@Payload() data: { id: string; profileId: string }) {
    return this.leadsService.deleteTopic(data.id, data.profileId);
  }

  @MessagePattern({ cmd: LeadTopicCommands.RUN_DISCOVERY })
  async runTopicDiscovery(
    @Payload() data: RunLeadTopicDiscoveryDto
      & { profileId: string }
  ): Promise<LeadTopicDiscoveryResultDto | null> {
    return this.discoveryService.request(data.topicId, data.profileId);
  }

  @MessagePattern({ cmd: LeadTopicCommands.GET_DISCOVERY_STATUS })
  async getTopicDiscoveryStatus(
    @Payload() data: RunLeadTopicDiscoveryDto
      & { profileId: string }
  ): Promise<LeadTopicDiscoveryResultDto | null> {
    return this.discoveryService.getStatus(data.topicId, data.profileId);
  }

  @MessagePattern({ cmd: LeadFlagCommands.FIND_BY_LEAD })
  async findFlagsByLead(@Payload() data: { leadId: string; profileId: string }) {
    return this.leadsService.findFlagsByLead(data.leadId, data.profileId);
  }

  @MessagePattern({ cmd: LeadFlagCommands.CREATE })
  async createFlag(
    @Payload() data: { leadId: string; dto: CreateLeadFlagDto; context: LeadAuthContext }
  ) {
    return this.leadsService.createFlag(data.leadId, data.dto, data.context);
  }

  @MessagePattern({ cmd: LeadOnboardingCommands.ANALYZE })
  async analyzeOnboarding(@Payload() profile: UserOnboardingProfile) {
    const topics = await this.onboardingAnalysisService.analyzeProfile(profile);
    return { topics };
  }

  @MessagePattern({ cmd: LeadOnboardingCommands.ANALYZE_MAD_LIB })
  async analyzeMadLib(
    @Payload() data: { text: string }
  ): Promise<MadLibAnalysisResult> {
    return this.onboardingAnalysisService.analyzeMadLib(data.text);
  }

  @MessagePattern({ cmd: LeadOnboardingCommands.PARSE_RESUME })
  async parseResume(@Payload() data: ResumeParseRequest) {
    return this.onboardingAnalysisService.parseResume(data);
  }

  @MessagePattern({ cmd: LeadOnboardingCommands.AUTOCOMPLETE_LOCATIONS })
  async autocompleteLocations(
    @Payload() data: { query?: string }
  ): Promise<LocationAutocompleteSuggestion[]> {
    return this.googleMapsLocationAutocompleteService.searchCities(
      data.query || ''
    );
  }

  @MessagePattern({ cmd: LeadOnboardingCommands.ADVANCE_DISC })
  async advanceDiscInterview(@Payload() data: DiscInterviewRequest) {
    return this.onboardingAnalysisService.advanceDiscInterview(data);
  }

  @MessagePattern({ cmd: LeadOnboardingCommands.CONFIRM })
  async confirmOnboarding(
    @Payload()
    data: {
      profile?: UserOnboardingProfile;
      topics: CreateLeadTopicDto[];
      context: LeadAuthContext;
    }
  ) {
    const createdTopics = [];
    if (data.profile) {
      await this.leadsService.saveOnboardingProfile(data.profile, data.context);
    }
    for (const topicDto of data.topics) {
      const topic = await this.leadsService.createTopic(topicDto, data.context);
      if (topic.enabled) {
        await this.discoveryService.request(topic.id, data.context.profileId);
      }
      createdTopics.push(topic);
    }
    if (data.profile) {
      await this.leadQualificationService.requalifyAllLeads(
        data.context.profileId
      );
    }
    return { topics: createdTopics };
  }

  @MessagePattern({ cmd: LeadAnalysisCommands.RUN })
  async analyzeLead(
    @Payload() data: { leadId: string; topicId: string; profileId: string }
  ) {
    const lead = await this.leadsService.findOne(data.leadId, data.profileId);
    const topic = await this.leadsService.findTopicById(
      data.topicId,
      data['profileId']
    );
    if (!lead || !topic) {
      return null;
    }
    return this.leadQualificationService.analyzeAndSave(lead, topic);
  }

  private shouldRunDiscovery(
    existing: {
      enabled: boolean;
      name: string;
      description: string;
      keywords: string[];
      excludedTerms?: string[];
      discoveryIntent?: string;
      sources: string[];
      googleMapsCities?: string[] | null;
      googleMapsTypes?: string[] | null;
      googleMapsLocation?: string | null;
      googleMapsRadiusMiles?: number | null;
    } | null,
    updated: {
      enabled: boolean;
      name: string;
      description: string;
      keywords: string[];
      excludedTerms?: string[];
      discoveryIntent?: string;
      sources: string[];
      googleMapsCities?: string[] | null;
      googleMapsTypes?: string[] | null;
      googleMapsLocation?: string | null;
      googleMapsRadiusMiles?: number | null;
    },
    dto: UpdateLeadTopicDto
  ): boolean {
    if (!updated.enabled) {
      return false;
    }

    if (!existing) {
      return true;
    }

    if (!existing.enabled && updated.enabled) {
      return true;
    }

    if (dto.name !== undefined && existing.name !== updated.name) {
      return true;
    }

    if (
      dto.description !== undefined &&
      (existing.description || '') !== (updated.description || '')
    ) {
      return true;
    }

    if (dto.keywords !== undefined) {
      return !this.areKeywordSetsEqual(existing.keywords, updated.keywords);
    }

    if (dto.excludedTerms !== undefined) {
      return !this.areKeywordSetsEqual(
        existing.excludedTerms || [],
        updated.excludedTerms || []
      );
    }

    if (
      dto.discoveryIntent !== undefined &&
      (existing.discoveryIntent || '') !== (updated.discoveryIntent || '')
    ) {
      return true;
    }

    if (dto.sources !== undefined) {
      return !this.areKeywordSetsEqual(existing.sources, updated.sources);
    }

    if (
      updated.sources.includes(LeadDiscoverySource.GOOGLE_MAPS) &&
      dto.googleMapsCities !== undefined
    ) {
      return !this.areKeywordSetsEqual(
        existing.googleMapsCities || [],
        updated.googleMapsCities || []
      );
    }

    if (
      updated.sources.includes(LeadDiscoverySource.GOOGLE_MAPS) &&
      dto.googleMapsTypes !== undefined
    ) {
      return !this.areKeywordSetsEqual(
        existing.googleMapsTypes || [],
        updated.googleMapsTypes || []
      );
    }

    if (
      updated.sources.includes(LeadDiscoverySource.GOOGLE_MAPS) &&
      dto.googleMapsLocation !== undefined &&
      (existing.googleMapsLocation || '') !== (updated.googleMapsLocation || '')
    ) {
      return true;
    }

    if (
      updated.sources.includes(LeadDiscoverySource.GOOGLE_MAPS) &&
      dto.googleMapsRadiusMiles !== undefined &&
      (existing.googleMapsRadiusMiles || null) !==
        (updated.googleMapsRadiusMiles || null)
    ) {
      return true;
    }

    return false;
  }

  private areKeywordSetsEqual(previous: string[], next: string[]): boolean {
    const previousNormalized = [...(previous || [])]
      .map((keyword) => keyword.trim().toLowerCase())
      .sort();
    const nextNormalized = [...(next || [])]
      .map((keyword) => keyword.trim().toLowerCase())
      .sort();

    if (previousNormalized.length !== nextNormalized.length) {
      return false;
    }

    return previousNormalized.every(
      (keyword, index) => keyword === nextNormalized[index]
    );
  }
}
