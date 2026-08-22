import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Lead,
  LeadFlag,
  LeadOnboardingProfileRecord,
} from '@optimistic-tanuki/models/leads-entities';
import { LeadStatus } from '@optimistic-tanuki/models/leads-contracts';
import {
  AtsCompanyLookupService,
  AtsCompanyMatch,
} from './ats-company-lookup.service';

/** Why a company is being suggested, so the user can judge it. */
export type AtsSuggestionSignal =
  /** They actively pursued a lead at this company. */
  | 'pursued-lead'
  /** A lead from this company exists and was never flagged. */
  | 'seen-lead'
  /** They have worked here before, per their resume. */
  | 'past-employer';

export type AtsCompanySuggestion = AtsCompanyMatch & {
  signal: AtsSuggestionSignal;
  reason: string;
  /** Higher means a stronger behavioural signal. */
  weight: number;
};

const SIGNAL_WEIGHT: Record<AtsSuggestionSignal, number> = {
  'pursued-lead': 100,
  'past-employer': 60,
  'seen-lead': 30,
};

/**
 * Suggests dream companies to watch, inferred from what the user has actually
 * done rather than from what they said they want.
 *
 * Stated preferences are already captured by the onboarding answers. The more
 * useful signal is behavioural: which companies they bothered to contact, which
 * they flagged as junk, and where they have worked before. Those reveal a
 * preference the interview does not ask about directly.
 *
 * Every suggestion is verified against the live ATS API before it is offered —
 * an unverified name would become a board token that 404s on every run.
 */
@Injectable()
export class AtsCompanySuggestionService {
  private readonly logger = new Logger(AtsCompanySuggestionService.name);

  /** Statuses that mean the user did something deliberate with the lead. */
  private readonly pursuedStatuses = [
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFIED,
    LeadStatus.PROPOSAL,
    LeadStatus.NEGOTIATION,
    LeadStatus.WON,
  ];

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadFlag)
    private readonly leadFlagRepository: Repository<LeadFlag>,
    @InjectRepository(LeadOnboardingProfileRecord)
    private readonly onboardingRepository: Repository<LeadOnboardingProfileRecord>,
    private readonly lookupService: AtsCompanyLookupService
  ) {}

  async suggest(profileId: string, limit = 6): Promise<AtsCompanySuggestion[]> {
    if (!profileId) {
      return [];
    }

    const candidates = await this.gatherCandidates(profileId);
    if (!candidates.size) {
      return [];
    }

    // Verify in parallel; only companies with a real board survive.
    const verified = await Promise.all(
      Array.from(candidates.entries())
        .sort((a, b) => b[1].weight - a[1].weight)
        // Each candidate costs several HTTP requests, so cap the fan-out.
        .slice(0, limit * 3)
        .map(async ([label, meta]) => {
          const matches = await this.lookupService.lookup(label);
          const best = matches[0];
          return best
            ? {
                ...best,
                signal: meta.signal,
                reason: meta.reason,
                weight: meta.weight,
              }
            : null;
        })
    );

    return verified
      .filter((entry): entry is AtsCompanySuggestion => entry !== null)
      .sort((a, b) => b.weight - a.weight || b.openingCount - a.openingCount)
      .slice(0, limit);
  }

  private async gatherCandidates(
    profileId: string
  ): Promise<
    Map<string, { signal: AtsSuggestionSignal; reason: string; weight: number }>
  > {
    const candidates = new Map<
      string,
      { signal: AtsSuggestionSignal; reason: string; weight: number }
    >();

    const add = (
      company: string | null | undefined,
      signal: AtsSuggestionSignal,
      reason: string
    ) => {
      const label = (company || '').trim();
      if (!label || label.length < 2) {
        return;
      }
      const existing = candidates.get(label);
      const weight = SIGNAL_WEIGHT[signal];
      // Keep the strongest reason when a company shows up more than once.
      if (!existing || weight > existing.weight) {
        candidates.set(label, { signal, reason, weight });
      }
    };

    try {
      const leads = await this.leadRepository.find({ where: { profileId } });

      // Companies the user rejected are an explicit negative preference and
      // must never be suggested back to them.
      const flags = await this.leadFlagRepository.find({
        where: { profileId },
      });
      const flaggedLeadIds = new Set(flags.map((flag) => flag.leadId));
      const flaggedCompanies = new Set(
        leads
          .filter((lead) => flaggedLeadIds.has(lead.id))
          .map((lead) => (lead.company || '').trim().toLowerCase())
          .filter(Boolean)
      );

      for (const lead of leads) {
        const company = (lead.company || '').trim();
        if (!company || flaggedCompanies.has(company.toLowerCase())) {
          continue;
        }

        if (this.pursuedStatuses.includes(lead.status)) {
          add(
            company,
            'pursued-lead',
            `You pursued a role at ${company} before.`
          );
        } else {
          add(company, 'seen-lead', `${company} has come up in your leads.`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not read leads for ATS suggestions: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    try {
      const [record] = await this.onboardingRepository.find({
        where: { profileId },
        order: { createdAt: 'DESC' },
        take: 1,
      });

      for (const role of record?.profile?.resumeRoleSummaries || []) {
        add(
          role.company,
          'past-employer',
          `You worked at ${role.company} — they may be hiring again.`
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not read onboarding profile for ATS suggestions: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return candidates;
  }
}
