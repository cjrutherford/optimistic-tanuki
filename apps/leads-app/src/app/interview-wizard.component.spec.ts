import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { InterviewWizardComponent } from './interview-wizard.component';
import { LeadsService } from './leads.service';

describe('InterviewWizardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewWizardComponent],
      providers: [
        {
          provide: LeadsService,
          useValue: {
            searchLocations: jest.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();
  });

  it('enables moving past the skills question when there is pending chip text', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.currentStage = 'profile';
    component.currentQuestionIndex = 2;
    component.newChipValue = 'React';

    expect(component.canGoNext).toBe(true);

    component.nextQuestion();

    expect(component.profile.skills).toEqual(['React']);
    expect(component.currentQuestionIndex).toBe(3);
  });

  it('adds a chip when enter is pressed', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.currentStage = 'profile';
    component.currentQuestionIndex = 2;
    component.newChipValue = 'React';

    const preventDefault = jest.fn();
    component.onChipInputKeydown({
      key: 'Enter',
      preventDefault,
    } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.profile.skills).toEqual(['React']);
    expect(component.newChipValue).toBe('');
  });

  it('adds a chip when comma is pressed', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.currentStage = 'profile';
    component.currentQuestionIndex = 2;
    component.newChipValue = 'React';

    const preventDefault = jest.fn();
    component.onChipInputKeydown({
      key: ',',
      preventDefault,
    } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(component.profile.skills).toEqual(['React']);
    expect(component.newChipValue).toBe('');
  });

  it('never spreads a scalar answer into characters', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    // The resume prefills yearsExperience as "10+". Toggling used to spread it,
    // giving ['1','0','+', ...] — no crash, just silent corruption that reached
    // the analysis prompt and the generated application.
    (component.profile as unknown as Record<string, unknown>)[
      'yearsExperience'
    ] = '10+';

    component.toggleMultiSelect('yearsExperience', '2-5 years');

    expect(component.profile.yearsExperience).toEqual(['10+', '2-5 years']);
  });

  it('asks single-valued questions with a single-select', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const question = fixture.componentInstance.questions.find(
      (q) => q.id === 'yearsExperience'
    );

    expect(question?.type).toBe('single-select');
  });

  it('stores a single-select answer for a list field as a list', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    // budgetRange is asked with a single-select but stored as string[]. Writing
    // the bare string left the backend calling .join and .some on a string,
    // which failed the whole analysis with no fallback.
    component.setProfileValue('budgetRange', '$25k-$100k');

    expect(component.profile.budgetRange).toEqual(['$25k-$100k']);
  });

  it('leaves ordinary single-select answers as scalars', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.setProfileValue('geographicFocus', 'North America');
    component.setProfileValue('localSearchRadiusMiles', '25');

    expect(component.profile.geographicFocus).toBe('North America');
    expect(component.profile.localSearchRadiusMiles).toBe(25);
  });

  it('opens on the resume step so the intro can be prefilled from it', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);

    expect(fixture.componentInstance.currentStage).toBe('resume');
  });

  it('goes from a parsed resume into the intro, not past it', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.onResumeParsed({
      summary: 'Senior Platform Engineer at Acme Robotics.',
      skills: ['TypeScript'],
      experience: [],
      certifications: [],
      suggestedProfile: { professionalTitle: 'Senior Platform Engineer' },
      roleSummaries: [],
    });

    expect(component.currentStage).toBe('mad-lib');
    // ...and the intro is handed what the resume found, so the slots are not
    // blank when the user gets there.
    expect(component.madLibPrefill).toEqual(
      expect.objectContaining({
        professionalTitle: 'Senior Platform Engineer',
        skills: expect.arrayContaining(['TypeScript']),
      })
    );
  });

  it('still reaches the intro when the resume is skipped', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.skipResumeStep();

    expect(component.currentStage).toBe('mad-lib');
  });

  it('omits empty fields from the intro prefill', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    // A blank value would render as an answered slot and hide the placeholder.
    expect(component.madLibPrefill).not.toHaveProperty('idealCustomer');
    expect(component.madLibPrefill).not.toHaveProperty('professionalTitle');
  });

  it('applies mad-lib suggestions and advances to the profile questions', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.onMadLibAnalyzed({
      summary:
        'I am a product engineering consultant who specializes in React modernization.',
      suggestedServiceOffer: 'React modernization consulting',
      suggestedSkills: ['React', 'TypeScript'],
      suggestedIdealCustomer: 'VP Engineering',
      suggestedProfile: {
        industries: ['SaaS'],
        problemsSolved: ['legacy frontend'],
        outcomes: ['faster releases'],
        outreachMethod: ['Email'],
        geographicFocus: 'North America',
        localSearchLocation: 'Atlanta, GA',
        localSearchRadiusMiles: 50,
      },
      evidenceByField: {
        industries: ['SaaS product teams'],
        outcomes: ['faster releases'],
      },
    });

    expect(component.profile.madLibSummary).toContain('React modernization');
    expect(component.profile.serviceOffer).toBe(
      'React modernization consulting'
    );
    expect(component.profile.skills).toEqual(['React', 'TypeScript']);
    expect(component.profile.idealCustomer).toBe('VP Engineering');
    expect(component.profile.industries).toEqual(['SaaS']);
    expect(component.profile.outcomes).toEqual(['faster releases']);
    expect(component.profile.localSearchLocation).toBe('Atlanta, GA');
    expect(component.profile.localSearchRadiusMiles).toBe(50);
    // The resume step now runs first, so the intro leads into the questions.
    expect(component.currentStage).toBe('profile');
  });

  it('merges parsed resume details into the editable onboarding profile', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.profile.skills = ['React'];
    component.profile.certifications = ['AWS Certified'];

    component.onResumeParsed({
      summary: 'Senior frontend consultant with healthcare SaaS experience.',
      skills: ['TypeScript', 'React'],
      experience: ['10+ years leading frontend modernization projects'],
      certifications: ['PMP'],
      suggestedProfile: {
        yearsExperience: '10+ years',
        industries: ['Healthcare', 'SaaS'],
        idealCustomer: 'VP Engineering and Product leaders',
        companySizeTarget: ['51-200'],
        problemsSolved: ['legacy frontend', 'slow delivery'],
        outcomes: ['faster releases'],
        outreachMethod: ['Email', 'LinkedIn'],
      },
      roleSummaries: [
        {
          title: 'Principal Consultant',
          company: 'Northstar Digital',
          skills: ['React', 'TypeScript'],
          industries: ['Healthcare', 'SaaS'],
          highlights: ['Reduced release cycles by 40%'],
          outcomes: ['faster releases'],
        },
      ],
      evidenceByField: {
        idealCustomer: ['VP Engineering and Product leaders'],
        outreachMethod: ['Email outreach, LinkedIn'],
      },
    });

    expect(component.profile.resumeParseSummary).toContain('healthcare SaaS');
    expect(component.profile.resumeDerivedSkills).toEqual([
      'TypeScript',
      'React',
    ]);
    expect(component.profile.resumeDerivedExperience).toEqual([
      '10+ years leading frontend modernization projects',
    ]);
    expect(component.profile.skills).toEqual(['React', 'TypeScript']);
    expect(component.profile.certifications).toEqual(['AWS Certified', 'PMP']);
    expect(component.profile.yearsExperience).toBe('10+ years');
    expect(component.profile.industries).toEqual(['Healthcare', 'SaaS']);
    expect(component.profile.idealCustomer).toContain('VP Engineering');
    expect(component.profile.outreachMethod).toEqual(['Email', 'LinkedIn']);
  });

  it('treats budget range as a multi-select field', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.currentStage = 'profile';
    component.currentQuestionIndex = component.questions.findIndex(
      (question) => question.id === 'budgetRange'
    );

    component.toggleMultiSelect('budgetRange', '$5k-$25k');
    component.toggleMultiSelect('budgetRange', '$25k-$100k');

    expect(component.profile.budgetRange).toEqual(['$5k-$25k', '$25k-$100k']);
    expect(component.canGoNext).toBe(true);
  });

  it('applies a selected Maps suggestion to the onboarding location field', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.currentStage = 'profile';
    component.currentQuestionIndex = component.questions.findIndex(
      (question) => question.id === 'localSearchLocation'
    );
    component.applyLocationSuggestion({
      description: 'Savannah, GA, USA',
      primaryText: 'Savannah',
      secondaryText: 'GA, USA',
      placeId: 'place-1',
    });

    expect(component.profile.localSearchLocation).toBe('Savannah, GA, USA');
    expect(component.locationSuggestions).toEqual([]);
    expect(component.locationInputValue).toBe('');
  });

  it('stores the completed DISC assessment and emits the enriched profile for topic analysis', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;
    const analyzeTopicsSpy = jest.spyOn(component.analyzeTopics, 'emit');

    component.currentStage = 'disc';

    component.onDiscAdvanced({
      complete: true,
      discType: 'D',
      assessment: {
        dScore: 82,
        iScore: 61,
        sScore: 43,
        cScore: 57,
        primaryType: 'D',
        secondaryType: 'I',
        summary:
          'Behavioral profile summary: D 82%, I 61%, S 43%, C 57%. Direct, persuasive, and comfortable leading decisions.',
        confidence: 88,
      },
    });

    expect(component.profile.discType).toBe('D');
    expect(component.profile.discAssessment?.primaryType).toBe('D');
    expect(analyzeTopicsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        discType: 'D',
        discAssessment: expect.objectContaining({
          summary: expect.stringContaining('82%'),
        }),
      })
    );
    expect(component.isAnalyzing).toBe(true);
  });

  it('returns from edit profile back to the generated summary without re-running analysis', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.submittedTopics = [
      {
        name: 'React modernization roles',
        description: 'Remote and hybrid product engineering roles',
        keywords: ['react modernization'],
        excludedTerms: ['wordpress'],
        discoveryIntent: 'job-openings' as any,
        sources: ['remoteok'] as any,
        priority: 1,
        targetCompanies: ['SaaS companies'],
        buyerPersona: '',
        painPoints: ['slow delivery'],
        valueProposition: 'Modernize the stack',
        searchStrategy: 'balanced',
        confidence: 90,
      },
    ];
    component.showTopicReview = true;

    component.backToInterview();

    expect(component.showTopicReview).toBe(false);

    component.returnToReview();

    expect(component.showTopicReview).toBe(true);
    expect(component.submittedTopics).toHaveLength(1);
  });

  it('allows back and next navigation after the interview is complete', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;

    component.currentStage = 'disc';
    component.currentQuestionIndex = component.questions.length - 1;
    component.profile.discAssessment = {
      dScore: 82,
      iScore: 61,
      sScore: 43,
      cScore: 57,
      primaryType: 'D',
      secondaryType: 'I',
      summary: 'Completed DISC summary',
      confidence: 88,
    };
    component.submittedTopics = [
      {
        name: 'React modernization roles',
        description: 'Remote and hybrid product engineering roles',
        keywords: ['react modernization'],
        excludedTerms: ['wordpress'],
        discoveryIntent: 'job-openings' as any,
        sources: ['remoteok'] as any,
        priority: 1,
        targetCompanies: ['SaaS companies'],
        buyerPersona: '',
        painPoints: ['slow delivery'],
        valueProposition: 'Modernize the stack',
        searchStrategy: 'balanced',
        confidence: 90,
      },
    ];

    component.prevQuestion();

    expect(component.currentStage).toBe('profile');
    expect(component.currentQuestionIndex).toBe(component.questions.length - 1);

    component.nextQuestion();

    expect(component.currentStage).toBe('disc');
    expect(component.discTranscript).toEqual([]);
  });

  it('renders summary actions with otui-button elements', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;
    component.showModal = true;
    component.showTopicReview = true;
    component.submittedTopics = [
      {
        name: 'React modernization roles',
        description: 'Remote and hybrid product engineering roles',
        keywords: ['react modernization'],
        excludedTerms: ['wordpress'],
        discoveryIntent: 'job-openings' as any,
        sources: ['remoteok'] as any,
        priority: 1,
        targetCompanies: ['SaaS companies'],
        buyerPersona: '',
        painPoints: ['slow delivery'],
        valueProposition: 'Modernize the stack',
        searchStrategy: 'balanced',
        confidence: 90,
      },
    ];

    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('otui-button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(fixture.nativeElement.textContent).toContain('Edit Profile');
    expect(fixture.nativeElement.textContent).toContain(
      'Confirm & Create Topics'
    );
  });

  it('hides the DISC textarea once an assessment already exists', () => {
    const fixture = TestBed.createComponent(InterviewWizardComponent);
    const component = fixture.componentInstance;
    component.showModal = true;
    component.currentStage = 'disc';
    component.profile.discAssessment = {
      dScore: 82,
      iScore: 61,
      sScore: 43,
      cScore: 57,
      primaryType: 'D',
      secondaryType: 'I',
      summary: 'behavioral profile summary',
      confidence: 88,
    };
    component.submittedTopics = [
      {
        name: 'React modernization roles',
        description: 'Remote and hybrid product engineering roles',
        keywords: ['react modernization'],
        excludedTerms: ['wordpress'],
        discoveryIntent: 'job-openings' as any,
        sources: ['remoteok'] as any,
        priority: 1,
        targetCompanies: ['SaaS companies'],
        buyerPersona: '',
        painPoints: ['slow delivery'],
        valueProposition: 'Modernize the stack',
        searchStrategy: 'balanced',
        confidence: 90,
      },
    ];

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#disc-answer')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Rebuild Topics');
    expect(fixture.nativeElement.textContent).toContain('Back');
  });
});
