import { Injectable, Logger } from '@nestjs/common';
import { Lead, LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadAnalysis, UserOnboardingProfile } from '@optimistic-tanuki/models';

@Injectable()
export class DiscoveryPipelineService {
  private readonly logger = new Logger(DiscoveryPipelineService.name);
  private readonly pipelineVersion = '2.0';

  async analyzeLead(
    lead: Lead,
    topic: LeadTopic | null,
    onboardingProfile: UserOnboardingProfile | null
  ): Promise<LeadAnalysis> {
    const relevance = this.calculateRelevance(lead, topic);
    const difficulty = this.calculateDifficulty(
      lead,
      topic,
      onboardingProfile
    );
    const userFit = this.calculateUserFit(lead, topic, onboardingProfile);
    const finalScore = this.calculateFinalScore([
      relevance.score,
      difficulty.score,
      userFit.score,
    ]);
    const classification = this.classifyLead(
      relevance.status,
      difficulty.status,
      userFit.status,
      finalScore
    );

    return {
      id: `${lead.id}-${topic?.id || 'manual'}`,
      leadId: lead.id,
      topicId: topic?.id || null,
      relevance,
      difficulty,
      userFit,
      finalScore,
      classification,
      pipelineVersion: this.pipelineVersion,
      analyzedAt: new Date(),
    };
  }

