import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Lead,
  LeadFlag,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import { Repository } from 'typeorm';
import {
  LeadQualificationSummary,
  LeadAuthContext,
  CreateLeadDto,
  CreateLeadFlagDto,
  CreateLeadTopicDto,
  DEFAULT_LEAD_DISCOVERY_SOURCES,
  LeadDiscoverySource,
  LeadTopicDiscoveryIntent,
  UpdateLeadDto,
  UpdateLeadTopicDto,
  LeadStats,
  LeadStatus,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models/leads-contracts';
import { LeadQualificationService } from './lead-qualification.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadFlag)
    private readonly leadFlagRepository: Repository<LeadFlag>,
    @InjectRepository(LeadTopic)
    private readonly leadTopicRepository: Repository<LeadTopic>,
    @InjectRepository(LeadTopicLink)
    private readonly leadTopicLinkRepository: Repository<LeadTopicLink>,
    @InjectRepository(LeadQualification)
    private readonly qualificationRepository: Repository<LeadQualification>,
    private readonly leadQualificationService: LeadQualificationService
  ) {}

  async findAll(filters?: {
    status?: string;
    source?: string;
    profileId: string;
  }): Promise<Array<Lead & { isFlagged: boolean }>> {
    const query = this.leadRepository.createQueryBuilder('lead');
    query.leftJoinAndSelect('lead.flags', 'flag');
    query.andWhere('lead.profileId = :profileId', {
      profileId: filters?.profileId,
    });

    if (filters?.status) {
      query.andWhere('lead.status = :status', { status: filters.status });
    }
    if (filters?.source) {
      query.andWhere('lead.source = :source', { source: filters.source });
    }

    const leads = await query
      .orderBy('lead.nextFollowUp', 'ASC')
      .addOrderBy('lead.createdAt', 'DESC')
      .getMany();

    return leads.map((lead) => ({
      ...lead,
      isFlagged: (lead.flags?.length || 0) > 0,
    }));
  }

  async findOne(
    id: string,
    profileId: string
  ): Promise<(Lead & { isFlagged: boolean }) | null> {
    const lead = await this.leadRepository.findOne({
      where: { id, profileId },
      relations: { flags: true },
    });

    if (!lead) {
      return null;
    }

    return {
      ...lead,
      isFlagged: (lead.flags?.length || 0) > 0,
    };
  }

  async create(dto: CreateLeadDto, context: LeadAuthContext): Promise<Lead> {
    const lead = this.leadRepository.create({
      ...dto,
      appScope: context.appScope,
      profileId: context.profileId,
      userId: context.userId,
    });
    const savedLead = await this.leadRepository.save(lead);
    await this.leadQualificationService
      .analyzeAndSave(savedLead, null)
      .catch((error) =>
        this.leadQualificationService.logFailure(savedLead.id, error)
      );
    return {
      ...savedLead,
      flags: [],
    };
  }

  async update(
    id: string,
    dto: UpdateLeadDto,
    profileId: string
  ): Promise<(Lead & { isFlagged: boolean }) | null> {
    await this.leadRepository.update({ id, profileId }, dto);
    return this.findOne(id, profileId);
  }

  async delete(id: string, profileId: string): Promise<void> {
    await this.leadRepository.delete({ id, profileId });
  }

  async findAllTopics(profileId: string): Promise<LeadTopic[]> {
    const topics = await this.leadTopicRepository.find({
      where: { profileId },
      order: { enabled: 'DESC', updatedAt: 'DESC', name: 'ASC' },
    });

    if (!topics.length) {
      return topics;
    }

    const links = await this.leadTopicLinkRepository.find({
      where: topics.map((topic) => ({ topicId: topic.id })),
    });
    const leadIds = Array.from(new Set(links.map((link) => link.leadId)));
    const qualifications = leadIds.length
      ? await this.qualificationRepository.find({
          where: leadIds.map((leadId) => ({ leadId })),
        })
      : [];
    const qualificationByLeadId = new Map(
      qualifications.map((qualification) => [qualification.leadId, qualification])
    );

    return topics.map((topic) => {
      const topicQualifications = links
        .filter((link) => link.topicId === topic.id)
        .map((link) => qualificationByLeadId.get(link.leadId))
        .filter(
          (qualification): qualification is LeadQualification =>
            Boolean(qualification)
        );

      return {
        ...topic,
        qualificationSummary: this.buildQualificationSummary(topicQualifications),
      };
    });
  }

  async findTopicById(id: string, profileId: string): Promise<LeadTopic | null> {
    return this.leadTopicRepository.findOneBy({ id, profileId });
  }

  async createTopic(
    dto: CreateLeadTopicDto,
    context: LeadAuthContext
  ): Promise<LeadTopic> {
    const sources = this.normalizeTopicSources(dto.sources);
    const topic = this.leadTopicRepository.create({
      ...dto,
      appScope: context.appScope,
      profileId: context.profileId,
      userId: context.userId,
      description: dto.description || '',
      excludedTerms: this.normalizeTopicTerms(dto.excludedTerms),
      discoveryIntent: dto.discoveryIntent || LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources,
      googleMapsCities: this.normalizeTopicGoogleMapsList(dto.googleMapsCities, sources),
      googleMapsTypes: this.normalizeTopicGoogleMapsList(dto.googleMapsTypes, sources),
      googleMapsLocation: this.normalizeTopicGoogleMapsLocation(dto.googleMapsLocation, sources),
      googleMapsRadiusMiles: this.normalizeTopicGoogleMapsRadiusMiles(
        dto.googleMapsRadiusMiles,
        sources
      ),
      leadCount: dto.leadCount || 0,
      lastRun: dto.lastRun ? new Date(dto.lastRun) : null,
    });

    return this.leadTopicRepository.save(topic);
  }

  async updateTopic(
    id: string,
    dto: UpdateLeadTopicDto,
    profileId: string
  ): Promise<LeadTopic | null> {
    const existing = await this.leadTopicRepository.findOneBy({ id, profileId });
    if (!existing) {
      return null;
    }
    const nextSources = dto.sources !== undefined
      ? this.normalizeTopicSources(dto.sources)
      : undefined;

    await this.leadTopicRepository.update({ id, profileId }, {
      ...dto,
      excludedTerms: this.normalizeTopicTerms(dto.excludedTerms),
      discoveryIntent: dto.discoveryIntent,
      sources: nextSources,
      googleMapsCities: this.normalizeTopicGoogleMapsList(dto.googleMapsCities, nextSources),
      googleMapsTypes: this.normalizeTopicGoogleMapsList(dto.googleMapsTypes, nextSources),
      googleMapsLocation: this.normalizeTopicGoogleMapsLocation(
        dto.googleMapsLocation,
        nextSources
      ),
      googleMapsRadiusMiles: this.normalizeTopicGoogleMapsRadiusMiles(
        dto.googleMapsRadiusMiles,
        nextSources
      ),
      lastRun: dto.lastRun ? new Date(dto.lastRun) : dto.lastRun,
    });
    return this.leadTopicRepository.findOneBy({ id, profileId });
  }

  async deleteTopic(id: string, profileId: string): Promise<void> {
    await this.leadTopicRepository.delete({ id, profileId });
  }

  private normalizeTopicSources(sources?: LeadDiscoverySource[]): LeadDiscoverySource[] {
    const normalized = Array.from(new Set((sources || []).filter(Boolean)));
    return normalized.length ? normalized : [...DEFAULT_LEAD_DISCOVERY_SOURCES];
  }

  private normalizeTopicTerms(values?: string[]): string[] | undefined {
    if (!values) {
      return undefined;
    }

    return Array.from(
      new Set(
        values
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0)
      )
    );
  }

  private normalizeTopicGoogleMapsList(
    values: string[] | undefined,
    sources?: LeadDiscoverySource[]
  ): string[] | null {
    if (sources && !sources.includes(LeadDiscoverySource.GOOGLE_MAPS)) {
      return null;
    }

    if (!values?.length) {
      return null;
    }

    const normalized = Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      )
    );

    return normalized.length ? normalized : null;
  }

  private normalizeTopicGoogleMapsLocation(
    value: string | undefined,
    sources?: LeadDiscoverySource[]
  ): string | null {
    if (sources && !sources.includes(LeadDiscoverySource.GOOGLE_MAPS)) {
      return null;
    }

    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeTopicGoogleMapsRadiusMiles(
    value: number | undefined,
    sources?: LeadDiscoverySource[]
  ): number | null {
    if (sources && !sources.includes(LeadDiscoverySource.GOOGLE_MAPS)) {
      return null;
    }

    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }

    return Math.round(value);
  }

  async findFlagsByLead(leadId: string, profileId: string): Promise<LeadFlag[]> {
    return this.leadFlagRepository.find({
      where: { leadId, profileId },
      order: { createdAt: 'DESC' },
    });
  }

  async createFlag(
    leadId: string,
    dto: CreateLeadFlagDto,
    context: LeadAuthContext
  ): Promise<LeadFlag> {
    const flag = this.leadFlagRepository.create({
      leadId,
      reasons: dto.reasons,
      notes: dto.notes,
      profileId: context.profileId,
      userId: context.userId,
    });

    return this.leadFlagRepository.save(flag);
  }

  async getStats(profileId: string): Promise<LeadStats> {
    const leads = await this.leadRepository.findBy({ profileId });
    const leadIds = leads.map((lead) => lead.id);
    const qualifications = await this.qualificationRepository.find();
    const scopedQualifications = qualifications.filter((qualification) =>
      leadIds.includes(qualification.leadId)
    );

    const byStatus = Object.values(LeadStatus).reduce<Record<string, number>>(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {}
    );

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    }

    return {
      total: leads.length,
      autoDiscovered: leads.filter((l) => l.isAutoDiscovered).length,
      manual: leads.filter((l) => !l.isAutoDiscovered).length,
      totalValue: leads.reduce((sum, l) => sum + (Number(l.value) || 0), 0),
      followUpsDue: leads.filter((l) => {
        if (!l.nextFollowUp) return false;
        if (l.status === LeadStatus.WON || l.status === LeadStatus.LOST)
          return false;
        return new Date(l.nextFollowUp) <= new Date();
      }).length,
      byStatus,
      qualification: this.buildQualificationSummary(scopedQualifications),
    };
  }

  async saveOnboardingProfile(
    profile: UserOnboardingProfile,
    context: LeadAuthContext
  ) {
    return this.leadQualificationService.saveOnboardingProfile(profile, context);
  }

  private buildQualificationSummary(
    qualifications: LeadQualification[]
  ): LeadQualificationSummary {
    const byClassification = {
      'strong-match': 0,
      review: 0,
      'weak-match': 0,
    } as Record<'strong-match' | 'review' | 'weak-match', number>;
    let relevanceTotal = 0;
    let relevanceCount = 0;
    let difficultyTotal = 0;
    let difficultyCount = 0;
    let userFitTotal = 0;
    let userFitCount = 0;
    let missingUserFitCount = 0;

    for (const qualification of qualifications) {
      byClassification[qualification.classification] =
        (byClassification[qualification.classification] || 0) + 1;

      if (typeof qualification.relevanceScore === 'number') {
        relevanceTotal += qualification.relevanceScore;
        relevanceCount++;
      }
      if (typeof qualification.difficultyScore === 'number') {
        difficultyTotal += qualification.difficultyScore;
        difficultyCount++;
      }
      if (typeof qualification.userFitScore === 'number') {
        userFitTotal += qualification.userFitScore;
        userFitCount++;
      } else if (qualification.userFitStatus === 'unavailable') {
        missingUserFitCount++;
      }
    }

    return {
      byClassification,
      averageRelevanceScore: relevanceCount
        ? Math.round(relevanceTotal / relevanceCount)
        : null,
      averageDifficultyScore: difficultyCount
        ? Math.round(difficultyTotal / difficultyCount)
        : null,
      averageUserFitScore: userFitCount
        ? Math.round(userFitTotal / userFitCount)
        : null,
      missingUserFitCount,
    };
  }
}
