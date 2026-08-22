import { RpcException } from '@nestjs/microservices';
import { OnboardingAnalysisService } from './onboarding-analysis.service';
import { LlmOnboardingAnalysisService } from './llm-onboarding-analysis.service';

function hasInvisibleCharacters(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    const isAsciiControl = (code >= 0x00 && code <= 0x1f) || code === 0x7f;
    const isFormattingControl =
      (code >= 0x200b && code <= 0x200f) || code === 0x2060 || code === 0xfeff;

    return isAsciiControl || isFormattingControl;
  });
}

describe('OnboardingAnalysisService', () => {
  let service: OnboardingAnalysisService;
  let llmAnalysisService: jest.Mocked<LlmOnboardingAnalysisService>;

  beforeEach(() => {
    llmAnalysisService = {
      isAvailable: false,
      analyzeProfile: jest.fn(),
      analyzeMadLib: jest.fn(),
      parseResumeText: jest.fn(),
      assessDiscInterview: jest.fn(),
      generateNextDiscQuestion: jest.fn(),
    } as unknown as jest.Mocked<LlmOnboardingAnalysisService>;

    service = new OnboardingAnalysisService(llmAnalysisService);
  });

  it('supplements sparse llm topic output with deterministic suggestions', async () => {
    Object.defineProperty(llmAnalysisService, 'isAvailable', {
      configurable: true,
      value: true,
    });
    llmAnalysisService.analyzeProfile.mockResolvedValue({
      archetype: 'Technical Expert',
      topics: [
        {
          name: 'React modernization roles',
          description: 'React roles',
          keywords: ['React'],
          excludedTerms: [],
          discoveryIntent: 'job-openings' as any,
          sources: ['remoteok'] as any,
          priority: 1,
          targetCompanies: [],
          buyerPersona: '',
          painPoints: [],
          valueProposition: 'React help',
          searchStrategy: 'balanced',
          confidence: 85,
        },
        {
          name: 'Healthcare modernization buyers',
          description: 'Healthcare buyers',
          keywords: ['Healthcare'],
          excludedTerms: [],
          discoveryIntent: 'service-buyers' as any,
          sources: ['clutch'] as any,
          priority: 2,
          targetCompanies: [],
          buyerPersona: 'VP Engineering',
          painPoints: ['legacy frontend'],
          valueProposition: 'Modernize delivery',
          searchStrategy: 'balanced',
          confidence: 82,
        },
        {
          name: 'Fintech modernization buyers',
          description: 'Fintech buyers',
          keywords: ['Fintech'],
          excludedTerms: [],
          discoveryIntent: 'service-buyers' as any,
          sources: ['clutch'] as any,
          priority: 3,
          targetCompanies: [],
          buyerPersona: 'CTO',
          painPoints: ['slow delivery'],
          valueProposition: 'Faster releases',
          searchStrategy: 'balanced',
          confidence: 80,
        },
      ],
    });

    const topics = await service.analyzeProfile({
      serviceOffer: 'Product engineering modernization consulting',
      yearsExperience: '10+ years',
      skills: ['React', 'TypeScript', 'Analytics'],
      certifications: [],
      idealCustomer: 'VP Engineering',
      companySizeTarget: ['51-200'],
      industries: ['Healthcare', 'Fintech'],
      problemsSolved: ['legacy frontend', 'slow delivery'],
      outcomes: ['faster releases', 'better reporting visibility'],
      budgetRange: ['$25k-$100k'],
      geographicFocus: 'North America',
      salesApproach: 'Hybrid',
      outreachMethod: ['Email'],
      communicationStyle: 'Direct',
      leadSignalTypes: ['Company growth'],
      excludedCompanies: [],
      excludedIndustries: [],
      currentStep: 0,
    } as any);

    expect(topics.length).toBeGreaterThan(3);
    expect(topics.some((topic) => topic.name.includes('Analytics'))).toBe(true);
  });

  it('derives a service offer and skills from a mad-lib without the LLM', async () => {
    const result = await service.analyzeMadLib(
      'I help SaaS product teams modernize React applications, improve release velocity, and win enterprise buyers through consultative outbound outreach in North America.'
    );

    expect(result.summary).toContain('React');
    expect(result.suggestedServiceOffer).toContain('React');
    expect(result.suggestedSkills).toEqual(
      expect.arrayContaining(['React', 'SaaS'])
    );
    expect(result.suggestedProfile).toEqual(
      expect.objectContaining({
        serviceOffer: expect.stringContaining('React'),
        idealCustomer: expect.stringContaining('SaaS'),
        industries: expect.arrayContaining(['SaaS']),
        outcomes: expect.arrayContaining(['improve release velocity']),
        outreachMethod: expect.arrayContaining(['Email']),
        salesApproach: 'Consultative',
        geographicFocus: 'North America',
      })
    );
    expect(result.evidenceByField?.serviceOffer?.[0]).toContain('React');
  });

  it('extracts explicit onboarding suggestions from resume roles and achievements', async () => {
    const text = [
      'Principal Consultant | Northstar Digital',
      'Led React and TypeScript modernization programs for B2B SaaS and healthcare clients.',
      'Reduced release cycles by 40% and improved conversion rates for product teams.',
      'Worked with VP Engineering, CTO, and Product leaders at 50-500 employee companies.',
      'Drove consultative sales through email outreach, LinkedIn, and referrals across North America.',
      'Senior Frontend Engineer | Atlas Health',
      'Built analytics dashboards with React, TypeScript, Node, and Azure.',
      'Partnered with clinical operations and revenue teams to improve onboarding and reporting.',
      'AWS Certified Solutions Architect',
    ].join('\n');

    const result = await service.parseResume({
      filename: 'resume.txt',
      mimeType: 'text/plain',
      contentBase64: Buffer.from(text, 'utf8').toString('base64'),
    });

    expect(result.summary).toContain('Principal Consultant');
    expect(result.skills).toEqual(
      expect.arrayContaining(['React', 'TypeScript'])
    );
    expect(result.certifications).toEqual(
      expect.arrayContaining(['AWS Certified Solutions Architect'])
    );
    expect(result.roleSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining('Principal Consultant'),
          skills: expect.arrayContaining(['React', 'TypeScript']),
          industries: expect.arrayContaining(['SaaS', 'Healthcare']),
        }),
      ])
    );
    expect(result.suggestedProfile).toEqual(
      expect.objectContaining({
        yearsExperience: '10+ years',
        idealCustomer: expect.stringContaining('VP Engineering'),
        companySizeTarget: expect.arrayContaining(['51-200', '201-500']),
        industries: expect.arrayContaining(['SaaS', 'Healthcare']),
        outcomes: expect.arrayContaining(['Reduced release cycles by 40%']),
        outreachMethod: expect.arrayContaining([
          'Email',
          'LinkedIn',
          'Referrals',
        ]),
        geographicFocus: 'North America',
      })
    );
    expect(result.evidenceByField?.idealCustomer?.[0]).toContain(
      'VP Engineering'
    );
  });

  it('prefills the title without the name attached to it', async () => {
    // Resume headings read "Jane Rivera - Senior Platform Engineer". The whole
    // line is fine as a heading but wrong for an intro that reads "I am a ...".
    const text = [
      'Jane Rivera - Senior Platform Engineer',
      'Acme Robotics, 2019-2024',
      'Led migration of billing to Kubernetes, cutting deploy time 40%.',
      'Skills: TypeScript, PostgreSQL, Terraform, AWS',
    ].join('\n');

    const result = await service.parseResume({
      filename: 'resume.txt',
      mimeType: 'text/plain',
      contentBase64: Buffer.from(text, 'utf8').toString('base64'),
    });

    expect(result.suggestedProfile.professionalTitle).toBe(
      'Senior Platform Engineer'
    );
  });

  it('does not classify a skills line as a certification', async () => {
    // "aws" alone used to match, so the skills line was reported as a credential.
    const text = [
      'Dana Okafor - Staff Engineer',
      'Skills: TypeScript, PostgreSQL, Terraform, AWS',
      'Built deployment tooling used by four teams.',
    ].join('\n');

    const result = await service.parseResume({
      filename: 'resume.txt',
      mimeType: 'text/plain',
      contentBase64: Buffer.from(text, 'utf8').toString('base64'),
    });

    expect(result.certifications).toEqual([]);
  });

  it('survives a model returning evidence as a string instead of a list', async () => {
    // Observed in production against granite: the same prompt returns
    // {"idealCustomer": ["..."]} on most runs and {"idealCustomer": "..."} on
    // others, and the string form threw `values.map is not a function` out of
    // sanitizeStringArray, taking down the whole mad-lib step. Model output is
    // an expectation, not a guarantee, so a wrong shape is coerced.
    Object.defineProperty(llmAnalysisService, 'isAvailable', {
      configurable: true,
      value: true,
    });
    llmAnalysisService.analyzeMadLib.mockResolvedValue({
      summary: 'I help SaaS teams modernize React frontends.',
      suggestedServiceOffer: 'React modernization',
      suggestedSkills: 'React, TypeScript',
      suggestedProfile: { idealCustomer: 'VP Engineering' },
      evidenceByField: {
        idealCustomer: 'VP Engineering at mid-size SaaS',
        skills: ['React'],
      },
    } as never);

    const result = await service.analyzeMadLib({
      text: 'I help SaaS teams modernize React frontends.',
    });

    // The stray string becomes a single-entry list rather than an exception.
    expect(result.evidenceByField?.idealCustomer).toEqual([
      'VP Engineering at mid-size SaaS',
    ]);
    expect(result.evidenceByField?.skills).toEqual(['React']);
    expect(result.suggestedSkills).toEqual(['React, TypeScript']);
  });

  it('analyzes a profile whose budgetRange is a bare string', async () => {
    // The wizard's single-select wrote a string into a string[] field, and both
    // the LLM path and the deterministic fallback called array methods on it,
    // so the whole final step 500'd with "unable to analyze your profile".
    const profile = {
      serviceOffer: 'React modernization',
      yearsExperience: '10+ years',
      skills: ['React'],
      certifications: [],
      idealCustomer: 'VP Engineering',
      companySizeTarget: ['51-200'],
      industries: ['SaaS'],
      problemsSolved: ['slow releases'],
      outcomes: ['faster releases'],
      budgetRange: '$25k-$100k',
      geographicFocus: 'North America',
      salesApproach: 'Consultative',
      outreachMethod: ['Email'],
      communicationStyle: 'Direct',
      leadSignalTypes: ['Company growth'],
      excludedCompanies: [],
      excludedIndustries: [],
      currentStep: 0,
    } as never;

    const topics = await service.analyzeProfile(profile);

    expect(topics.length).toBeGreaterThan(0);
  });

  it('refuses an upload whose bytes are not a document it can read', async () => {
    // This used to be accepted: the old extractor scraped printable runs out of
    // arbitrary bytes, which is exactly how PDF scaffolding ended up being
    // treated as the candidate's own words. Refusing is the point now.
    const noisyBinary = Buffer.from(
      'Principal Consultant\x00\x01\x02 Northstar Digital\u200BSavannah, GA\x7F\x1FReact TypeScript',
      'binary'
    );

    const refusal = await service
      .parseResume({
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        contentBase64: noisyBinary.toString('base64'),
      })
      .then(
        () => null,
        (error: RpcException) => error
      );

    // The payload has to survive the microservice transport, so it is asserted
    // through getError() rather than as an HTTP exception body.
    expect(refusal).toBeInstanceOf(RpcException);
    expect(refusal?.getError()).toMatchObject({
      statusCode: 400,
      reason: 'unsupported-format',
    });
  });

  it('strips non-printing characters out of readable resume text', async () => {
    const noisyText = Buffer.from(
      'Principal Consultant\u200B at Northstar Digital\n' +
        'Savannah, GA \u00A0 React, TypeScript, PostgreSQL\n' +
        'Led platform work across three product teams.',
      'utf8'
    );

    const result = await service.parseResume({
      filename: 'resume.txt',
      mimeType: 'text/plain',
      contentBase64: noisyText.toString('base64'),
    });

    expect(result.summary).toContain('Principal Consultant');
    expect(result.summary).toContain('Northstar Digital');
    // eslint-disable-next-line no-control-regex
    expect(result.summary).not.toMatch(/[\x00-\x1F\x7F]/);
    expect(result.summary).not.toContain('\u200B');
  });

  it('sanitizes llm resume evidence and summaries before returning them', async () => {
    Object.defineProperty(llmAnalysisService, 'isAvailable', {
      configurable: true,
      value: true,
    });
    llmAnalysisService.parseResumeText.mockResolvedValue({
      summary: 'Principal\u200B Consultant\x00',
      skills: ['React\u200B'],
      experience: ['Reduced release cycles\x00 by 40%'],
      certifications: ['AWS Certified\u200B'],
      suggestedProfile: {
        idealCustomer: 'VP Engineering\u200B',
      },
      roleSummaries: [
        {
          title: 'Principal\u200B Consultant',
          company: 'Northstar\x00 Digital',
          skills: ['React\u200B'],
          industries: ['SaaS\u200B'],
          highlights: ['Reduced\x00 release cycles'],
          outcomes: ['Faster\u200B releases'],
        },
      ],
      evidenceByField: {
        idealCustomer: ['VP Engineering\u200B and Product leaders\x00'],
      },
    } as any);

    const result = await service.parseResume({
      filename: 'resume.txt',
      mimeType: 'text/plain',
      // The subject here is sanitising what the model returns, but extraction
      // still has to succeed first, so this is a readable resume rather than a
      // four-byte stub.
      contentBase64: Buffer.from(
        'Principal Consultant at Northstar Digital, Savannah GA. React and TypeScript.',
        'utf8'
      ).toString('base64'),
    });

    expect(result.summary).toBe('Principal Consultant');
    expect(result.roleSummaries[0].company).toBe('Northstar Digital');
    expect(result.evidenceByField?.idealCustomer?.[0]).toBe(
      'VP Engineering and Product leaders'
    );
    expect(hasInvisibleCharacters(JSON.stringify(result))).toBe(false);
  });

  it('takes composer slot values as fact rather than re-inferring them', async () => {
    const result = await service.analyzeMadLib({
      text: 'I help plant managers in Manufacturing solve line downtime by delivering automation retrofits.',
      composition: {
        sentence: 'ignored',
        values: {
          idealCustomer: 'Plant managers',
          industries: ['Manufacturing'],
          problemsSolved: ['line downtime'],
          serviceOffer: 'automation retrofits',
          skills: ['PLC', 'Robotics'],
        },
        unfilledFields: [],
      },
    });

    // The heuristic extractor would have guessed "Manufacturing" as a skill and
    // produced its own serviceOffer phrasing; the explicit slots win.
    expect(result.suggestedProfile.serviceOffer).toBe('automation retrofits');
    expect(result.suggestedProfile.idealCustomer).toBe('Plant managers');
    expect(result.suggestedProfile.skills).toEqual(['PLC', 'Robotics']);
    expect(result.suggestedProfile.problemsSolved).toEqual(['line downtime']);
    expect(result.suggestedServiceOffer).toBe('automation retrofits');
  });

  it('still infers the fields a composer slot was left blank', async () => {
    const result = await service.analyzeMadLib({
      text: 'I am a consultant who helps SaaS teams modernize React frontends using TypeScript.',
      composition: {
        sentence: 'ignored',
        values: { idealCustomer: 'VP Engineering' },
        unfilledFields: ['skills', 'industries'],
      },
    });

    expect(result.suggestedProfile.idealCustomer).toBe('VP Engineering');
    // Not supplied by the user, so inference still fills it in.
    expect(result.suggestedProfile.skills).toEqual(
      expect.arrayContaining(['React', 'TypeScript'])
    );
  });

  it('ignores empty slots so they cannot wipe out an inferred value', async () => {
    const result = await service.analyzeMadLib({
      text: 'I help SaaS teams modernize React frontends.',
      composition: {
        sentence: 'ignored',
        values: {
          serviceOffer: '   ',
          industries: [],
          idealCustomer: 'SaaS teams',
        },
        unfilledFields: [],
      },
    });

    expect(result.suggestedProfile.idealCustomer).toBe('SaaS teams');
    expect(result.suggestedProfile.serviceOffer).toBeTruthy();
    expect(String(result.suggestedProfile.serviceOffer ?? '').trim()).not.toBe(
      ''
    );
  });

  it('accepts a plain string for the freeform escape hatch', async () => {
    const result = await service.analyzeMadLib(
      'I help SaaS teams modernize React frontends using TypeScript.'
    );

    expect(result.summary).toContain('React');
    expect(result.suggestedSkills.length).toBeGreaterThan(0);
  });

  it('returns the next DISC question until enough transcript exists', async () => {
    const result = await service.advanceDiscInterview({
      transcript: [{ role: 'user', text: 'I like making fast decisions.' }],
    });

    expect(result.complete).toBe(false);
    expect(result.nextQuestion).toBeTruthy();
    // The first quadrant is already probed, so the next question moves on.
    expect(result.nextQuestionDimension).toBe('I');
  });

  it('varies the offline interview by profile instead of replaying one script', async () => {
    const askFor = async (profile: Record<string, unknown>) =>
      (
        await service.advanceDiscInterview({
          transcript: [],
          profile: profile as never,
        })
      ).nextQuestion;

    const questions = await Promise.all(
      [
        { serviceOffer: 'React modernization', industries: ['SaaS'] },
        { serviceOffer: 'Executive coaching', industries: ['Healthcare'] },
        { serviceOffer: 'SEO services', industries: ['Ecommerce'] },
        { serviceOffer: 'Fractional CFO', industries: ['Finance'] },
        { serviceOffer: 'Brand strategy', industries: ['Manufacturing'] },
        { serviceOffer: 'Data platform builds', industries: ['Education'] },
      ].map(askFor)
    );

    expect(questions.every(Boolean)).toBe(true);
    // The old flow handed every user the identical first question. Any spread
    // at all proves the profile is now feeding question selection.
    expect(new Set(questions).size).toBeGreaterThan(1);
  });

  it('asks the model for each question and reports the quadrant it targets', async () => {
    Object.defineProperty(llmAnalysisService, 'isAvailable', {
      get: () => true,
    });
    llmAnalysisService.generateNextDiscQuestion.mockResolvedValue({
      question: 'Tell me about the last time you overruled your own team.',
      targetDimension: 'D',
      sufficientSignal: false,
    });

    const result = await service.advanceDiscInterview({
      transcript: [],
      profile: { serviceOffer: 'React modernization' } as never,
    });

    expect(llmAnalysisService.generateNextDiscQuestion).toHaveBeenCalled();
    expect(result.complete).toBe(false);
    expect(result.nextQuestion).toBe(
      'Tell me about the last time you overruled your own team.'
    );
    expect(result.nextQuestionDimension).toBe('D');
  });

  it('will not finish while a DISC quadrant is still unprobed', async () => {
    Object.defineProperty(llmAnalysisService, 'isAvailable', {
      get: () => true,
    });
    // The model claims it has enough, but only D and I have been answered.
    llmAnalysisService.generateNextDiscQuestion.mockResolvedValue({
      question: 'How do you handle a shifting deadline?',
      targetDimension: 'S',
      sufficientSignal: true,
    });

    const result = await service.advanceDiscInterview({
      transcript: [
        { role: 'assistant', text: 'q1', targetDimension: 'D' },
        { role: 'user', text: 'I decide fast.' },
        { role: 'assistant', text: 'q2', targetDimension: 'I' },
        { role: 'user', text: 'I win people over.' },
      ],
    });

    expect(result.complete).toBe(false);
    expect(result.nextQuestionDimension).toBe('S');
  });

  it('terminates at the turn cap even if the model never reports enough signal', async () => {
    Object.defineProperty(llmAnalysisService, 'isAvailable', {
      get: () => true,
    });
    llmAnalysisService.generateNextDiscQuestion.mockResolvedValue({
      question: 'One more question?',
      targetDimension: 'C',
      sufficientSignal: false,
    });
    llmAnalysisService.assessDiscInterview.mockResolvedValue({
      dScore: 30,
      iScore: 20,
      sScore: 20,
      cScore: 30,
      primaryType: 'C',
      summary: 'Analytical and deliberate.',
      confidence: 80,
    });

    const result = await service.advanceDiscInterview({
      transcript: Array.from({ length: 6 }, () => ({
        role: 'user' as const,
        text: 'I plan carefully and use data to clarify expectations.',
      })),
    });

    expect(result.complete).toBe(true);
    expect(result.assessment).toBeDefined();
  });

  it('tells the model which questions this profile was already asked', async () => {
    Object.defineProperty(llmAnalysisService, 'isAvailable', {
      get: () => true,
    });
    llmAnalysisService.generateNextDiscQuestion.mockResolvedValue({
      question: 'Something new.',
      targetDimension: 'D',
      sufficientSignal: false,
    });

    const previouslyAsked = ['What did you do when the launch slipped?'];
    await service.advanceDiscInterview({ transcript: [] }, previouslyAsked);

    expect(llmAnalysisService.generateNextDiscQuestion).toHaveBeenCalledWith(
      undefined,
      [],
      [],
      previouslyAsked
    );
  });

  it('does not repeat an offline question the profile already answered', async () => {
    const profile = { serviceOffer: 'React modernization' } as never;

    const first = await service.advanceDiscInterview({
      transcript: [],
      profile,
    });

    // Same profile, but now that question is on record from a previous run.
    const second = await service.advanceDiscInterview(
      { transcript: [], profile },
      [first.nextQuestion as string]
    );

    expect(second.nextQuestion).toBeTruthy();
    expect(second.nextQuestion).not.toBe(first.nextQuestion);
    expect(second.nextQuestionDimension).toBe(first.nextQuestionDimension);
  });

  it('still returns a question when a re-run has exhausted the offline bank', async () => {
    const profile = { serviceOffer: 'React modernization' } as never;
    const everyDQuestion = [
      'Tell me about a recent decision you pushed through when other people were hesitating. What did you do?',
      'Describe a time you took over something that was stalling. What was your first move?',
      'When was the last time you overruled a group to keep something moving?',
    ];

    const result = await service.advanceDiscInterview(
      { transcript: [], profile },
      everyDQuestion
    );

    expect(result.complete).toBe(false);
    expect(everyDQuestion).toContain(result.nextQuestion);
  });

  it('falls back to a generated question when the model call fails', async () => {
    Object.defineProperty(llmAnalysisService, 'isAvailable', {
      get: () => true,
    });
    llmAnalysisService.generateNextDiscQuestion.mockRejectedValue(
      new Error('ollama unreachable')
    );

    const result = await service.advanceDiscInterview({
      transcript: [],
      profile: { serviceOffer: 'React modernization' } as never,
    });

    expect(result.complete).toBe(false);
    expect(result.nextQuestion).toBeTruthy();
    expect(result.nextQuestionDimension).toBe('D');
  });

  it('produces a lightweight DISC behavioral profile with quadrant percentages', async () => {
    const result = await service.advanceDiscInterview({
      transcript: [
        {
          role: 'user',
          text: 'I like making fast decisions and leading change.',
        },
        {
          role: 'user',
          text: 'I address missed deadlines directly and push through obstacles.',
        },
        {
          role: 'user',
          text: 'I reduce ambiguity by making a plan, using data, and clarifying expectations.',
        },
        {
          role: 'user',
          text: 'I perform best with autonomy, ownership, and a high bar for quality.',
        },
      ],
    });

    expect(result.complete).toBe(true);
    expect(result.assessment?.primaryType).toBeDefined();
    expect(result.discType).toBe(result.assessment?.primaryType);
    expect(result.assessment?.dScore).toBeGreaterThan(
      result.assessment?.sScore ?? 0
    );
    expect(result.assessment?.summary).toContain('behavioral');
    expect(result.assessment?.summary).toContain('%');
    expect(result.assessment?.confidence).toBeGreaterThanOrEqual(75);
  });

  it('uses resume and DISC context when generating deterministic topics', async () => {
    const topics = await service.analyzeProfile({
      madLibSummary:
        'Product engineering consultant specializing in React modernization.',
      serviceOffer: 'React modernization consulting',
      yearsExperience: '10+ years',
      skills: ['React'],
      certifications: [],
      resumeParseSummary:
        'Senior frontend consultant with TypeScript expertise.',
      resumeDerivedSkills: ['TypeScript'],
      resumeDerivedExperience: [
        '10+ years leading frontend modernization projects',
      ],
      resumeDerivedCertifications: [],
      idealCustomer: 'VP Engineering',
      companySizeTarget: ['51-200'],
      industries: ['SaaS'],
      problemsSolved: ['legacy frontend', 'slow delivery'],
      outcomes: ['faster releases'],
      budgetRange: ['$25k-$100k'],
      geographicFocus: 'Global',
      salesApproach: 'Consultative',
      outreachMethod: ['Email'],
      communicationStyle: 'Direct',
      discType: 'D',
      discAssessment: {
        dScore: 82,
        iScore: 54,
        sScore: 39,
        cScore: 58,
        primaryType: 'D',
        secondaryType: 'C',
        summary: 'Direct and analytical.',
        confidence: 90,
      },
      leadSignalTypes: ['Company growth'],
      excludedCompanies: [],
      excludedIndustries: [],
      currentStep: 0,
    });

    expect(
      topics.some((topic) =>
        ['React modernization consulting', 'React', 'TypeScript'].every(
          (keyword) => topic.keywords.includes(keyword)
        )
      )
    ).toBe(true);
    expect(
      Math.max(...topics.map((topic) => topic.confidence))
    ).toBeGreaterThanOrEqual(70);
  });

  it('generates a broad topic set from the collated onboarding profile', async () => {
    const topics = await service.analyzeProfile({
      madLibSummary:
        'I help SaaS, healthcare, and fintech teams solve modernization, onboarding, analytics, and conversion problems.',
      serviceOffer: 'Product engineering modernization consulting',
      yearsExperience: '10+ years',
      skills: ['React', 'TypeScript', 'Node', 'Azure', 'Analytics'],
      certifications: ['AWS Certified Solutions Architect'],
      resumeParseSummary:
        'Principal consultant for SaaS, healthcare, and fintech product teams.',
      resumeDerivedSkills: ['Next.js', 'Data', 'Product'],
      resumeDerivedExperience: [
        'Reduced release cycles by 40%',
        'Improved onboarding completion',
      ],
      resumeDerivedCertifications: ['PMP'],
      idealCustomer: 'VP Engineering, CTO, and Product leaders',
      companySizeTarget: ['11-50', '51-200', '201-500'],
      industries: ['SaaS', 'Healthcare', 'Fintech'],
      problemsSolved: [
        'legacy frontend',
        'slow delivery',
        'friction in onboarding',
        'limited reporting visibility',
      ],
      outcomes: [
        'faster releases',
        'improved conversion rates',
        'better reporting visibility',
      ],
      budgetRange: ['$25k-$100k'],
      geographicFocus: 'North America',
      localSearchLocation: 'Atlanta, GA',
      localSearchRadiusMiles: 50,
      salesApproach: 'Hybrid',
      outreachMethod: ['Email', 'LinkedIn', 'Referrals'],
      communicationStyle: 'Direct',
      discType: 'D',
      discAssessment: {
        dScore: 82,
        iScore: 61,
        sScore: 43,
        cScore: 57,
        primaryType: 'D',
        secondaryType: 'I',
        summary: 'behavioral profile summary: D 82%, I 61%, S 43%, C 57%',
        confidence: 88,
      },
      leadSignalTypes: [
        'Company growth',
        'Funding rounds',
        'New product launches',
      ],
      excludedCompanies: [],
      excludedIndustries: [],
      currentStep: 0,
    });

    expect(topics.length).toBeGreaterThanOrEqual(7);
    expect(topics.some((topic) => topic.name.includes('Healthcare'))).toBe(
      true
    );
    expect(topics.some((topic) => topic.name.includes('Fintech'))).toBe(true);
    expect(topics.some((topic) => topic.name.includes('React'))).toBe(true);
    expect(topics.some((topic) => topic.name.includes('Analytics'))).toBe(true);
    expect(
      topics
        .filter((topic) => topic.sources.includes('google-maps' as any))
        .every(
          (topic) =>
            topic.googleMapsLocation === 'Atlanta, GA' &&
            topic.googleMapsRadiusMiles === 50
        )
    ).toBe(true);
  });
});
