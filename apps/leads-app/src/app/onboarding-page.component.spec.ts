import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { OnboardingPageComponent } from './onboarding-page.component';
import { LeadsService } from './leads.service';
import { OnboardingGateService } from './onboarding-gate.service';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from './leads.types';

describe('OnboardingPageComponent', () => {
  const leadsServiceStub = {
    analyzeMadLib: jest.fn(),
    parseResume: jest.fn(),
    advanceDiscInterview: jest.fn(),
    analyzeOnboarding: jest.fn(),
    confirmOnboarding: jest.fn(),
  };

  const onboardingGateServiceStub = {
    markComplete: jest.fn(),
  };

  const themeServiceStub = {
    setPersonality: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    leadsServiceStub.analyzeMadLib.mockReturnValue(
      of({
        summary: 'React modernization consultant',
        suggestedServiceOffer: 'React modernization consulting',
        suggestedSkills: ['React'],
        suggestedIdealCustomer: 'VP Engineering',
      })
    );
    leadsServiceStub.parseResume.mockReturnValue(
      of({
        summary: 'Senior frontend consultant',
        skills: ['React', 'TypeScript'],
        experience: ['10+ years building B2B SaaS applications'],
        certifications: ['AWS Certified'],
      })
    );
    leadsServiceStub.advanceDiscInterview.mockReturnValue(
      of({
        complete: false,
        nextQuestion: 'Tell me how you respond to a missed deadline.',
      })
    );
    leadsServiceStub.analyzeOnboarding.mockReturnValue(of({ topics: [] }));

    await TestBed.configureTestingModule({
      imports: [OnboardingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: LeadsService,
          useValue: leadsServiceStub,
        },
        {
          provide: OnboardingGateService,
          useValue: onboardingGateServiceStub,
        },
        {
          provide: ThemeService,
          useValue: themeServiceStub,
        },
      ],
    }).compileComponents();
  });

  it('confirms reviewed topics, clears the onboarding gate, and navigates to topics', () => {
    leadsServiceStub.confirmOnboarding.mockReturnValue(
      of({
        topics: [{ id: 'topic-1' }],
      })
    );

    const fixture = TestBed.createComponent(OnboardingPageComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const profile = {
      serviceOffer: 'React modernization consulting',
      yearsExperience: '10+',
      skills: ['React'],
      certifications: [],
      idealCustomer: 'VP Engineering',
      companySizeTarget: ['50-250'],
      industries: ['SaaS'],
      problemsSolved: ['legacy frontend'],
      outcomes: ['faster releases'],
      budgetRange: ['$25k-$100k'],
      geographicFocus: 'Global',
      salesApproach: 'Consultative',
      outreachMethod: ['Email'],
      communicationStyle: 'Direct',
      leadSignalTypes: ['budget'],
      excludedCompanies: [],
      excludedIndustries: [],
      currentStep: 4,
    };
    component.onAnalyzeTopics(profile as any);

    component.onConfirmTopics([
      {
        name: 'React modernization roles',
        description: 'Remote and hybrid product engineering roles',
        keywords: ['react modernization'],
        excludedTerms: ['wordpress'],
        discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
        sources: [LeadDiscoverySource.REMOTE_OK],
        priority: 1,
        targetCompanies: ['SaaS companies'],
        buyerPersona: '',
        painPoints: ['slow delivery'],
        valueProposition: 'Modernize the stack',
        searchStrategy: 'balanced',
        confidence: 90,
      },
    ]);

    expect(leadsServiceStub.confirmOnboarding).toHaveBeenCalledWith(
      profile,
      expect.any(Array)
    );
    expect(onboardingGateServiceStub.markComplete).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/topics');
  });

  it('keeps the review screen open when topic creation fails', () => {
    leadsServiceStub.confirmOnboarding.mockReturnValue(
      throwError(() => new Error('boom'))
    );

    const fixture = TestBed.createComponent(OnboardingPageComponent);
    const component = fixture.componentInstance;
    component.onAnalyzeTopics({
      serviceOffer: 'React modernization consulting',
      yearsExperience: '10+',
      skills: ['React'],
      certifications: [],
      idealCustomer: 'VP Engineering',
      companySizeTarget: ['50-250'],
      industries: ['SaaS'],
      problemsSolved: ['legacy frontend'],
      outcomes: ['faster releases'],
      budgetRange: ['$25k-$100k'],
      geographicFocus: 'Global',
      salesApproach: 'Consultative',
      outreachMethod: ['Email'],
      communicationStyle: 'Direct',
      leadSignalTypes: ['budget'],
      excludedCompanies: [],
      excludedIndustries: [],
      currentStep: 4,
    } as any);

    component.onConfirmTopics([
      {
        name: 'React modernization roles',
        description: 'Remote and hybrid product engineering roles',
        keywords: ['react modernization'],
        excludedTerms: ['wordpress'],
        discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
        sources: [LeadDiscoverySource.REMOTE_OK],
        priority: 1,
        targetCompanies: ['SaaS companies'],
        buyerPersona: '',
        painPoints: ['slow delivery'],
        valueProposition: 'Modernize the stack',
        searchStrategy: 'balanced',
        confidence: 90,
      },
    ]);

    expect(component.confirmError).toBe('Unable to create your topics right now.');
    expect(component.confirmingTopics).toBe(false);
  });

  it('forwards mad-lib analysis results into the wizard', () => {
    const fixture = TestBed.createComponent(OnboardingPageComponent);
    const component = fixture.componentInstance;
    const wizard = {
      onMadLibAnalyzed: jest.fn(),
      onMadLibFailed: jest.fn(),
    } as any;
    (component as any).wizard = wizard;

    component.onAnalyzeMadLib(
      'I am a consultant who specializes in React modernization.'
    );

    expect(leadsServiceStub.analyzeMadLib).toHaveBeenCalledWith(
      'I am a consultant who specializes in React modernization.'
    );
    expect(wizard.onMadLibAnalyzed).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedServiceOffer: 'React modernization consulting',
      })
    );
  });

  it('forwards resume parsing results into the wizard', () => {
    const fixture = TestBed.createComponent(OnboardingPageComponent);
    const component = fixture.componentInstance;
    const wizard = {
      onResumeParsed: jest.fn(),
      onResumeParseFailed: jest.fn(),
    } as any;
    (component as any).wizard = wizard;
    const file = new File(['resume text'], 'resume.pdf', {
      type: 'application/pdf',
    });

    component.onParseResume(file);

    expect(leadsServiceStub.parseResume).toHaveBeenCalledWith(file);
    expect(wizard.onResumeParsed).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: ['React', 'TypeScript'],
      })
    );
  });

  it('forwards DISC interview responses into the wizard', () => {
    const fixture = TestBed.createComponent(OnboardingPageComponent);
    const component = fixture.componentInstance;
    const wizard = {
      onDiscAdvanced: jest.fn(),
      onDiscAdvanceFailed: jest.fn(),
    } as any;
    (component as any).wizard = wizard;

    component.onAdvanceDiscInterview({
      transcript: [{ role: 'user', text: 'I like driving fast decisions.' }],
    } as any);

    expect(leadsServiceStub.advanceDiscInterview).toHaveBeenCalledWith({
      transcript: [{ role: 'user', text: 'I like driving fast decisions.' }],
    });
    expect(wizard.onDiscAdvanced).toHaveBeenCalledWith(
      expect.objectContaining({
        complete: false,
      })
    );
  });
});
