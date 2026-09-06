import { Injectable, Logger } from '@nestjs/common';
import {
  GeneratedOutreachDraft,
  OutreachDraft,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';
import { Lead } from '@optimistic-tanuki/models/leads-entities';
import { LlmOnboardingAnalysisService } from '../llm-onboarding-analysis.service';
import {
  buildFactBase,
  extendFactCorpus,
  guardOutreachDraft,
} from './outreach-fact-guard';

const OUTREACH_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    greeting: { type: 'string' },
    opening: { type: 'string' },
    body: { type: 'array', items: { type: 'string' } },
    closing: { type: 'string' },
    signOff: { type: 'string' },
  },
  required: ['subject', 'greeting', 'opening', 'body', 'closing', 'signOff'],
} as const;

/**
 * Writes a first-contact message for one lead.
 *
 * The prompt asks for honesty; the guard enforces it, against both the user's
 * material and what the source observed about the lead. When no model is
 * reachable, a deterministic path assembles the same message by selecting the
 * user's own sentences — which is most of what the generator should be doing
 * anyway.
 */
@Injectable()
export class OutreachDraftService {
  private readonly logger = new Logger(OutreachDraftService.name);

  constructor(private readonly llm: LlmOnboardingAnalysisService) {}

  async generate(
    profile: UserOnboardingProfile,
    lead: Lead,
    version: number
  ): Promise<GeneratedOutreachDraft> {
    const observedSignals = this.describeObservedSignals(lead);
    // Both bodies of fact, because the message speaks about both parties.
    const facts = extendFactCorpus(
      buildFactBase(profile),
      lead.name,
      lead.company,
      lead.notes,
      ...(lead.searchKeywords || []),
      ...observedSignals
    );

    let draft: OutreachDraft;
    let modelGenerated = false;

    if (this.llm.isAvailable) {
      try {
        draft = await this.generateWithModel(profile, lead, observedSignals);
        modelGenerated = true;
      } catch (error) {
        this.logger.warn(
          `Outreach draft via LLM failed, using deterministic fallback: ${
            (error as Error).message
          }`
        );
        draft = this.buildDeterministically(profile, lead, observedSignals);
      }
    } else {
      draft = this.buildDeterministically(profile, lead, observedSignals);
    }

    const guarded = guardOutreachDraft(draft, facts);

    return {
      leadId: lead.id,
      draft: guarded.value,
      evidence: {
        removedClaims: guarded.removedClaims,
        observedSignals,
        clean: guarded.removedClaims.length === 0,
      },
      version,
      modelGenerated,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * What the discovery source actually established about this lead. These are
   * the only things the message may assert about the recipient, and they are
   * reported back to the user so the opening can be judged rather than trusted.
   */
  private describeObservedSignals(lead: Lead): string[] {
    return [
      ...(lead.presenceGaps || []).map((gap) => gap.label),
      ...(lead.searchKeywords || []),
    ].filter(Boolean);
  }

  private describeUser(profile: UserOnboardingProfile): string {
    return `What they offer: ${profile.serviceOffer || ''}
Skills: ${[
      ...(profile.skills || []),
      ...(profile.resumeDerivedSkills || []),
    ].join(', ')}
Problems they solve: ${
      (profile.problemsSolved || []).join('; ') || 'none given'
    }
Outcomes they have delivered: ${
      (profile.outcomes || []).join('; ') || 'none given'
    }
Industries: ${(profile.industries || []).join(', ') || 'none given'}
Their own summary: ${
      profile.madLibSummary || profile.resumeParseSummary || ''
    }`;
  }

  private describeLead(lead: Lead, observedSignals: string[]): string {
    return `Business: ${lead.company || lead.name}
What we recorded about them: ${lead.notes || 'nothing beyond the name'}
What we observed: ${observedSignals.join('; ') || 'nothing specific'}`;
  }

  private get antiFabricationRule(): string {
    return `ABSOLUTE RULE: every statement must trace to the material below.
About the sender, use only what appears in SENDER. About the recipient, use
only what appears in RECIPIENT. Do NOT invent a metric, a client name, a
credential, a mutual connection, or anything you "noticed" that is not listed
under what we observed. Do not guess at the recipient's problems. If you have
nothing specific to say, say less — a short honest note beats a long invented
one, and an invented one is worse than sending nothing.`;
  }

  private async generateWithModel(
    profile: UserOnboardingProfile,
    lead: Lead,
    observedSignals: string[]
  ): Promise<OutreachDraft> {
    const tone = profile.communicationStyle
      ? `Write in a ${profile.communicationStyle.toLowerCase()} register.`
      : '';

    return this.llm.generateJson<OutreachDraft>(
      `You write one short first-contact email from a service provider to a
business they have never spoken to.

${this.antiFabricationRule}

${tone}
Subject line under ten words. One to three short body paragraphs. No flattery,
no "I hope this finds you well", no claims of having studied their business
beyond what we observed. Close by proposing one small, concrete next step.`,
      `SENDER:\n${this.describeUser(
        profile
      )}\n\nRECIPIENT:\n${this.describeLead(lead, observedSignals)}`,
      OUTREACH_SCHEMA
    );
  }

  /**
   * Model-free path. Composes the message from the user's own sentences and the
   * source's own observations, so it cannot fabricate by construction.
   */
  private buildDeterministically(
    profile: UserOnboardingProfile,
    lead: Lead,
    observedSignals: string[]
  ): OutreachDraft {
    const business = lead.company || lead.name;
    const offer = profile.serviceOffer || '';
    const body: string[] = [];

    if (offer) {
      body.push(offer);
    }
    const problems = (profile.problemsSolved || []).slice(0, 2);
    if (problems.length) {
      body.push(problems.join(' '));
    }
    const outcomes = (profile.outcomes || []).slice(0, 2);
    if (outcomes.length) {
      body.push(outcomes.join(' '));
    }

    return {
      subject: business ? `${business}` : 'Getting in touch',
      greeting: business ? `Hello ${business},` : 'Hello,',
      // Deliberately flat. Naming the observed signal in a way that reads as a
      // pitch is a later slice; asserting more than this without a model would
      // mean writing a claim nobody checked.
      opening: observedSignals.length
        ? `I came across ${business} and noticed ${observedSignals[0]}.`
        : `I came across ${business} and wanted to introduce myself.`,
      body,
      closing: 'If this is worth a short conversation, let me know.',
      signOff: 'Thanks,',
    };
  }
}
