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

  it('strips non-printing characters out of binary-looking resume uploads', async () => {
    const noisyBinary = Buffer.from(
      'Principal Consultant\x00\x01\x02 Northstar Digital\u200BSavannah, GA\x7F\x1FReact TypeScript',
      'binary'
    );

    const result = await service.parseResume({
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      contentBase64: noisyBinary.toString('base64'),
    });

    expect(result.summary).toContain('Principal Consultant');
    expect(result.summary).toContain('Northstar Digital');
    // eslint-disable-next-line no-control-regex
    expect(result.summary).not.toMatch(/[\x00-\x1F\x7F]/);
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
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('stub').toString('base64'),
    });

    expect(result.summary).toBe('Principal Consultant');
    expect(result.roleSummaries[0].company).toBe('Northstar Digital');
    expect(result.evidenceByField?.idealCustomer?.[0]).toBe(
      'VP Engineering and Product leaders'
    );
    expect(hasInvisibleCharacters(JSON.stringify(result))).toBe(false);
  });

  it('returns the next DISC question until enough transcript exists', async () => {
    const result = await service.advanceDiscInterview({
      transcript: [{ role: 'user', text: 'I like making fast decisions.' }],
    });

    expect(result.complete).toBe(false);
    expect(result.nextQuestion).toContain('teammate misses a deadline');
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
