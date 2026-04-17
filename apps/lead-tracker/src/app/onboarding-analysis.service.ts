import { Injectable, Logger } from '@nestjs/common';
import {
  DiscAssessment,
  DiscInterviewRequest,
  DiscInterviewResponse,
  MadLibAnalysisResult,
  OnboardingProfileSuggestions,
  OnboardingSuggestionEvidence,
  ResumeParseRequest,
  ResumeParseResult,
  ResumeRoleSummary,
  UserOnboardingProfile,
  GeneratedTopicSuggestion,
  LeadDiscoverySource,
  LeadTopicDiscoveryIntent,
} from '@optimistic-tanuki/models';
import { LlmOnboardingAnalysisService } from './llm-onboarding-analysis.service';

@Injectable()
export class OnboardingAnalysisService {
  private readonly logger = new Logger(OnboardingAnalysisService.name);

  constructor(
    private readonly llmAnalysisService: LlmOnboardingAnalysisService
  ) {}

  async analyzeMadLib(text: string): Promise<MadLibAnalysisResult> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return {
        summary: '',
        suggestedServiceOffer: '',
        suggestedSkills: [],
        suggestedProfile: {},
      };
    }

    if (this.llmAnalysisService.isAvailable) {
      try {
        return this.sanitizeMadLibAnalysisResult(
          await this.llmAnalysisService.analyzeMadLib(normalizedText)
        );
      } catch (error) {
        this.logger.warn(
          `LLM mad-lib analysis failed, using deterministic fallback: ${
            (error as Error).message
          }`
        );
      }
    }

    const heuristic = this.buildSuggestedProfile(normalizedText);
    const serviceOffer =
      heuristic.serviceOffer ||
      normalizedText.replace(/^i am\s+/i, '').replace(/\.$/, '');

    return {
      summary: normalizedText,
      suggestedServiceOffer: serviceOffer,
      suggestedSkills: heuristic.skills || this.extractKeywords(normalizedText),
      suggestedIdealCustomer: heuristic.idealCustomer,
      suggestedProfile: heuristic,
      evidenceByField: this.buildSuggestionEvidence(normalizedText, heuristic),
    };
  }

  async parseResume(request: ResumeParseRequest): Promise<ResumeParseResult> {
    const extractedText = this.extractResumeText(request);

    if (this.llmAnalysisService.isAvailable && extractedText) {
      try {
        const parsed = await this.llmAnalysisService.parseResumeText(
          extractedText
        );
        if (
          parsed.summary ||
          parsed.skills.length ||
          parsed.experience.length
        ) {
          return this.sanitizeResumeParseResult(parsed);
        }
      } catch (error) {
        this.logger.warn(
          `LLM resume parsing failed, using deterministic fallback: ${
            (error as Error).message
          }`
        );
      }
    }

    const lines = extractedText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const roleSummaries = this.extractRoleSummaries(lines);
    const suggestedProfile = this.buildSuggestedProfile(
      extractedText,
      roleSummaries
    );

    return this.sanitizeResumeParseResult({
      summary: lines.slice(0, 4).join(' ').slice(0, 320),
      skills: this.extractKeywords(extractedText),
      experience: lines
        .filter((line) =>
          /(years|engineer|developer|consultant|manager|lead|architect|director)/i.test(
            line
          )
        )
        .slice(0, 6),
      certifications: lines
        .filter((line) =>
          /(certified|certification|pmp|aws|scrum|google|azure)/i.test(line)
        )
        .slice(0, 6),
      suggestedProfile,
      roleSummaries,
      evidenceByField: this.buildSuggestionEvidence(
        extractedText,
        suggestedProfile
      ),
    });
  }

  async advanceDiscInterview(
    request: DiscInterviewRequest
  ): Promise<DiscInterviewResponse> {
    const prompts = [
      'Tell me about a recent situation where you had to influence a difficult decision quickly.',
      'How do you usually react when a teammate misses a deadline or quality bar?',
      'When a project becomes ambiguous, what do you do first?',
      'What kind of work environment helps you perform at your best?',
    ];
    const userResponses = request.transcript.filter(
      (turn) => turn.role === 'user'
    );

    if (userResponses.length < prompts.length) {
      return {
        complete: false,
        nextQuestion: prompts[userResponses.length],
      };
    }

    const assessment = await this.assessDiscTranscript(request);
    return {
      complete: true,
      assessment,
      discType: assessment.primaryType,
    };
  }

  async analyzeProfile(
    profile: UserOnboardingProfile
  ): Promise<GeneratedTopicSuggestion[]> {
    if (this.llmAnalysisService.isAvailable) {
      try {
        this.logger.log('Analyzing onboarding profile with LLM');
        const result = await this.llmAnalysisService.analyzeProfile(profile);
        const deterministicTopics = await this.analyzeProfileDeterministic(
          profile
        );
        const topics =
          result.topics.length >= 7
            ? result.topics
            : this.mergeTopicCollections(result.topics, deterministicTopics);
        this.logger.log(
          `LLM analysis complete: archetype=${result.archetype}, topics=${topics.length}`
        );
        return topics.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return b.confidence - a.confidence;
        });
      } catch (error) {
        this.logger.warn(
          `LLM analysis failed, falling back to deterministic: ${
            (error as Error).message
          }`
        );
      }
    }

    this.logger.log('Analyzing onboarding profile with deterministic fallback');
    return this.analyzeProfileDeterministic(profile);
  }

  private analyzeProfileDeterministic(
    profile: UserOnboardingProfile
  ): Promise<GeneratedTopicSuggestion[]> {
    const topics: GeneratedTopicSuggestion[] = [];

    const jobTopic = this.generateJobTopic(profile);
    if (jobTopic) {
      topics.push(jobTopic);
    }

    const buyerTopics = this.generateBuyerTopics(profile);
    topics.push(...buyerTopics);

    const skillTopics = this.generateSkillTopics(profile);
    topics.push(...skillTopics);

    const industryTopics = this.generateIndustryTopics(profile);
    topics.push(...industryTopics);

    return Promise.resolve(
      this.deduplicateTopics(topics).sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.confidence - a.confidence;
      })
    );
  }

  private generateJobTopic(
    profile: UserOnboardingProfile
  ): GeneratedTopicSuggestion | null {
    if (!profile.serviceOffer) return null;

    const keywords = this.deriveJobKeywords(profile);
    const sources = this.deriveJobSources(profile);

    return {
      name: `${profile.serviceOffer} roles`,
      description: `Remote and hybrid positions for ${
        profile.serviceOffer
      } seeking candidates with ${profile.skills
        .slice(0, 3)
        .join(', ')} expertise.`,
      keywords,
      excludedTerms: this.normalizeExcludedTerms(profile),
      discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources,
      priority: 1,
      targetCompanies: this.deriveTargetCompanies(profile),
      buyerPersona: '',
      painPoints: profile.problemsSolved,
      valueProposition: `Hiring ${profile.serviceOffer} expertise`,
      searchStrategy: this.determineSearchStrategy(profile),
      confidence: this.calculateConfidence(profile, 'job'),
    };
  }

  private generateBuyerTopics(
    profile: UserOnboardingProfile
  ): GeneratedTopicSuggestion[] {
    const topics: GeneratedTopicSuggestion[] = [];

    if (!profile.geographicFocus || profile.geographicFocus === 'Global') {
      topics.push({
        name: `${profile.serviceOffer} buyers - Global`,
        description: `Companies globally seeking ${profile.outcomes.join(
          ', '
        )}.`,
        keywords: this.deriveBuyerKeywords(profile),
        excludedTerms: this.normalizeExcludedTerms(profile),
        discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
        sources: [LeadDiscoverySource.CLUTCH, LeadDiscoverySource.CRUNCHBASE],
        priority: 2,
        targetCompanies: profile.companySizeTarget,
        buyerPersona: profile.idealCustomer,
        painPoints: profile.problemsSolved,
        valueProposition: profile.outcomes[0] || profile.serviceOffer,
        searchStrategy: 'balanced',
        confidence: this.calculateConfidence(profile, 'buyer-global'),
      });
    }

    if (profile.geographicFocus && profile.geographicFocus !== 'Global') {
      topics.push({
        name: `${profile.serviceOffer} buyers - ${profile.geographicFocus}`,
        description: `${
          profile.geographicFocus
        } companies needing ${profile.outcomes.join(', ')}.`,
        keywords: this.deriveBuyerKeywords(profile),
        excludedTerms: this.normalizeExcludedTerms(profile),
        discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
        sources: [LeadDiscoverySource.GOOGLE_MAPS, LeadDiscoverySource.CLUTCH],
        googleMapsCities: [
          profile.localSearchLocation || profile.geographicFocus,
        ],
        googleMapsTypes: this.deriveGoogleMapsBusinessTypes(profile),
        priority: 3,
        targetCompanies: profile.companySizeTarget,
        buyerPersona: profile.idealCustomer,
        painPoints: profile.problemsSolved,
        valueProposition: profile.outcomes[0] || profile.serviceOffer,
        searchStrategy: 'conservative',
        confidence: this.calculateConfidence(profile, 'buyer-regional'),
        googleMapsLocation:
          profile.localSearchLocation || profile.geographicFocus,
        googleMapsRadiusMiles: profile.localSearchRadiusMiles || 25,
      });
    }

    return topics;
  }

  private generateSkillTopics(
    profile: UserOnboardingProfile
  ): GeneratedTopicSuggestion[] {
    const topics: GeneratedTopicSuggestion[] = [];
    const combinedSkills = this.getCombinedSkills(profile);

    combinedSkills.slice(0, 6).forEach((skill, index) => {
      if (skill) {
        topics.push({
          name: `${skill} opportunities`,
          description: `Roles and projects requiring ${skill} expertise.`,
          keywords: [skill, ...profile.outcomes.slice(0, 2)],
          excludedTerms: this.normalizeExcludedTerms(profile),
          discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
          sources: [
            LeadDiscoverySource.REMOTE_OK,
            LeadDiscoverySource.HIMALAYAS,
          ],
          priority: 4 + index,
          targetCompanies: [],
          buyerPersona: '',
          painPoints: profile.problemsSolved.slice(0, 2),
          valueProposition: `${skill} expertise needed`,
          searchStrategy: 'aggressive',
          confidence: 70,
        });
      }
    });

    return topics;
  }

  private generateIndustryTopics(
    profile: UserOnboardingProfile
  ): GeneratedTopicSuggestion[] {
    return profile.industries.slice(0, 3).map((industry, index) => ({
      name: `${industry} modernization buyers`,
      description: `${industry} teams seeking help with ${profile.problemsSolved
        .slice(0, 2)
        .join(', ')} and ${profile.outcomes.slice(0, 2).join(', ')}.`,
      keywords: this.normalizeKeywords([
        industry,
        profile.serviceOffer,
        ...profile.problemsSolved.slice(0, 2),
        ...profile.outcomes.slice(0, 2),
      ]),
      excludedTerms: this.normalizeExcludedTerms(profile),
      discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
      sources:
        profile.geographicFocus && profile.geographicFocus !== 'Global'
          ? [LeadDiscoverySource.GOOGLE_MAPS, LeadDiscoverySource.CLUTCH]
          : [LeadDiscoverySource.CLUTCH, LeadDiscoverySource.CRUNCHBASE],
      googleMapsCities:
        profile.geographicFocus && profile.geographicFocus !== 'Global'
          ? [profile.localSearchLocation || profile.geographicFocus]
          : undefined,
      googleMapsTypes:
        profile.geographicFocus && profile.geographicFocus !== 'Global'
          ? this.deriveGoogleMapsBusinessTypes(profile)
          : undefined,
      priority: 8 + index,
      targetCompanies: [
        `${industry} companies`,
        ...this.deriveTargetCompanies(profile),
      ],
      buyerPersona: profile.idealCustomer,
      painPoints: profile.problemsSolved.slice(0, 3),
      valueProposition: profile.outcomes[0] || profile.serviceOffer,
      searchStrategy: this.determineSearchStrategy(profile),
      confidence: this.calculateConfidence(
        profile,
        `industry-${industry.toLowerCase()}`
      ),
      googleMapsLocation:
        profile.geographicFocus && profile.geographicFocus !== 'Global'
          ? profile.localSearchLocation || profile.geographicFocus
          : undefined,
      googleMapsRadiusMiles:
        profile.geographicFocus && profile.geographicFocus !== 'Global'
          ? profile.localSearchRadiusMiles || 25
          : undefined,
    }));
  }

  private deduplicateTopics(
    topics: GeneratedTopicSuggestion[]
  ): GeneratedTopicSuggestion[] {
    const seen = new Set<string>();
    return topics.filter((topic) => {
      const key = `${topic.name.toLowerCase()}::${topic.discoveryIntent}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private mergeTopicCollections(
    primary: GeneratedTopicSuggestion[],
    supplemental: GeneratedTopicSuggestion[]
  ): GeneratedTopicSuggestion[] {
    return this.deduplicateTopics([...primary, ...supplemental]);
  }

  private deriveJobKeywords(profile: UserOnboardingProfile): string[] {
    const keywords: string[] = [profile.serviceOffer];
    keywords.push(...this.getCombinedSkills(profile).slice(0, 5));
    keywords.push(...profile.outcomes.slice(0, 3));
    keywords.push(...profile.industries.slice(0, 2));
    if (profile.resumeParseSummary) {
      keywords.push(
        ...this.extractKeywords(profile.resumeParseSummary).slice(0, 3)
      );
    }
    return this.normalizeKeywords(keywords);
  }

  private deriveBuyerKeywords(profile: UserOnboardingProfile): string[] {
    const keywords: string[] = [profile.serviceOffer];
    keywords.push(...profile.problemsSolved.slice(0, 3));
    keywords.push(...profile.outcomes.slice(0, 3));
    if (profile.madLibSummary) {
      keywords.push(...this.extractKeywords(profile.madLibSummary).slice(0, 2));
    }
    return this.normalizeKeywords(keywords);
  }

  private deriveJobSources(
    profile: UserOnboardingProfile
  ): LeadDiscoverySource[] {
    const sources: LeadDiscoverySource[] = [
      LeadDiscoverySource.REMOTE_OK,
      LeadDiscoverySource.HIMALAYAS,
      LeadDiscoverySource.WE_WORK_REMOTELY,
    ];
    if ((profile.budgetRange || []).some((range) => range.includes('25k'))) {
      sources.push(LeadDiscoverySource.INDEED);
    }
    return sources;
  }

  private deriveTargetCompanies(profile: UserOnboardingProfile): string[] {
    const companies: string[] = [];
    if (profile.industries.length) {
      companies.push(...profile.industries.map((i) => `${i} companies`));
    }
    if (profile.companySizeTarget.length) {
      companies.push(
        ...profile.companySizeTarget.map((s) => `${s} employee companies`)
      );
    }
    return companies;
  }

  private deriveGoogleMapsBusinessTypes(
    profile: UserOnboardingProfile
  ): string[] {
    const types = this.normalizeKeywords([
      ...profile.industries.map((industry) => `${industry} business`),
      ...this.extractKeywords(profile.idealCustomer || '').map(
        (term) => `${term} business`
      ),
    ])
      .map((value) => value.toLowerCase())
      .slice(0, 4);

    return types.length ? types : ['business'];
  }

  private normalizeKeywords(keywords: string[]): string[] {
    return Array.from(new Set(keywords.filter((k) => k && k.trim())));
  }

  private normalizeExcludedTerms(profile: UserOnboardingProfile): string[] {
    const terms: string[] = profile.excludedCompanies || [];
    terms.push(...(profile.excludedIndustries || []));
    return terms.map((t) => t.toLowerCase().trim());
  }

  private determineSearchStrategy(
    profile: UserOnboardingProfile
  ): 'aggressive' | 'balanced' | 'conservative' {
    if (profile.salesApproach === 'Outbound focused') return 'aggressive';
    if (profile.salesApproach === 'Inbound only') return 'conservative';
    return 'balanced';
  }

  private calculateConfidence(
    profile: UserOnboardingProfile,
    topicType: string
  ): number {
    let score = 50;
    score += Math.min(profile.skills.length * 5, 20);
    score += Math.min(profile.outcomes.length * 3, 15);
    if (profile.idealCustomer) score += 10;
    score += Math.min(profile.industries.length * 5, 10);
    if (profile.discType && profile.discType !== "I don't know") score += 5;
    if (profile.resumeParseSummary) score += 5;
    if (profile.discAssessment?.confidence) {
      score += Math.round(profile.discAssessment.confidence / 20);
    }
    return Math.min(score, 95);
  }

  private getCombinedSkills(profile: UserOnboardingProfile): string[] {
    return this.normalizeKeywords([
      ...(profile.skills || []),
      ...(profile.resumeDerivedSkills || []),
    ]);
  }

  private extractKeywords(text: string): string[] {
    const knownSkills: Array<[string, string]> = [
      ['react', 'React'],
      ['typescript', 'TypeScript'],
      ['javascript', 'JavaScript'],
      ['angular', 'Angular'],
      ['node', 'Node'],
      ['nestjs', 'NestJS'],
      ['aws', 'AWS'],
      ['azure', 'Azure'],
      ['product', 'Product'],
      ['engineering', 'Engineering'],
      ['frontend', 'Frontend'],
      ['backend', 'Backend'],
      ['saas', 'SaaS'],
      ['healthcare', 'Healthcare'],
      ['finance', 'Finance'],
      ['marketing', 'Marketing'],
      ['seo', 'SEO'],
      ['sales', 'Sales'],
      ['coaching', 'Coaching'],
    ];

    const lower = text.toLowerCase();
    return knownSkills
      .filter(([match]) => lower.includes(match))
      .map(([, label]) => label);
  }

  private extractResumeText(request: ResumeParseRequest): string {
    const buffer = Buffer.from(request.contentBase64, 'base64');
    const extractedText = this.isPlainTextDocument(request, buffer)
      ? this.decodePlainTextBuffer(buffer)
      : this.extractReadableTextFromBinary(buffer);

    return this.sanitizeExtractedText(extractedText);
  }

  private isPlainTextDocument(
    request: ResumeParseRequest,
    buffer: Buffer
  ): boolean {
    const mimeType = request.mimeType.toLowerCase();
    const filename = request.filename.toLowerCase();
    if (
      mimeType.startsWith('text/') ||
      filename.endsWith('.txt') ||
      filename.endsWith('.md')
    ) {
      return true;
    }

    const sample = buffer.subarray(0, Math.min(buffer.length, 512));
    const printableCount = sample.reduce((count, byte) => {
      if (
        byte === 0x09 ||
        byte === 0x0a ||
        byte === 0x0d ||
        (byte >= 0x20 && byte <= 0x7e)
      ) {
        return count + 1;
      }
      return count;
    }, 0);

    return sample.length > 0 && printableCount / sample.length > 0.85;
  }

  private decodePlainTextBuffer(buffer: Buffer): string {
    return buffer.toString('utf8');
  }

  private extractReadableTextFromBinary(buffer: Buffer): string {
    const binaryText = buffer.toString('latin1');
    const spans = this.replaceNonPrintable(binaryText, '\n', true)
      .split(/\n+/)
      .map((line) =>
        line.replace(/[^A-Za-z0-9@&/().,:'"+\-_%# ]+/g, ' ').trim()
      )
      .filter((line) => this.isReadableResumeSpan(line));

    if (spans.length) {
      return spans.join('\n');
    }

    return binaryText;
  }

  private isReadableResumeSpan(line: string): boolean {
    if (line.length < 4) {
      return false;
    }

    const alphaNumericCount = (line.match(/[A-Za-z0-9]/g) || []).length;
    return alphaNumericCount >= 4 && alphaNumericCount / line.length >= 0.45;
  }

  private sanitizeExtractedText(text: string): string {
    const withoutNonPrintable = text
      .normalize('NFKC')
      .split('')
      .map((char) => (this.isNonPrintable(char) ? ' ' : char))
      .join('');

    return withoutNonPrintable
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B-\u200F\u2028\u2029\u2060\uFEFF]/g, '')
      .replace(/[\uE000-\uF8FF]/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private replaceNonPrintable(
    value: string,
    replacement: string,
    collapseRuns = false
  ): string {
    let result = '';
    let inRun = false;

    for (const char of value) {
      if (this.isNonPrintable(char)) {
        if (!collapseRuns || !inRun) {
          result += replacement;
        }
        inRun = true;
        continue;
      }

      inRun = false;
      result += char;
    }

    return result;
  }

  private isNonPrintable(char: string): boolean {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      (code >= 0x7f && code <= 0x9f)
    );
  }

  private async assessDiscTranscript(
    request: DiscInterviewRequest
  ): Promise<DiscAssessment> {
    if (this.llmAnalysisService.isAvailable) {
      try {
        return await this.llmAnalysisService.assessDiscInterview(
          request.transcript
        );
      } catch (error) {
        this.logger.warn(
          `LLM DISC assessment failed, using deterministic fallback: ${
            (error as Error).message
          }`
        );
      }
    }

    const joinedText = request.transcript
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.text.toLowerCase())
      .join(' ');
    const scores = this.scoreDiscQuadrants(joinedText);
    const ordered = Object.entries(scores).sort(
      (left, right) => right[1] - left[1]
    );
    const primaryType = ordered[0][0];
    const secondaryType = ordered[1]?.[0];

    return {
      dScore: scores.D,
      iScore: scores.I,
      sScore: scores.S,
      cScore: scores.C,
      primaryType,
      secondaryType,
      summary: this.buildDiscSummary(scores, primaryType, secondaryType),
      confidence: 82,
    };
  }

  private buildSuggestedProfile(
    text: string,
    roleSummaries: ResumeRoleSummary[] = []
  ): OnboardingProfileSuggestions {
    const skills = this.extractKeywords(text);
    const industries = this.extractIndustries(text, roleSummaries);
    const outcomes = this.extractOutcomePhrases(text, roleSummaries);
    const problemsSolved = this.extractProblemPhrases(text);
    const idealCustomer = this.extractIdealCustomer(text);
    const outreachMethod = this.extractOutreachMethods(text);
    const salesApproach = this.extractSalesApproach(text);
    const geographicFocus = this.extractGeographicFocus(text);
    const companySizeTarget = this.extractCompanySizeTargets(text);
    const certifications = this.extractCertifications(text);
    const serviceOffer = this.extractServiceOffer(text, skills);
    const yearsExperience = this.extractYearsExperience(text);

    return {
      serviceOffer,
      yearsExperience,
      skills,
      certifications,
      idealCustomer,
      companySizeTarget,
      industries,
      problemsSolved,
      outcomes,
      geographicFocus,
      salesApproach,
      outreachMethod,
      communicationStyle: this.extractCommunicationStyle(text),
      leadSignalTypes: this.extractLeadSignals(text),
    };
  }

  private buildSuggestionEvidence(
    text: string,
    suggestions: OnboardingProfileSuggestions
  ): OnboardingSuggestionEvidence {
    const evidence: OnboardingSuggestionEvidence = {};
    const lines = text
      .split('\n')
      .map((line) => this.sanitizeExtractedText(line).trim())
      .filter(Boolean);

    const assign = (
      key: keyof OnboardingProfileSuggestions,
      values: string[] | string | undefined
    ) => {
      const lookup = Array.isArray(values) ? values : values ? [values] : [];
      if (!lookup.length) return;
      const matches = lines.filter((line) =>
        lookup.some((value) => line.toLowerCase().includes(value.toLowerCase()))
      );
      if (matches.length) {
        evidence[key] = this.sanitizeStringArray(matches.slice(0, 3));
        return;
      }

      if (key === 'idealCustomer') {
        const audienceMatches = lines.filter((line) =>
          /(vp engineering|cto|product leaders?|founder|buyer|clinical operations|revenue teams?)/i.test(
            line
          )
        );
        if (audienceMatches.length) {
          evidence[key] = this.sanitizeStringArray(audienceMatches.slice(0, 3));
          return;
        }
      }

      const keywordMatches = lines.filter((line) =>
        lookup.some((value) =>
          value
            .toLowerCase()
            .split(/[^a-z0-9+]+/i)
            .filter((token) => token.length >= 4)
            .some((token) => line.toLowerCase().includes(token))
        )
      );
      if (keywordMatches.length) {
        evidence[key] = this.sanitizeStringArray(keywordMatches.slice(0, 3));
      }
    };

    Object.entries(suggestions).forEach(([key, value]) => {
      assign(
        key as keyof OnboardingProfileSuggestions,
        value as string[] | string
      );
    });

    return evidence;
  }

  private sanitizeMadLibAnalysisResult(
    result: MadLibAnalysisResult
  ): MadLibAnalysisResult {
    return {
      ...result,
      summary: this.sanitizeExtractedText(result.summary || ''),
      suggestedServiceOffer: this.sanitizeOptionalString(
        result.suggestedServiceOffer
      ),
      suggestedSkills: this.sanitizeStringArray(result.suggestedSkills || []),
      suggestedIdealCustomer: this.sanitizeOptionalString(
        result.suggestedIdealCustomer
      ),
      evidenceByField: this.sanitizeSuggestionEvidence(result.evidenceByField),
    };
  }

  private sanitizeResumeParseResult(
    result: ResumeParseResult
  ): ResumeParseResult {
    return {
      ...result,
      summary: this.sanitizeExtractedText(result.summary || ''),
      skills: this.sanitizeStringArray(result.skills || []),
      experience: this.sanitizeStringArray(result.experience || []),
      certifications: this.sanitizeStringArray(result.certifications || []),
      roleSummaries: (result.roleSummaries || []).map((role) => ({
        ...role,
        title: this.sanitizeExtractedText(role.title || ''),
        company: this.sanitizeOptionalString(role.company),
        skills: this.sanitizeStringArray(role.skills || []),
        industries: this.sanitizeStringArray(role.industries || []),
        highlights: this.sanitizeStringArray(role.highlights || []),
        outcomes: this.sanitizeStringArray(role.outcomes || []),
      })),
      suggestedProfile: this.sanitizeSuggestedProfile(
        result.suggestedProfile || {}
      ),
      evidenceByField: this.sanitizeSuggestionEvidence(result.evidenceByField),
    };
  }

  private sanitizeSuggestedProfile(
    profile: OnboardingProfileSuggestions
  ): OnboardingProfileSuggestions {
    return Object.fromEntries(
      Object.entries(profile).map(([key, value]) => {
        if (Array.isArray(value)) {
          return [key, this.sanitizeStringArray(value)];
        }
        if (typeof value === 'string') {
          return [key, this.sanitizeOptionalString(value)];
        }
        return [key, value];
      })
    ) as OnboardingProfileSuggestions;
  }

  private sanitizeSuggestionEvidence(
    evidence?: OnboardingSuggestionEvidence
  ): OnboardingSuggestionEvidence | undefined {
    if (!evidence) {
      return evidence;
    }

    return Object.fromEntries(
      Object.entries(evidence).map(([key, value]) => [
        key,
        this.sanitizeStringArray(value || []),
      ])
    ) as OnboardingSuggestionEvidence;
  }

  private sanitizeStringArray(values: string[]): string[] {
    return values
      .map((value) => this.sanitizeExtractedText(value))
      .filter((value) => value.length > 0);
  }

  private sanitizeOptionalString(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const sanitized = this.sanitizeExtractedText(value);
    return sanitized || undefined;
  }

  private extractRoleSummaries(lines: string[]): ResumeRoleSummary[] {
    const roles: ResumeRoleSummary[] = [];
    const titlePattern =
      /(consultant|engineer|developer|manager|lead|architect|director|founder|strategist|specialist|analyst)/i;

    let current: ResumeRoleSummary | null = null;

    const commitCurrent = () => {
      if (!current) return;
      current.skills = this.normalizeKeywords(current.skills);
      current.industries = this.normalizeKeywords(current.industries);
      current.highlights = this.normalizeKeywords(current.highlights);
      current.outcomes = this.normalizeKeywords(current.outcomes);
      roles.push(current);
      current = null;
    };

    for (const line of lines) {
      if (titlePattern.test(line) && line.length < 120) {
        commitCurrent();
        const [title, company] = line.split('|').map((part) => part.trim());
        current = {
          title,
          company: company || undefined,
          skills: this.extractKeywords(line),
          industries: this.extractIndustries(line),
          highlights: [],
          outcomes: [],
        };
        continue;
      }

      if (!current) {
        continue;
      }

      current.skills.push(...this.extractKeywords(line));
      current.industries.push(...this.extractIndustries(line));

      if (
        /(improv|reduc|increas|grew|accelerat|launched|delivered|boost)/i.test(
          line
        )
      ) {
        current.highlights.push(line);
        current.outcomes.push(...this.extractOutcomePhrases(line));
      }
    }

    commitCurrent();
    return roles;
  }

  private extractIndustries(
    text: string,
    roleSummaries: ResumeRoleSummary[] = []
  ): string[] {
    const industries: Array<[string, string]> = [
      ['saas', 'SaaS'],
      ['healthcare', 'Healthcare'],
      ['finance', 'Finance'],
      ['fintech', 'Fintech'],
      ['ecommerce', 'Ecommerce'],
      ['e-commerce', 'Ecommerce'],
      ['education', 'Education'],
      ['manufacturing', 'Manufacturing'],
      ['marketing', 'Marketing'],
      ['sales', 'Sales'],
    ];

    const lower = text.toLowerCase();
    const direct = industries
      .filter(([match]) => lower.includes(match))
      .map(([, label]) => label);
    const fromRoles = roleSummaries.flatMap((role) => role.industries);
    return this.normalizeKeywords([...direct, ...fromRoles]).slice(0, 6);
  }

  private extractOutcomePhrases(
    text: string,
    roleSummaries: ResumeRoleSummary[] = []
  ): string[] {
    const matches =
      text.match(
        /((?:reduce[ds]?|improv(?:e|ed)|increase[ds]?|grew|accelerat(?:e|ed)|boost(?:ed)?|deliver(?:ed)?|win)[^.!\n]+)/gi
      ) || [];
    const fromRoles = roleSummaries.flatMap((role) => role.outcomes);
    const fragments = [...matches, ...fromRoles].flatMap((match) =>
      match
        .split(/\s+and\s+|,\s+/i)
        .map((part) => part.trim())
        .filter((part) =>
          /^(reduce[ds]?|improv(?:e|ed)|increase[ds]?|grew|accelerat(?:e|ed)|boost(?:ed)?|deliver(?:ed)?|win)/i.test(
            part
          )
        )
    );
    return this.normalizeKeywords(fragments).slice(0, 6);
  }

  private extractProblemPhrases(text: string): string[] {
    const candidates: string[] = [];
    if (/moderniz/i.test(text) || /legacy/i.test(text)) {
      candidates.push('legacy frontend');
    }
    if (/release|delivery|velocity/i.test(text)) {
      candidates.push('slow delivery');
    }
    if (/reporting|analytics/i.test(text)) {
      candidates.push('limited reporting visibility');
    }
    if (/conversion/i.test(text)) {
      candidates.push('low conversion rates');
    }
    if (/onboarding/i.test(text)) {
      candidates.push('friction in onboarding');
    }
    return this.normalizeKeywords(candidates).slice(0, 5);
  }

  private extractIdealCustomer(text: string): string | undefined {
    const helpMatch = text.match(
      /help ([^.!\n]+?) (?:moderniz|improv|reduce|increase|solve|win|deliver|build)/i
    );
    if (helpMatch?.[1]) {
      return helpMatch[1].trim();
    }
    const roleMatches = text.match(
      /\b(VP Engineering|CTO|CEO|Founder|Product leader|Product leaders|Head of Engineering|Clinical operations|Revenue teams?|Marketing leaders?)\b/gi
    );
    if (roleMatches?.length) {
      return this.normalizeKeywords(roleMatches).join(' and ');
    }
    const forMatch = text.match(/for ([^.!\n]+)/i);
    return forMatch?.[1]?.trim();
  }

  private extractOutreachMethods(text: string): string[] {
    const methods: Array<[string, string]> = [
      ['email', 'Email'],
      ['linkedin', 'LinkedIn'],
      ['referral', 'Referrals'],
      ['network', 'Networking events'],
      ['cold call', 'Cold calls'],
      ['content', 'Content marketing'],
      ['outbound', 'Email'],
    ];
    const lower = text.toLowerCase();
    return this.normalizeKeywords(
      methods
        .filter(([match]) => lower.includes(match))
        .map(([, label]) => label)
    );
  }

  private extractSalesApproach(text: string): string | undefined {
    if (/consultative/i.test(text)) return 'Consultative';
    if (/outbound/i.test(text)) return 'Outbound focused';
    if (/inbound/i.test(text)) return 'Inbound only';
    if (/hybrid/i.test(text)) return 'Hybrid';
    return undefined;
  }

  private extractGeographicFocus(text: string): string | undefined {
    if (/north america/i.test(text)) return 'North America';
    if (/us only|united states/i.test(text)) return 'US only';
    if (/europe/i.test(text)) return 'Europe';
    if (/global|worldwide|international/i.test(text)) return 'Global';
    return undefined;
  }

  private extractCompanySizeTargets(text: string): string[] {
    const ranges: string[] = [];
    if (/\b1-10\b/.test(text)) ranges.push('1-10');
    if (/\b11-50\b/.test(text)) ranges.push('11-50');
    if (/\b50-250\b|\b51-200\b/.test(text)) ranges.push('51-200');
    if (/\b201-500\b/.test(text)) ranges.push('201-500');
    if (/\b500\+\b|\b500 plus\b/i.test(text)) ranges.push('500+');
    if (/50-500 employee/i.test(text)) {
      ranges.push('51-200', '201-500');
    }
    return this.normalizeKeywords(ranges);
  }

  private extractCertifications(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) =>
        /(certified|certification|pmp|scrum master|google partner)/i.test(line)
      )
      .slice(0, 6);
  }

  private extractServiceOffer(
    text: string,
    skills: string[]
  ): string | undefined {
    const modernizationMatch = text.match(
      /help [^.!\n]+? modernize ([^.!\n,]+)/i
    );
    if (modernizationMatch?.[1]) {
      return `${modernizationMatch[1].trim()} modernization`;
    }

    const helpDelivering = text.match(
      /help [^.!\n]+? solve [^.!\n]+? by delivering ([^.!\n]+)/i
    );
    if (helpDelivering?.[1]) {
      return helpDelivering[1].trim().replace(/\.$/, '');
    }

    const helpUsing = text.match(
      /help [^.!\n]+? solve [^.!\n]+? by ([^.!\n]+?) using/i
    );
    if (helpUsing?.[1]) {
      return helpUsing[1].trim().replace(/\.$/, '');
    }

    const specialization = text.match(
      /(?:specializes? in|help[s]? [^.]*? by delivering|deliver(?:ing)?|led) ([^.!\n]+)/i
    );
    if (specialization?.[1]) {
      return specialization[1].trim().replace(/\.$/, '');
    }
    if (/consultant/i.test(text) && skills.length) {
      return `${skills.slice(0, 2).join(' / ')} consulting`;
    }
    return undefined;
  }

  private extractYearsExperience(text: string): string | undefined {
    const exact = text.match(/(\d+\+?\s*years?)/i);
    if (exact?.[1]) {
      const normalized = exact[1].replace(/\s+/g, ' ').trim();
      return normalized.includes('years') ? normalized : `${normalized} years`;
    }
    if (/principal|staff|director|head of/i.test(text)) {
      return '10+ years';
    }
    if (/senior|lead|architect/i.test(text)) {
      return '6-10 years';
    }
    return undefined;
  }

  private extractCommunicationStyle(text: string): string | undefined {
    if (/direct/i.test(text)) return 'Direct';
    if (/technical/i.test(text) || /data/i.test(text)) return 'Technical';
    if (/formal/i.test(text)) return 'Formal';
    if (/casual/i.test(text)) return 'Casual';
    if (/story/i.test(text)) return 'Story-driven';
    return undefined;
  }

  private extractLeadSignals(text: string): string[] {
    const signals: Array<[string, string]> = [
      ['hiring', 'Company hiring'],
      ['funding', 'Funding rounds'],
      ['launch', 'New product launches'],
      ['growth', 'Company growth'],
      ['expansion', 'Expansion news'],
      ['job change', 'Job changes'],
    ];
    const lower = text.toLowerCase();
    return this.normalizeKeywords(
      signals
        .filter(([match]) => lower.includes(match))
        .map(([, label]) => label)
    );
  }

  private scoreDiscQuadrants(
    text: string
  ): Record<'D' | 'I' | 'S' | 'C', number> {
    const buckets: Record<'D' | 'I' | 'S' | 'C', string[]> = {
      D: [
        'control',
        'lead',
        'direct',
        'fast',
        'decis',
        'challenge',
        'obstacle',
        'ownership',
        'drive',
      ],
      I: [
        'persuad',
        'influence',
        'energ',
        'excited',
        'collaborat',
        'network',
        'relationship',
        'team',
      ],
      S: [
        'support',
        'steady',
        'calm',
        'patient',
        'reliable',
        'consistent',
        'warm',
      ],
      C: [
        'quality',
        'detail',
        'accur',
        'process',
        'data',
        'plan',
        'analy',
        'clarify',
        'expectation',
      ],
    };

    const raw: Record<'D' | 'I' | 'S' | 'C', number> = {
      D: 1,
      I: 1,
      S: 1,
      C: 1,
    };
    (Object.keys(buckets) as Array<'D' | 'I' | 'S' | 'C'>).forEach((key) => {
      raw[key] += buckets[key].reduce(
        (total, token) => total + (text.includes(token) ? 1 : 0),
        0
      );
    });

    const total = raw.D + raw.I + raw.S + raw.C;
    const normalize = (value: number) =>
      Math.max(5, Math.round((value / total) * 100));

    return {
      D: normalize(raw.D),
      I: normalize(raw.I),
      S: normalize(raw.S),
      C: normalize(raw.C),
    };
  }

  private buildDiscSummary(
    scores: Record<'D' | 'I' | 'S' | 'C', number>,
    primaryType: string,
    secondaryType?: string
  ): string {
    const labels: Record<string, string> = {
      D: 'directness and control',
      I: 'influence and enthusiasm',
      S: 'steadiness and support',
      C: 'clarity and compliance',
    };

    return `behavioral profile summary: D ${scores.D}%, I ${scores.I}%, S ${
      scores.S
    }%, C ${scores.C}%. Primary tendency ${primaryType} (${
      labels[primaryType]
    }), with ${
      secondaryType || 'balanced'
    } as a secondary tendency. This is a lightweight communication and work-style summary, not a predictor of job performance.`;
  }
}
