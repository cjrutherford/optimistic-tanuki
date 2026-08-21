import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  DiscAssessment,
  DiscDimension,
  DiscInterviewTurn,
  DiscQuestionSuggestion,
  DISC_DIMENSIONS,
  MadLibAnalysisResult,
  ResumeParseResult,
  UserOnboardingProfile,
  GeneratedTopicSuggestion,
  LeadDiscoverySource,
  LeadTopicDiscoveryIntent,
} from '@optimistic-tanuki/models';
import { ACTIVE_LEAD_DISCOVERY_SOURCES } from '@optimistic-tanuki/leads-contracts';

interface LlmTopicOutput {
  name: string;
  description: string;
  keywords: string[];
  excludedTerms: string[];
  discoveryIntent: string;
  sources: string[];
  priority: number;
  targetCompanies: string[];
  buyerPersona: string;
  painPoints: string[];
  valueProposition: string;
  searchStrategy: string;
  confidence: number;
}

interface OnboardingAnalysisOutput {
  personalityArchetype: string;
  topics: LlmTopicOutput[];
}

// Only sources the registry marks active. A model that suggests a retired one
// (they still exist in the enum for historical leads) has that topic dropped
// rather than silently configured against a provider that no longer runs.
const VALID_SOURCES = new Set<string>(
  ACTIVE_LEAD_DISCOVERY_SOURCES as string[]
);
const VALID_INTENTS = new Set<string>(
  Object.values(LeadTopicDiscoveryIntent) as string[]
);
const VALID_STRATEGIES = new Set(['aggressive', 'balanced', 'conservative']);

/**
 * Ollama supports schema-constrained decoding via the `format` field. Passing a
 * schema makes malformed JSON structurally impossible, rather than something we
 * try to recover by scraping braces out of prose after the fact.
 */
const DISC_QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    targetDimension: { type: 'string', enum: DISC_DIMENSIONS },
    sufficientSignal: { type: 'boolean' },
  },
  required: ['question', 'targetDimension', 'sufficientSignal'],
} as const;

const DISC_ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    dScore: { type: 'number' },
    iScore: { type: 'number' },
    sScore: { type: 'number' },
    cScore: { type: 'number' },
    primaryType: { type: 'string', enum: DISC_DIMENSIONS },
    secondaryType: { type: 'string', enum: DISC_DIMENSIONS },
    summary: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: [
    'dScore',
    'iScore',
    'sScore',
    'cScore',
    'primaryType',
    'summary',
    'confidence',
  ],
} as const;

@Injectable()
export class LlmOnboardingAnalysisService {
  private readonly logger = new Logger(LlmOnboardingAnalysisService.name);
  private llm: ChatOllama | null = null;

  constructor(private readonly config: ConfigService) {
    this.initializeModel();
  }

  private initializeModel(): void {
    try {
      const ollama = this.config.get<{
        host: string;
        port: number;
        model: string;
        temperature: number;
      }>('ollama');

      if (!ollama?.host || !ollama?.port) {
        this.logger.warn('Ollama config missing, LLM analysis disabled');
        return;
      }

      const baseUrl = `http://${ollama.host}:${ollama.port}`;
      this.llm = new ChatOllama({
        model: ollama.model || 'gemma3',
        baseUrl,
        temperature: ollama.temperature ?? 0.3,
        // Reasoning-capable models (qwen3/qwen3.5, nemotron) otherwise emit a
        // long thinking trace before the answer, which costs seconds on every
        // interview turn without improving a schema-constrained result.
        think: this.config.get<boolean>('ollama.think') ?? false,
      });
      this.logger.log(
        `Initialized LLM model: ${ollama.model || 'gemma3'} at ${baseUrl}`
      );
    } catch (error) {
      this.logger.error('Failed to initialize LLM model', error);
      this.llm = null;
    }
  }

  get isAvailable(): boolean {
    return this.llm !== null;
  }

