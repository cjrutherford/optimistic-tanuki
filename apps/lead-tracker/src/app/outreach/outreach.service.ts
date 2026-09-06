import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Lead,
  LeadOnboardingProfileRecord,
  LeadOutreachDraftRecord,
} from '@optimistic-tanuki/models/leads-entities';
import {
  GeneratedOutreachDraft,
  LeadAuthContext,
} from '@optimistic-tanuki/models/leads-contracts';
import { OutreachDraftService } from './outreach-draft.service';

/**
 * Owns the lifecycle of generated first-contact messages.
 *
 * Regeneration always inserts a new version rather than overwriting, so a draft
 * the user preferred is never lost to a click.
 */
@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);

  constructor(
    @InjectRepository(LeadOutreachDraftRecord)
    private readonly draftRepository: Repository<LeadOutreachDraftRecord>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadOnboardingProfileRecord)
    private readonly onboardingRepository: Repository<LeadOnboardingProfileRecord>,
    private readonly draftService: OutreachDraftService
  ) {}

  async generate(
    leadId: string,
    context: LeadAuthContext
  ): Promise<GeneratedOutreachDraft> {
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
      // With no profile there is nothing the user can truthfully claim, and
      // inventing something to say is exactly what must not happen.
      throw new NotFoundException(
        'Finish onboarding before drafting a message, so the draft has facts to draw on.'
      );
    }

    const nextVersion =
      (await this.latestVersion(leadId, context.profileId)) + 1;
    const generated = await this.draftService.generate(
      onboarding.profile,
      lead,
      nextVersion
    );

    const stored = await this.saveWithNextFreeVersion(
      leadId,
      context,
      generated,
      nextVersion
    );

    if (!generated.evidence.clean) {
      this.logger.warn(
        `Outreach draft for lead ${leadId} had ${generated.evidence.removedClaims.length} unsupported claim(s) removed`
      );
    }

    return { ...generated, version: stored };
  }

  /** Postgres unique-violation. */
  private static readonly UNIQUE_VIOLATION = '23505';

  /**
   * Stores the draft, stepping to the next free version if a concurrent
   * request has taken the intended one. Retrying keeps the work already done
   * rather than paying for the generation twice.
   */
  private async saveWithNextFreeVersion(
    leadId: string,
    context: LeadAuthContext,
    generated: GeneratedOutreachDraft,
    intendedVersion: number
  ): Promise<number> {
    let version = intendedVersion;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await this.draftRepository.insert(
          this.draftRepository.create({
            leadId,
            profileId: context.profileId,
            userId: context.userId || null,
            version,
            draft: generated.draft,
            evidence: generated.evidence,
            modelGenerated: generated.modelGenerated,
          })
        );
        return version;
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== OutreachService.UNIQUE_VIOLATION) {
          throw error;
        }
        version = (await this.latestVersion(leadId, context.profileId)) + 1;
        this.logger.warn(
          `Version collision storing outreach draft for lead ${leadId}; retrying as version ${version}`
        );
      }
    }

    // Five straight collisions is not contention, it is something wrong.
    throw new ConflictException(
      'Could not store the drafted message; too many concurrent drafts for this lead.'
    );
  }

  /** The most recent draft, or null when none has been generated yet. */
  async findLatest(
    leadId: string,
    profileId: string
  ): Promise<GeneratedOutreachDraft | null> {
    const [record] = await this.draftRepository.find({
      where: { leadId, profileId },
      order: { version: 'DESC' },
      take: 1,
    });

    return record ? this.toDto(record) : null;
  }

  private async latestVersion(
    leadId: string,
    profileId: string
  ): Promise<number> {
    const [record] = await this.draftRepository.find({
      where: { leadId, profileId },
      order: { version: 'DESC' },
      take: 1,
    });
    return record?.version || 0;
  }

  private toDto(record: LeadOutreachDraftRecord): GeneratedOutreachDraft {
    return {
      leadId: record.leadId,
      draft: record.draft,
      evidence: record.evidence,
      version: record.version,
      modelGenerated: record.modelGenerated,
      generatedAt: record.createdAt.toISOString(),
    };
  }
}
