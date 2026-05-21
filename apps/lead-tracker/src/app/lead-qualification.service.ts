import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Lead,
  LeadOnboardingProfileRecord,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import {
  LeadAuthContext,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models/leads-contracts';
import { In, Repository } from 'typeorm';
import { DiscoveryPipelineService } from './discovery/pipeline.service';

@Injectable()
export class LeadQualificationService {
  private readonly logger = new Logger(LeadQualificationService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadTopic)
    private readonly topicRepository: Repository<LeadTopic>,
    @InjectRepository(LeadTopicLink)
    private readonly topicLinkRepository: Repository<LeadTopicLink>,
    @InjectRepository(LeadQualification)
    private readonly qualificationRepository: Repository<LeadQualification>,
    @InjectRepository(LeadOnboardingProfileRecord)
    private readonly onboardingProfileRepository: Repository<LeadOnboardingProfileRecord>,
    private readonly pipelineService: DiscoveryPipelineService
  ) {}

  async saveOnboardingProfile(
    profile: UserOnboardingProfile,
    context: LeadAuthContext
  ): Promise<LeadOnboardingProfileRecord> {
    const record = this.onboardingProfileRepository.create({
      userId: context.userId || profile.userId || null,
      profileId: context.profileId,
      appScope: context.appScope,
      profile: {
        ...profile,
        userId: context.userId,
      },
      currentStep: profile.currentStep || 0,
      completedAt: profile.completedAt ? new Date(profile.completedAt) : new Date(),
    });

    return this.onboardingProfileRepository.save(record);
  }

  async getLatestOnboardingProfile(
    profileId: string
  ): Promise<UserOnboardingProfile | null> {
    const [record] = await this.onboardingProfileRepository.find({
      where: { profileId },
      order: {
        completedAt: 'DESC',
        updatedAt: 'DESC',
      },
      take: 1,
    });

    return record?.profile || null;
  }

  async analyzeAndSave(
    lead: Lead,
    topic: LeadTopic | null
  ): Promise<LeadQualification> {
    const onboardingProfile = await this.getLatestOnboardingProfile(
      lead.profileId
    );
    const analysis = await this.pipelineService.analyzeLead(
      lead,
      topic,
      onboardingProfile
    );
    const existing = await this.qualificationRepository.findOneBy({
      leadId: lead.id,
    });

    const record = this.qualificationRepository.create({
      ...(existing || {}),
      leadId: lead.id,
      topicId: topic?.id || null,
      relevanceScore: analysis.relevance.score,
      relevanceStatus: analysis.relevance.status,
      relevanceReasons: analysis.relevance.reasons,
      difficultyScore: analysis.difficulty.score,
      difficultyStatus: analysis.difficulty.status,
      difficultyReasons: analysis.difficulty.reasons,
      userFitScore: analysis.userFit.score,
      userFitStatus: analysis.userFit.status,
      userFitReasons: analysis.userFit.reasons,
      finalScore: analysis.finalScore,
      classification: analysis.classification,
      pipelineVersion: analysis.pipelineVersion,
      analyzedAt: analysis.analyzedAt,
    });

    return this.qualificationRepository.save(record);
  }

  async requalifyTopicLeads(topicId: string): Promise<void> {
    const topic = await this.topicRepository.findOneBy({ id: topicId });
    if (!topic) {
      return;
    }

    const links = await this.topicLinkRepository.find({
      where: { topicId },
    });
    if (!links.length) {
      return;
    }

    const leads = await this.leadRepository.findBy({
      id: In(links.map((link) => link.leadId)),
    });

    for (const lead of leads) {
      await this.analyzeAndSave(lead, topic);
    }
  }

  async requalifyAllLeads(profileId: string): Promise<void> {
    const leads = await this.leadRepository.findBy({ profileId });
    if (!leads.length) {
      return;
    }

    const links = await this.topicLinkRepository.find({
      where: {
        leadId: In(leads.map((lead) => lead.id)),
      },
    });
    const topicIds = Array.from(
      new Set(links.map((link) => link.topicId).filter(Boolean))
    );
    const topics = topicIds.length
      ? await this.topicRepository.findBy({ id: In(topicIds) })
      : [];
    const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
    const primaryTopicByLeadId = new Map<string, LeadTopic>();

    for (const link of links) {
      if (!primaryTopicByLeadId.has(link.leadId)) {
        const topic = topicsById.get(link.topicId);
        if (topic) {
          primaryTopicByLeadId.set(link.leadId, topic);
        }
      }
    }

    for (const lead of leads) {
      await this.analyzeAndSave(lead, primaryTopicByLeadId.get(lead.id) || null);
    }
  }

  async findByLeadId(leadId: string): Promise<LeadQualification | null> {
    return this.qualificationRepository.findOneBy({ leadId });
  }

  async findAll(): Promise<LeadQualification[]> {
    return this.qualificationRepository.find();
  }

  logFailure(leadId: string, error: unknown) {
    this.logger.error(
      `Lead qualification failed for lead ${leadId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