  async analyzeProfile(
    profile: UserOnboardingProfile
  ): Promise<{ archetype: string; topics: GeneratedTopicSuggestion[] }> {
    if (!this.llm) {
      throw new Error('LLM model not available');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(profile);

    this.logger.log('Sending onboarding profile to LLM for analysis');

    const response = await this.raceWithTimeout(
      this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ])
    );

    const responseText =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    this.logger.debug('LLM raw response received');

    const parsed = this.parseLlmResponse(responseText);
    const topics = this.mapToGeneratedTopics(parsed.topics, profile);

    return { archetype: parsed.personalityArchetype, topics };
  }

  async analyzeMadLib(text: string): Promise<MadLibAnalysisResult> {
    const parsed = await this.invokeJson<MadLibAnalysisResult>(
      `You analyze short self-descriptions for a lead-discovery onboarding flow.

Respond with only valid JSON using this exact shape:
{
  "summary": "<short normalized summary>",
  "suggestedServiceOffer": "<service offer phrasing>",
  "suggestedSkills": ["<skill>"],
  "suggestedIdealCustomer": "<buyer or customer description>",
  "suggestedProfile": {
    "serviceOffer": "<service offer phrasing>",
    "skills": ["<skill>"],
    "idealCustomer": "<buyer or customer description>",
    "industries": ["<industry>"],
    "problemsSolved": ["<problem>"],
    "outcomes": ["<outcome>"],
    "geographicFocus": "<geographic focus>",
    "salesApproach": "<sales approach>",
    "outreachMethod": ["<outreach method>"]
  },
  "evidenceByField": {
    "serviceOffer": ["<supporting snippet>"]
  }
}`,
      `Analyze this self-description and infer a concise service offer, skills, and likely buyer.\n\n${text}`
    );

    return {
      summary: parsed.summary || text.trim(),
      suggestedServiceOffer: parsed.suggestedServiceOffer || '',
      suggestedSkills: Array.isArray(parsed.suggestedSkills)
        ? parsed.suggestedSkills.filter(Boolean)
        : [],
      suggestedIdealCustomer: parsed.suggestedIdealCustomer || undefined,
      suggestedProfile: parsed.suggestedProfile || {},
      evidenceByField: parsed.evidenceByField || {},
    };
  }

  async parseResumeText(text: string): Promise<ResumeParseResult> {
    const parsed = await this.invokeJson<ResumeParseResult>(
      `You extract structured onboarding data from a resume.

Respond with only valid JSON using this exact shape:
{
  "summary": "<2 sentence summary>",
  "skills": ["<skill>"],
  "experience": ["<experience highlight>"],
  "certifications": ["<certification>"],
  "suggestedProfile": {
    "yearsExperience": "<years>",
    "skills": ["<skill>"],
    "certifications": ["<certification>"],
    "idealCustomer": "<buyer or customer description>",
    "companySizeTarget": ["<size bucket>"],
    "industries": ["<industry>"],
    "problemsSolved": ["<problem>"],
    "outcomes": ["<outcome>"],
    "geographicFocus": "<geo>",
    "salesApproach": "<sales approach>",
    "outreachMethod": ["<method>"],
    "communicationStyle": "<style>"
  },
  "roleSummaries": [
    {
      "title": "<title>",
      "company": "<company>",
      "skills": ["<skill>"],
      "industries": ["<industry>"],
      "highlights": ["<highlight>"],
      "outcomes": ["<outcome>"]
    }
  ],
  "evidenceByField": {
    "idealCustomer": ["<supporting snippet>"]
  }
}`,
      `Extract the key onboarding fields from this resume text.\n\n${text}`
    );

    return {
      summary: parsed.summary || '',
      skills: Array.isArray(parsed.skills) ? parsed.skills.filter(Boolean) : [],
      experience: Array.isArray(parsed.experience)
        ? parsed.experience.filter(Boolean)
        : [],
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications.filter(Boolean)
        : [],
      suggestedProfile: parsed.suggestedProfile || {},
      roleSummaries: Array.isArray(parsed.roleSummaries)
        ? parsed.roleSummaries.filter(Boolean)
        : [],
      evidenceByField: parsed.evidenceByField || {},
    };
  }

  /**
   * Produces the next interview question from the user's actual profile and
   * what they have already said.
   *
   * This replaces a hardcoded four-prompt array that was indexed by turn count,
   * which meant every user was asked the same four questions in the same order
   * no matter what they answered.
   */
  async generateNextDiscQuestion(
    profile: Partial<UserOnboardingProfile> | undefined,
    transcript: DiscInterviewTurn[],
    coveredDimensions: DiscDimension[],
    previouslyAskedQuestions: string[] = []
  ): Promise<DiscQuestionSuggestion> {
    const remaining = DISC_DIMENSIONS.filter(
      (dimension) => !coveredDimensions.includes(dimension)
    );

    const parsed = await this.invokeJson<DiscQuestionSuggestion>(
      `You are conducting a short behavioural interview to place someone on the DISC model.

DISC quadrants:
- D (Dominance): pace, control, decisiveness, appetite for confrontation
- I (Influence): persuasion, enthusiasm, relationship building
- S (Steadiness): consistency, patience, support, reaction to change
- C (Conscientiousness): precision, process, analysis, standards

Write ONE open question that draws out concrete behaviour — ask about a specific
past situation, never for self-description or self-rating. Ground it in the
person's own work and words so it could not have been asked of anyone else.
Never repeat a question already asked. Keep it under 40 words.

Set sufficientSignal to true only when the answers so far already reveal a clear
behavioural pattern across all four quadrants.`,
      `Their professional profile:
${this.describeProfileForInterview(profile)}

Interview so far:
${this.formatTranscript(transcript) || '(nothing asked yet)'}
${
  previouslyAskedQuestions.length
    ? `\nThis person completed onboarding before and was already asked the following. Do not ask any of these again, and do not paraphrase them:\n${previouslyAskedQuestions
        .map((question) => `- ${question}`)
        .join('\n')}\n`
    : ''
}
Quadrants not yet probed: ${remaining.length ? remaining.join(', ') : 'none'}
Prefer a question targeting one of those.`,
      DISC_QUESTION_SCHEMA
    );

    const targetDimension = DISC_DIMENSIONS.includes(
      parsed.targetDimension as DiscDimension
    )
      ? (parsed.targetDimension as DiscDimension)
      : remaining[0] || 'D';

    return {
      question: (parsed.question || '').trim(),
      targetDimension,
      sufficientSignal: Boolean(parsed.sufficientSignal),
    };
  }

  private describeProfileForInterview(
    profile: Partial<UserOnboardingProfile> | undefined
  ): string {
    if (!profile) {
      return '(no profile captured)';
    }

    const lines = [
      ['Sells', profile.serviceOffer],
      ['Experience', profile.yearsExperience],
      ['Skills', (profile.skills || []).join(', ')],
      ['Ideal customer', profile.idealCustomer],
      ['Industries', (profile.industries || []).join(', ')],
      ['Problems solved', (profile.problemsSolved || []).join(', ')],
      ['Sales approach', profile.salesApproach],
      ['Communication style', profile.communicationStyle],
      ['Intro summary', profile.madLibSummary],
    ]
      .filter(([, value]) => value && String(value).trim())
      .map(([label, value]) => `${label}: ${value}`);

    return lines.length ? lines.join('\n') : '(no profile captured)';
  }

  private formatTranscript(transcript: DiscInterviewTurn[]): string {
    return transcript
      .map(
        (turn) =>
          `${turn.role === 'assistant' ? 'INTERVIEWER' : 'THEM'}: ${turn.text}`
      )
      .join('\n');
  }

  async assessDiscInterview(
    transcript: DiscInterviewTurn[]
  ): Promise<DiscAssessment> {
    const transcriptText = transcript
      .map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`)
      .join('\n');

    const parsed = await this.invokeJson<DiscAssessment>(
      `You score a DISC personality interview.

Respond with only valid JSON using this exact shape:
{
  "dScore": <0-100>,
  "iScore": <0-100>,
  "sScore": <0-100>,
  "cScore": <0-100>,
  "primaryType": "<D|I|S|C>",
  "secondaryType": "<D|I|S|C>",
  "summary": "<short explanation>",
  "confidence": <0-100>
}`,
      `Assess this DISC interview transcript and return balanced DISC scores.\n\n${transcriptText}`,
      DISC_ASSESSMENT_SCHEMA
    );

    return {
      dScore: this.normalizeScore(parsed.dScore),
      iScore: this.normalizeScore(parsed.iScore),
      sScore: this.normalizeScore(parsed.sScore),
      cScore: this.normalizeScore(parsed.cScore),
      primaryType: parsed.primaryType || 'C',
      secondaryType: parsed.secondaryType || undefined,
      summary:
        parsed.summary ||
        'DISC assessment completed from interview transcript.',
      confidence: this.normalizeScore(parsed.confidence),
    };
  }

  private buildSystemPrompt(): string {
    return `You are a lead generation strategist. Analyze the user's onboarding profile and generate targeted topic suggestions for lead discovery.

You MUST respond with ONLY a valid JSON object. No markdown, no explanation, no code fences. Just the raw JSON.

The JSON must have this exact structure:
{
  "personalityArchetype": "<one of: Technical Expert, Relationship Builder, Strategic Analyst, Creative Innovator, Process Optimizer>",
  "topics": [
    {
      "name": "<short descriptive name>",
      "description": "<1-2 sentence description of what this topic targets>",
      "keywords": ["<relevant search keywords>"],
      "excludedTerms": ["<terms to exclude from search>"],
      "discoveryIntent": "<one of: job-openings, service-buyers>",
      "sources": ["<subset of: remoteok, himalayas, weworkremotely, jobicy, arbeitnow, remotive, themuse, hackernews, funding-news, google-maps>"],
      "priority": <number 1-10, lower is higher priority>,
      "targetCompanies": ["<target company descriptions>"],
      "buyerPersona": "<description of ideal buyer>",
      "painPoints": ["<problems this topic addresses>"],
      "valueProposition": "<value offered to leads in this topic>",
      "searchStrategy": "<one of: aggressive, balanced, conservative>",
      "confidence": <number 0-100>
    }
  ]
}

Rules:
- Generate 6-10 topics total
- At least 1 topic must target job-openings, at least 1 must target service-buyers
- Each topic must use ONLY sources from the allowed list
- Keywords should be specific and actionable
- Priority 1 = highest priority
- Confidence reflects how well the profile data supports this topic
- Map the user's DISC type to the personality archetype:
  - Dominance/D → Technical Expert
  - Influence/I → Relationship Builder
  - Steadiness/S → Process Optimizer
  - Conscientiousness/C → Strategic Analyst
  - Unknown/empty → Creative Innovator`;
  }

  private buildUserPrompt(profile: UserOnboardingProfile): string {
    const combinedSkills = Array.from(
      new Set([
        ...(profile.skills || []),
        ...(profile.resumeDerivedSkills || []),
      ])
    );

    return `Analyze this onboarding profile and generate topic suggestions:

Mad Lib Summary: ${profile.madLibSummary || 'Not specified'}
Service Offer: ${profile.serviceOffer || 'Not specified'}
Years Experience: ${profile.yearsExperience || 'Not specified'}
Skills: ${combinedSkills.join(', ') || 'None listed'}
Certifications: ${(profile.certifications || []).join(', ') || 'None listed'}
Resume Summary: ${profile.resumeParseSummary || 'Not specified'}
Resume Experience Highlights: ${
      (profile.resumeDerivedExperience || []).join(', ') || 'None listed'
    }

Ideal Customer: ${profile.idealCustomer || 'Not specified'}
Target Company Sizes: ${(profile.companySizeTarget || []).join(', ') || 'Any'}
Industries: ${(profile.industries || []).join(', ') || 'Any'}
Problems Solved: ${(profile.problemsSolved || []).join(', ') || 'Not specified'}
Desired Outcomes: ${(profile.outcomes || []).join(', ') || 'Not specified'}
Budget Range: ${(profile.budgetRange || []).join(', ') || 'Not specified'}
Geographic Focus: ${profile.geographicFocus || 'Global'}

Sales Approach: ${profile.salesApproach || 'Not specified'}
Outreach Methods: ${
      (profile.outreachMethod || []).join(', ') || 'Not specified'
    }
Communication Style: ${profile.communicationStyle || 'Not specified'}
DISC Type: ${profile.discType || 'Not specified'}
DISC Assessment Summary: ${profile.discAssessment?.summary || 'Not specified'}

Lead Signal Types: ${
      (profile.leadSignalTypes || []).join(', ') || 'Not specified'
    }
Excluded Companies: ${(profile.excludedCompanies || []).join(', ') || 'None'}
Excluded Industries: ${
      (profile.excludedIndustries || []).join(', ') || 'None'
    }`;
  }

  private parseLlmResponse(raw: string): OnboardingAnalysisOutput {
    try {
      const parsed = this.parseJsonObject<OnboardingAnalysisOutput>(raw);
      if (!parsed.topics || !Array.isArray(parsed.topics)) {
        throw new Error('LLM response missing topics array');
      }
      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse LLM JSON response', error);
      throw new Error(`Invalid JSON from LLM: ${(error as Error).message}`);
    }
  }

  private mapToGeneratedTopics(
    llmTopics: LlmTopicOutput[],
    profile: UserOnboardingProfile
  ): GeneratedTopicSuggestion[] {
    const excludedTerms = this.normalizeExcludedTerms(profile);

    return llmTopics
      .map((t) => this.normalizeTopic(t, excludedTerms, profile))
      .filter((t): t is GeneratedTopicSuggestion => t !== null);
  }

  private normalizeTopic(
    topic: LlmTopicOutput,
    profileExcludedTerms: string[],
    profile: UserOnboardingProfile
  ): GeneratedTopicSuggestion | null {
    if (!topic.name || !topic.description) {
      this.logger.warn('Skipping LLM topic with missing name or description');
      return null;
    }

    const sources = (topic.sources || [])
      .map((s) => s.toLowerCase().trim())
      .filter((s) => VALID_SOURCES.has(s)) as LeadDiscoverySource[];

    if (sources.length === 0) {
      this.logger.warn(
        `Skipping topic "${topic.name}" - no valid sources after normalization`
      );
      return null;
    }

    const discoveryIntent = VALID_INTENTS.has(topic.discoveryIntent)
      ? (topic.discoveryIntent as LeadTopicDiscoveryIntent)
      : LeadTopicDiscoveryIntent.SERVICE_BUYERS;

    const searchStrategy = VALID_STRATEGIES.has(topic.searchStrategy)
      ? (topic.searchStrategy as 'aggressive' | 'balanced' | 'conservative')
      : 'balanced';

    const mergedExcluded = [
      ...new Set([
        ...(topic.excludedTerms || []).map((t) => t.toLowerCase().trim()),
        ...profileExcludedTerms,
      ]),
    ];

    return {
      name: topic.name,
      description: topic.description,
      keywords: Array.from(
        new Set((topic.keywords || []).filter((k) => k && k.trim()))
      ),
      excludedTerms: mergedExcluded,
      discoveryIntent,
      sources,
      googleMapsCities: sources.includes(LeadDiscoverySource.GOOGLE_MAPS)
        ? [profile.localSearchLocation || profile.geographicFocus]
        : undefined,
      googleMapsTypes: sources.includes(LeadDiscoverySource.GOOGLE_MAPS)
        ? this.deriveGoogleMapsBusinessTypes(profile)
        : undefined,
      priority: typeof topic.priority === 'number' ? topic.priority : 5,
      targetCompanies: topic.targetCompanies || [],
      buyerPersona: topic.buyerPersona || '',
      painPoints: topic.painPoints || [],
      valueProposition: topic.valueProposition || '',
      searchStrategy,
      confidence: Math.min(
        Math.max(
          typeof topic.confidence === 'number' ? topic.confidence : 50,
          0
        ),
        100
      ),
      googleMapsLocation: sources.includes(LeadDiscoverySource.GOOGLE_MAPS)
        ? profile.localSearchLocation || profile.geographicFocus || undefined
        : undefined,
      googleMapsRadiusMiles: sources.includes(LeadDiscoverySource.GOOGLE_MAPS)
        ? profile.localSearchRadiusMiles || 25
        : undefined,
    };
  }

  private normalizeExcludedTerms(profile: UserOnboardingProfile): string[] {
    const terms: string[] = profile.excludedCompanies || [];
    terms.push(...(profile.excludedIndustries || []));
    return terms.map((t) => t.toLowerCase().trim());
  }

  private deriveGoogleMapsBusinessTypes(
    profile: UserOnboardingProfile
  ): string[] {
    const candidates = [
      ...(profile.industries || []).map((industry) => `${industry} business`),
    ]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return Array.from(new Set(candidates)).slice(0, 4).length
      ? Array.from(new Set(candidates)).slice(0, 4)
      : ['business'];
  }

  /**
   * Public, schema-constrained JSON generation for callers outside onboarding
   * (the application generator uses it). Decoding is constrained to the schema,
   * so malformed JSON is structurally impossible.
   */
  /**
   * Applies the configured model timeout, or none at all.
   *
   * `ollama.timeoutMs` at or below zero disables it. This exists separately
   * from the gateway's own timeout, and having only lowered that one still left
   * topic analysis dying here at exactly 120s on local hardware — a second
   * ceiling nobody thinks to look for.
   */
  private async raceWithTimeout<T>(work: Promise<T>): Promise<T> {
    const timeoutMs = this.config.get<number>('ollama.timeoutMs') ?? 120000;
    if (!timeoutMs || timeoutMs <= 0) {
      return work;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('LLM request timed out')),
            timeoutMs
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  async generateJson<T>(
    systemPrompt: string,
    userPrompt: string,
    schema?: Record<string, unknown>
  ): Promise<T> {
    return this.invokeJson<T>(systemPrompt, userPrompt, schema);
  }

  private async invokeJson<T>(
    systemPrompt: string,
    userPrompt: string,
    schema?: Record<string, unknown>
  ): Promise<T> {
    if (!this.llm) {
      throw new Error('LLM model not available');
    }

    const response = await this.raceWithTimeout(
      this.llm.invoke(
        [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)],
        // Schema-constrained decoding when a schema is supplied; the brace
        // scraping in parseJsonObject stays as the path for callers without one.
        schema ? { format: schema } : undefined
      )
    );

    const responseText =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    return this.parseJsonObject<T>(responseText);
  }

  private parseJsonObject<T>(raw: string): T {
    let text = raw.trim();

    if (text.startsWith('```')) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) {
        text = text.substring(firstNewline + 1);
      }
      const lastFence = text.lastIndexOf('```');
      if (lastFence !== -1) {
        text = text.substring(0, lastFence);
      }
      text = text.trim();
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('No valid JSON object found in LLM response');
    }

    return JSON.parse(text.substring(firstBrace, lastBrace + 1)) as T;
  }

  private normalizeScore(value: number | undefined): number {
    return Math.max(0, Math.min(100, typeof value === 'number' ? value : 50));
  }
}
