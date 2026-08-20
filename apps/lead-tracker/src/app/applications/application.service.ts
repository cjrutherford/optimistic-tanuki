import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Lead,
  LeadApplicationRecord,
  LeadOnboardingProfileRecord,
} from '@optimistic-tanuki/models/leads-entities';
import {
  GeneratedApplication,
  LeadAuthContext,
} from '@optimistic-tanuki/models/leads-contracts';
import { ApplicationGenerationService } from './application-generation.service';

/**
 * Owns the lifecycle of generated application documents.
 *
 * Regeneration always inserts a new version rather than overwriting, so a draft
 * the user preferred is never lost to a click.
 */
@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    @InjectRepository(LeadApplicationRecord)
    private readonly applicationRepository: Repository<LeadApplicationRecord>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadOnboardingProfileRecord)
    private readonly onboardingRepository: Repository<LeadOnboardingProfileRecord>,
    private readonly generationService: ApplicationGenerationService
  ) {}

  async generate(
    leadId: string,
    context: LeadAuthContext
  ): Promise<GeneratedApplication> {
    const lead = await this.leadRepository.findOneBy({
      id: leadId,
      profileId: context.profileId,
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    const [onboarding] = await this.onboardingRepository.find({
      where: { profileId: context.profileId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    if (!onboarding?.profile) {
      // Without a parsed resume there are no facts to draw on, and inventing
      // them is precisely what must not happen.
      throw new NotFoundException(
        'Complete onboarding with a resume before generating application documents.'
      );
    }

    const nextVersion =
      (await this.latestVersion(leadId, context.profileId)) + 1;
    const generated = await this.generationService.generate(
      onboarding.profile,
      lead,
      nextVersion
    );

    await this.applicationRepository.save(
      this.applicationRepository.create({
        leadId,
        profileId: context.profileId,
        userId: context.userId || null,
        version: nextVersion,
        resume: generated.resume,
        coverLetter: generated.coverLetter,
        evidence: generated.evidence,
        modelGenerated: generated.modelGenerated,
      })
    );

    if (!generated.evidence.clean) {
      this.logger.warn(
        `Application for lead ${leadId} had ${generated.evidence.removedClaims.length} unsupported claim(s) removed`
      );
    }

    return generated;
  }

  /** The most recent version, or null when nothing has been generated yet. */
  async findLatest(
    leadId: string,
    profileId: string
  ): Promise<GeneratedApplication | null> {
    const [record] = await this.applicationRepository.find({
      where: { leadId, profileId },
      order: { version: 'DESC' },
      take: 1,
    });

    return record ? this.toDto(record) : null;
  }

  /** Every version, newest first, so an earlier draft can be recovered. */
  async findHistory(
    leadId: string,
    profileId: string
  ): Promise<GeneratedApplication[]> {
    const records = await this.applicationRepository.find({
      where: { leadId, profileId },
      order: { version: 'DESC' },
    });

    return records.map((record) => this.toDto(record));
  }

  private async latestVersion(
    leadId: string,
    profileId: string
  ): Promise<number> {
    const [record] = await this.applicationRepository.find({
      where: { leadId, profileId },
      order: { version: 'DESC' },
      take: 1,
    });
    return record?.version || 0;
  }

  private toDto(record: LeadApplicationRecord): GeneratedApplication {
    return {
      leadId: record.leadId,
      resume: record.resume,
      coverLetter: record.coverLetter,
      evidence: record.evidence,
      version: record.version,
      modelGenerated: record.modelGenerated,
      generatedAt: record.createdAt.toISOString(),
    };
  }
}
