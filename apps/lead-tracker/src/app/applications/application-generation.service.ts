import { Injectable, Logger } from '@nestjs/common';
import {
  GeneratedApplication,
  TailoredCoverLetter,
  TailoredResume,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';
import { Lead } from '@optimistic-tanuki/models/leads-entities';
import { LlmOnboardingAnalysisService } from '../llm-onboarding-analysis.service';
import {
  buildFactBase,
  findGaps,
  guardCoverLetter,
  guardResume,
} from './fact-guard';

const RESUME_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    skills: { type: 'array', items: { type: 'string' } },
    certifications: { type: 'array', items: { type: 'string' } },
    roles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          dateRange: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'highlights'],
      },
    },
  },
  required: ['summary', 'skills', 'roles', 'certifications'],
} as const;

const COVER_LETTER_SCHEMA = {
  type: 'object',
  properties: {
    greeting: { type: 'string' },
    opening: { type: 'string' },
    body: { type: 'array', items: { type: 'string' } },
    closing: { type: 'string' },
    signOff: { type: 'string' },
  },
  required: ['greeting', 'opening', 'body', 'closing', 'signOff'],
} as const;

/**
 * Produces a resume and cover letter aimed at one specific opening.
 *
 * Everything the model returns passes through the fact guard before it reaches
 * the user. The prompt asks for honesty; the guard enforces it. When no model
 * is reachable, a deterministic path assembles the same documents purely by
 * selecting and ordering the user's existing material — which is what the
 * generator is supposed to be doing anyway.
 */
@Injectable()
export class ApplicationGenerationService {
  private readonly logger = new Logger(ApplicationGenerationService.name);

  constructor(private readonly llm: LlmOnboardingAnalysisService) {}

  async generate(
    profile: UserOnboardingProfile,
    lead: Lead,
    version: number
  ): Promise<GeneratedApplication> {
    const facts = buildFactBase(profile);
    const postingText = [lead.name, lead.company, lead.notes]
      .filter(Boolean)
      .join('\n');

    let resume: TailoredResume;
    let coverLetter: TailoredCoverLetter;
    let modelGenerated = false;

    if (this.llm.isAvailable) {
      try {
        resume = await this.generateResumeWithModel(profile, lead, postingText);
        coverLetter = await this.generateCoverLetterWithModel(
          profile,
          lead,
          postingText
        );
        modelGenerated = true;
      } catch (error) {
        this.logger.warn(
          `Application generation via LLM failed, using deterministic fallback: ${
            (error as Error).message
          }`
        );
        resume = this.buildResumeDeterministically(profile, lead);
        coverLetter = this.buildCoverLetterDeterministically(profile, lead);
      }
    } else {
      resume = this.buildResumeDeterministically(profile, lead);
      coverLetter = this.buildCoverLetterDeterministically(profile, lead);
    }

    // The guard runs on both paths. The deterministic builder only copies the
    // user's own material, so it should pass cleanly — and if it ever does not,
    // that is a bug worth surfacing rather than hiding.
    const guardedResume = guardResume(resume, facts);
    const guardedLetter = guardCoverLetter(coverLetter, facts);
    const removedClaims = [
      ...guardedResume.removedClaims,
      ...guardedLetter.removedClaims,
    ];

    return {
      leadId: lead.id,
      resume: guardedResume.value,
      coverLetter: guardedLetter.value,
      evidence: {
        gaps: findGaps(postingText, facts),
        removedClaims,
        clean: removedClaims.length === 0,
      },
      version,
      modelGenerated,
      generatedAt: new Date().toISOString(),
    };
  }

  private describeProfile(profile: UserOnboardingProfile): string {
    const roles = (profile.resumeRoleSummaries || [])
      .map(
        (role) =>
          `- ${role.title}${role.company ? ` at ${role.company}` : ''}${
            role.dateRange ? ` (${role.dateRange})` : ''
          }\n${role.highlights.map((h) => `    * ${h}`).join('\n')}`
      )
      .join('\n');

    return `Summary: ${
      profile.resumeParseSummary || profile.madLibSummary || ''
    }
Years experience: ${profile.yearsExperience}
Skills: ${[
      ...(profile.skills || []),
      ...(profile.resumeDerivedSkills || []),
    ].join(', ')}
Certifications: ${
      [
        ...(profile.certifications || []),
        ...(profile.resumeDerivedCertifications || []),
      ].join(', ') || 'none'
    }
Roles:
${roles || '(none parsed)'}`;
  }