  private calculateRelevance(lead: Lead, topic: LeadTopic | null) {
    if (!topic) {
      return {
        score: 55,
        status: 'warning' as const,
        reasons: ['No discovery topic linked; using lead data only.'],
      };
    }

    let score = 0;
    const reasons: string[] = [];
    const leadText = `${lead.name} ${lead.company} ${
      lead.notes
    } ${lead.searchKeywords?.join(' ')}`.toLowerCase();
    const topicKeywords = [
      ...(topic.keywords || []),
      ...(topic.painPoints || []),
      topic.buyerPersona || '',
      topic.valueProposition || '',
    ]
      .map((k) => k.toLowerCase())
      .filter(Boolean);

    const matchedKeywords = topicKeywords.filter((kw) =>
      leadText.includes(kw.toLowerCase())
    );

    if (matchedKeywords.length) {
      score += Math.min(matchedKeywords.length * 18, 72);
      reasons.push(`Matched ${matchedKeywords.length} topic signals.`);
    }

    const excludedMatches = (topic.excludedTerms || []).filter((term) =>
      leadText.includes(term.toLowerCase())
    );

    if (excludedMatches.length) {
      score -= excludedMatches.length * 25;
      reasons.push(`Excluded terms matched: ${excludedMatches.join(', ')}.`);
    }

    if (lead.company) {
      score += 10;
      reasons.push('Company identified.');
    }
    if (lead.notes && lead.notes.length > 20) {
      score += 10;
      reasons.push('Lead includes detailed notes.');
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    return {
      score: normalizedScore,
      status: this.toStageStatus(normalizedScore),
      reasons: reasons.length ? reasons : ['No meaningful topic signals matched.'],
    };
  }

  private calculateDifficulty(
    lead: Lead,
    topic: LeadTopic | null,
    onboardingProfile: UserOnboardingProfile | null
  ) {
    let score = 75;
    const reasons: string[] = [];
    const text = `${lead.name} ${lead.company} ${lead.notes}`.toLowerCase();

    if (!lead.email) {
      score -= 12;
      reasons.push('Missing direct email contact.');
    }
    if (!lead.phone) {
      score -= 6;
      reasons.push('Missing phone contact.');
    }

    const decisionMakerTerms = ['vp', 'chief', 'ceo', 'founder', 'director'];
    if (decisionMakerTerms.some((term) => text.includes(term))) {
      score += 10;
      reasons.push('Decision-maker signal present.');
    }

    const frictionTerms = [
      'procurement',
      'rfp',
      'compliance',
      'enterprise',
      'transformation',
      'multi-year',
    ];
    const frictionMatches = frictionTerms.filter((term) => text.includes(term));
    if (frictionMatches.length) {
      score -= Math.min(frictionMatches.length * 8, 24);
      reasons.push(`Sales/delivery friction: ${frictionMatches.join(', ')}.`);
    }

    const positiveSignalTerms = ['urgent', 'budget', 'approved', 'this quarter'];
    const positiveMatches = positiveSignalTerms.filter((term) =>
      text.includes(term)
    );
    if (positiveMatches.length) {
      score += Math.min(positiveMatches.length * 6, 18);
      reasons.push('Urgency or budget signals reduce selling friction.');
    }

    const combinedSkills = [
      ...(onboardingProfile?.skills || []),
      ...(onboardingProfile?.resumeDerivedSkills || []),
    ];

    if (combinedSkills.length) {
      const skillMatches = combinedSkills.filter((skill) =>
        text.includes(skill.toLowerCase())
      );
      if (skillMatches.length) {
        score += Math.min(skillMatches.length * 5, 15);
        reasons.push('Required work overlaps with user skills.');
      }
    }

    if (topic?.searchStrategy === 'aggressive') {
      score -= 5;
      reasons.push('Aggressive search strategy implies noisier opportunities.');
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    return {
      score: normalizedScore,
      status: this.toStageStatus(normalizedScore),
      reasons: reasons.length
        ? reasons
        : ['No material sales or delivery friction detected.'],
    };
  }

  private calculateUserFit(
    lead: Lead,
    topic: LeadTopic | null,
    onboardingProfile: UserOnboardingProfile | null
  ) {
    if (!onboardingProfile) {
      return {
        score: null,
        status: 'unavailable' as const,
        reasons: ['User onboarding profile is required for fit scoring.'],
      };
    }

    let score = 20;
    const reasons: string[] = [];
    const text = `${lead.name} ${lead.company} ${lead.notes} ${
      lead.searchKeywords?.join(' ') || ''
    }`.toLowerCase();

    const serviceOfferTerms = (onboardingProfile.serviceOffer || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((term) => term.length > 3);
    const matchedServiceOfferTerms = serviceOfferTerms.filter((term) =>
      text.includes(term)
    );
    if (matchedServiceOfferTerms.length) {
      score += Math.min(matchedServiceOfferTerms.length * 10, 25);
      reasons.push('Lead aligns with the user service offer.');
    }

    const skillMatches = [
      ...(onboardingProfile.skills || []),
      ...(onboardingProfile.resumeDerivedSkills || []),
    ].filter((skill) =>
      text.includes(skill.toLowerCase())
    );
    if (skillMatches.length) {
      score += Math.min(skillMatches.length * 12, 30);
      reasons.push(`Lead overlaps with user skills: ${skillMatches.join(', ')}.`);
    }

    const industryMatches = (onboardingProfile.industries || []).filter((industry) =>
      text.includes(industry.toLowerCase())
    );
    if (industryMatches.length) {
      score += Math.min(industryMatches.length * 10, 20);
      reasons.push(
        `Lead matches target industries: ${industryMatches.join(', ')}.`
      );
    }

    if (
      onboardingProfile.idealCustomer &&
      topic?.buyerPersona &&
      (topic.buyerPersona.toLowerCase().includes(
        onboardingProfile.idealCustomer.toLowerCase()
      ) ||
        onboardingProfile.idealCustomer
          .toLowerCase()
          .split(/[^a-z0-9]+/g)
          .filter((term) => term.length > 2)
          .some((term) => text.includes(term)))
    ) {
      score += 10;
      reasons.push('Topic persona aligns with the onboarding ideal customer.');
    }

    const excludedMatches = [
      ...(onboardingProfile.excludedCompanies || []),
      ...(onboardingProfile.excludedIndustries || []),
    ].filter((term) => text.includes(term.toLowerCase()));
    if (excludedMatches.length) {
      score -= 60;
      reasons.push(`Excluded onboarding terms matched: ${excludedMatches.join(', ')}.`);
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    return {
      score: normalizedScore,
      status: this.toStageStatus(normalizedScore),
      reasons: reasons.length
        ? reasons
        : ['Lead has limited overlap with the onboarding profile.'],
    };
  }

  private calculateFinalScore(scores: Array<number | null>): number | null {
    const availableScores = scores.filter(
      (score): score is number => typeof score === 'number'
    );
    if (!availableScores.length) {
      return null;
    }

    return Math.round(
      availableScores.reduce((sum, score) => sum + score, 0) /
        availableScores.length
    );
  }

  private classifyLead(
    relevanceStatus: string,
    difficultyStatus: string,
    userFitStatus: string,
    finalScore: number | null
  ): 'strong-match' | 'review' | 'weak-match' {
    if (
      relevanceStatus === 'failed' ||
      difficultyStatus === 'failed' ||
      userFitStatus === 'failed'
    ) {
      return 'weak-match';
    }

    if (userFitStatus === 'unavailable') {
      return 'review';
    }

    if (
      relevanceStatus === 'passed' &&
      difficultyStatus !== 'failed' &&
      userFitStatus === 'passed' &&
      (finalScore || 0) >= 70
    ) {
      return 'strong-match';
    }

    return 'review';
  }

  private toStageStatus(
    score: number | null
  ): 'passed' | 'warning' | 'failed' | 'unavailable' {
    if (score === null) {
      return 'unavailable';
    }
    if (score >= 70) {
      return 'passed';
    }
    if (score >= 40) {
      return 'warning';
    }
    return 'failed';
  }
}