  private get antiFabricationRule(): string {
    return `ABSOLUTE RULE: use ONLY facts present in the candidate material below.
You may reorder, select, and re-word for relevance. You may NOT introduce any
employer, job title, date, certification, metric, or achievement that does not
already appear. If the posting asks for something the candidate lacks, leave it
out entirely — do not imply it. Inventing content makes the document unusable.`;
  }

  private async generateResumeWithModel(
    profile: UserOnboardingProfile,
    lead: Lead,
    postingText: string
  ): Promise<TailoredResume> {
    return this.llm.generateJson<TailoredResume>(
      `You tailor an existing resume to one job posting.

${this.antiFabricationRule}

Select and order the candidate's real highlights by relevance to the posting.
Order their real skills by relevance. Keep the summary to two sentences.`,
      `POSTING:\n${postingText}\n\nCANDIDATE MATERIAL:\n${this.describeProfile(
        profile
      )}`,
      RESUME_SCHEMA
    );
  }

  private async generateCoverLetterWithModel(
    profile: UserOnboardingProfile,
    lead: Lead,
    postingText: string
  ): Promise<TailoredCoverLetter> {
    // Tone comes from how the user says they communicate, and from the
    // behavioural profile the interview produced.
    const tone = [
      profile.communicationStyle
        ? `Write in a ${profile.communicationStyle.toLowerCase()} register.`
        : '',
      profile.discAssessment?.primaryType
        ? `Their behavioural profile leans ${profile.discAssessment.primaryType}: ${profile.discAssessment.summary}`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return this.llm.generateJson<TailoredCoverLetter>(
      `You write a short cover letter for one job posting.

${this.antiFabricationRule}

${tone}
Two to four body paragraphs. Every claim must trace to the candidate material.`,
      `POSTING:\n${postingText}\n\nCANDIDATE MATERIAL:\n${this.describeProfile(
        profile
      )}`,
      COVER_LETTER_SCHEMA
    );
  }

  /**
   * Model-free path. Selects and orders the user's own material against the
   * posting keywords — no new sentences are composed, so it is fabrication-proof
   * by construction.
   */
  private buildResumeDeterministically(
    profile: UserOnboardingProfile,
    lead: Lead
  ): TailoredResume {
    const postingTerms = new Set(
      `${lead.name || ''} ${lead.notes || ''} ${(
        lead.searchKeywords || ''
      ).toString()}`
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((term) => term.length > 3)
    );

    const relevance = (text: string): number =>
      text
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((term) => postingTerms.has(term)).length;

    const skills = [
      ...new Set([
        ...(profile.skills || []),
        ...(profile.resumeDerivedSkills || []),
      ]),
    ].sort((a, b) => relevance(b) - relevance(a));

    const roles = (profile.resumeRoleSummaries || []).map((role) => ({
      title: role.title,
      company: role.company,
      dateRange: role.dateRange,
      highlights: [...role.highlights].sort(
        (a, b) => relevance(b) - relevance(a)
      ),
    }));

    return {
      // Reused verbatim rather than rewritten, so it stays the user's own words.
      summary: profile.resumeParseSummary || profile.madLibSummary || '',
      skills,
      roles,
      certifications: [
        ...new Set([
          ...(profile.certifications || []),
          ...(profile.resumeDerivedCertifications || []),
        ]),
      ],
    };
  }

  private buildCoverLetterDeterministically(
    profile: UserOnboardingProfile,
    lead: Lead
  ): TailoredCoverLetter {
    const topHighlights = (profile.resumeRoleSummaries || [])
      .flatMap((role) => role.highlights)
      .slice(0, 3);

    return {
      greeting: lead.company
        ? `Dear ${lead.company} hiring team,`
        : 'Dear hiring team,',
      opening: profile.resumeParseSummary || profile.madLibSummary || '',
      body: topHighlights,
      closing: '',
      signOff: 'Sincerely,',
    };
  }
}
