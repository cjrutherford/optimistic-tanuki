import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  Input,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  DiscInterviewRequest,
  DiscInterviewResponse,
  DiscInterviewTurn,
  GeneratedTopicSuggestion,
  LocationAutocompleteSuggestion,
  MadLibAnalysisResult,
  OnboardingProfileSuggestions,
  OnboardingQuestion,
  ResumeParseResult,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';
import { LeadsService } from './leads.service';

type WizardStage = 'mad-lib' | 'resume' | 'profile' | 'disc';

@Component({
  selector: 'app-interview-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './interview-wizard.component.html',
  styleUrl: './interview-wizard.component.scss',
})
export class InterviewWizardComponent implements OnDestroy {
  private readonly leadsService = inject(LeadsService);
  @Input() showModal = false;
  @Input() allowClose = true;
  @Input() errorMessage = '';
  @Input() confirmingTopics = false;
  @Output() close = new EventEmitter<void>();
  @Output() analyzeMadLib = new EventEmitter<string>();
  @Output() parseResume = new EventEmitter<File>();
  @Output() advanceDiscInterview = new EventEmitter<DiscInterviewRequest>();
  @Output() analyzeTopics = new EventEmitter<UserOnboardingProfile>();
  @Output() confirmTopics = new EventEmitter<GeneratedTopicSuggestion[]>();

  currentStage: WizardStage = 'mad-lib';
  currentQuestionIndex = 0;
  submittedTopics: GeneratedTopicSuggestion[] = [];
  isAnalyzing = false;
  isResumeParsing = false;
  isDiscLoading = false;
  showTopicReview = false;
  newChipValue = '';
  madLibValue = '';
  discAnswerValue = '';
  discTranscript: DiscInterviewTurn[] = [];
  resumeFileName = '';
  locationSuggestions: LocationAutocompleteSuggestion[] = [];
  locationInputValue = '';
  private locationAutocompleteSub?: Subscription;

  profile: UserOnboardingProfile = this.buildEmptyProfile();

  questions: OnboardingQuestion[] = [
    {
      id: 'serviceOffer',
      section: 'professional',
      question: 'What service or offer do you sell?',
      type: 'text',
      required: true,
      placeholder:
        'e.g., React modernization, SEO services, Executive coaching',
    },
    {
      id: 'yearsExperience',
      section: 'professional',
      question: 'How many years of experience do you have?',
      type: 'multiselect',
      options: ['0-1 years', '2-5 years', '6-10 years', '10+ years'],
      required: true,
    },
    {
      id: 'skills',
      section: 'professional',
      question: 'What are your key skills and areas of expertise?',
      type: 'chips',
      required: true,
      placeholder: 'Type a skill and press Enter or comma',
    },
    {
      id: 'certifications',
      section: 'professional',
      question: 'Do you have any certifications or special credentials?',
      type: 'chips',
      required: false,
      placeholder: 'e.g., AWS Certified, PMP, Google Partner',
    },
    {
      id: 'idealCustomer',
      section: 'customer',
      question: 'Describe your ideal customer',
      type: 'textarea',
      required: true,
      placeholder: 'Company size, industry, roles, pain points...',
    },
    {
      id: 'companySizeTarget',
      section: 'customer',
      question: 'What company sizes do you work with?',
      type: 'multiselect',
      options: ['1-10', '11-50', '51-200', '201-500', '500+'],
      required: true,
    },
    {
      id: 'industries',
      section: 'customer',
      question: 'Which industries do you focus on?',
      type: 'chips',
      required: true,
      placeholder: 'e.g., SaaS, Healthcare, Finance',
    },
    {
      id: 'problemsSolved',
      section: 'customer',
      question: 'What problems do you solve for your customers?',
      type: 'chips',
      required: true,
      placeholder: 'e.g., slow website, low conversions',
    },
    {
      id: 'outcomes',
      section: 'customer',
      question: 'What outcomes/results do they achieve?',
      type: 'chips',
      required: true,
      placeholder: 'e.g., 50% faster load times',
    },
    {
      id: 'budgetRange',
      section: 'customer',
      question: 'What is your typical budget range?',
      type: 'single-select',
      options: ['Under $5k', '$5k-$25k', '$25k-$100k', '$100k+'],
      required: false,
    },
    {
      id: 'geographicFocus',
      section: 'customer',
      question: 'What is your geographic focus?',
      type: 'single-select',
      options: [
        'Global',
        'North America',
        'US only',
        'Europe',
        'Specific regions',
      ],
      required: true,
    },
    {
      id: 'localSearchLocation',
      section: 'customer',
      question: 'What location should Google Maps search around?',
      type: 'text',
      required: true,
      placeholder: 'e.g., Atlanta, GA',
    },
    {
      id: 'localSearchRadiusMiles',
      section: 'customer',
      question: 'How far out should local Google Maps discovery search?',
      type: 'single-select',
      options: ['10', '25', '50', '100'],
      required: true,
    },
    {
      id: 'salesApproach',
      section: 'sales',
      question: 'What is your preferred sales approach?',
      type: 'single-select',
      options: [
        'Consultative',
        'Transactional',
        'Inbound only',
        'Outbound focused',
        'Hybrid',
      ],
      required: true,
    },
    {
      id: 'outreachMethod',
      section: 'sales',
      question: 'How do you typically reach out to prospects?',
      type: 'multiselect',
      options: [
        'Email',
        'LinkedIn',
        'Cold calls',
        'Networking events',
        'Content marketing',
        'Referrals',
      ],
      required: true,
    },
    {
      id: 'communicationStyle',
      section: 'sales',
      question: 'What is your communication style?',
      type: 'single-select',
      options: ['Formal', 'Casual', 'Technical', 'Story-driven', 'Direct'],
      required: true,
    },
    {
      id: 'leadSignalTypes',
      section: 'preferences',
      question: 'What types of lead signals interest you?',
      type: 'multiselect',
      options: [
        'Job changes',
        'Company hiring',
        'Funding rounds',
        'Company growth',
        'New product launches',
        'Expansion news',
      ],
      required: true,
    },
    {
      id: 'excludedCompanies',
      section: 'preferences',
      question: 'Any companies or industries to exclude?',
      type: 'chips',
      required: false,
      placeholder: 'e.g., Competitors, Industries you avoid',
    },
  ];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    this.locationAutocompleteSub?.unsubscribe();
  }

  get currentQuestion(): OnboardingQuestion {
    return this.questions[this.currentQuestionIndex];
  }

  get progressPercentage(): number {
    if (this.showTopicReview) {
      return 100;
    }

    switch (this.currentStage) {
      case 'mad-lib':
        return 10;
      case 'resume':
        return 25;
      case 'profile':
        return 25 + Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 45);
      case 'disc':
        return 80;
      default:
        return 0;
    }
  }

  get canGoNext(): boolean {
    if (this.currentStage !== 'profile') {
      return false;
    }

    const q = this.currentQuestion;
    if (!q.required) return true;
    if (q.type === 'chips' && this.hasPendingChipValue()) {
      return true;
    }
    return this.isAnswered(q.id);
  }

  get canSubmit(): boolean {
    return this.questions.every((q) => {
      if (!q.required) {
        return true;
      }
      if (
        q.type === 'chips' &&
        q.id === this.currentQuestion.id &&
        this.hasPendingChipValue()
      ) {
        return true;
      }
      return this.isAnswered(q.id);
    });
  }

  get isLastQuestion(): boolean {
    return this.currentQuestionIndex === this.questions.length - 1;
  }

  getProfileValue(key: string): unknown {
    return (this.profile as unknown as Record<string, unknown>)[key];
  }

  getProfileListValue(key: string): string[] {
    const value = this.getProfileValue(key);
    return Array.isArray(value) ? (value as string[]) : [];
  }

  setProfileValue(key: string, value: unknown): void {
    (this.profile as unknown as Record<string, unknown>)[key] =
      key === 'localSearchRadiusMiles' ? Number(value) : value;
    if (key === 'localSearchLocation') {
      this.locationInputValue = '';
    }
    this.cdr.detectChanges();
  }

  get isLocationAutocompleteQuestion(): boolean {
    return this.currentQuestion.id === 'localSearchLocation';
  }

  getCurrentQuestionSourceLabel(): string | null {
    const source = this.profile.prefillSourceByField?.[
      this.currentQuestion.id as keyof OnboardingProfileSuggestions
    ];

    if (!source) return null;
    if (source === 'mad-lib+resume') return 'Prefilled from your intro and resume';
    if (source === 'mad-lib') return 'Suggested from your intro';
    return 'Prefilled from your resume';
  }

  getCurrentQuestionEvidence(): string[] {
    return (
      this.profile.prefillEvidenceByField?.[
        this.currentQuestion.id as keyof OnboardingProfileSuggestions
      ] || []
    );
  }

  get hasCompletedDiscAssessment(): boolean {
    return this.profile.discAssessment !== undefined;
  }

  isAnswered(questionId: string): boolean {
    const value = (this.profile as unknown as Record<string, unknown>)[questionId];
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  }

  requestMadLibAnalysis(): void {
    const value = this.madLibValue.trim();
    if (!value) {
      return;
    }
    this.isAnalyzing = true;
    this.analyzeMadLib.emit(value);
  }

  onMadLibAnalyzed(result: MadLibAnalysisResult): void {
    this.isAnalyzing = false;
    this.profile.madLibSummary = result.summary;
    this.mergeSuggestedProfile(
      {
        serviceOffer: result.suggestedServiceOffer,
        skills: result.suggestedSkills,
        idealCustomer: result.suggestedIdealCustomer,
        ...result.suggestedProfile,
      },
      result.evidenceByField || {},
      'mad-lib'
    );
    this.currentStage = 'resume';
    this.cdr.detectChanges();
  }

  onMadLibFailed(): void {
    this.isAnalyzing = false;
    this.cdr.detectChanges();
  }

  onResumeFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.resumeFileName = file.name;
    this.isResumeParsing = true;
    this.parseResume.emit(file);
  }

  onResumeParsed(result: ResumeParseResult): void {
    this.isResumeParsing = false;
    this.profile.resumeParseSummary = result.summary;
    this.profile.resumeDerivedSkills = [...result.skills];
    this.profile.resumeDerivedExperience = [...result.experience];
    this.profile.resumeDerivedCertifications = [...result.certifications];
    this.profile.resumeRoleSummaries = [...result.roleSummaries];
    this.mergeSuggestedProfile(
      {
        skills: result.skills,
        certifications: result.certifications,
        ...result.suggestedProfile,
      },
      result.evidenceByField || {},
      'resume'
    );
    this.locationInputValue = '';
    this.currentStage = 'profile';
    this.cdr.detectChanges();
  }

  onResumeParseFailed(): void {
    this.isResumeParsing = false;
    this.cdr.detectChanges();
  }

  onLocationInput(value: string): void {
    this.locationInputValue = value;
    const query = value.trim();
    if (query.length < 2) {
      this.locationSuggestions = [];
      return;
    }

    this.locationAutocompleteSub?.unsubscribe();
    this.locationAutocompleteSub = this.leadsService.searchLocations(query).subscribe({
      next: (suggestions) => {
        this.locationSuggestions = suggestions;
        this.cdr.detectChanges();
      },
      error: () => {
        this.locationSuggestions = [];
        this.cdr.detectChanges();
      },
    });
  }

  applyLocationSuggestion(suggestion: LocationAutocompleteSuggestion): void {
    this.setProfileValue('localSearchLocation', suggestion.description);
    this.locationSuggestions = [];
  }

  commitLocationInput(): void {
    const value = this.locationInputValue.trim();
    if (!value) {
      return;
    }
    this.setProfileValue('localSearchLocation', value);
    this.locationSuggestions = [];
  }

  clearLocationSelection(): void {
    this.locationInputValue = '';
    this.setProfileValue('localSearchLocation', '');
    this.locationSuggestions = [];
  }

  onLocationInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitLocationInput();
    }
  }

  closeLocationSuggestions(): void {
    window.setTimeout(() => {
      this.locationSuggestions = [];
      this.cdr.detectChanges();
    }, 120);
  }

  skipResumeStep(): void {
    this.currentStage = 'profile';
    this.cdr.detectChanges();
  }

  nextQuestion(): void {
    this.commitPendingChipForCurrentQuestion();
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.profile.currentStep = this.currentQuestionIndex;
      this.cdr.detectChanges();
      return;
    }

    this.beginDiscInterview();
  }

  prevQuestion(): void {
    if (this.currentStage === 'profile' && this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.cdr.detectChanges();
      return;
    }

    if (this.currentStage === 'profile' && this.currentQuestionIndex === 0) {
      this.currentStage = 'resume';
      this.cdr.detectChanges();
      return;
    }

    if (this.currentStage === 'disc') {
      this.currentQuestionIndex = this.questions.length - 1;
      this.currentStage = 'profile';
      this.cdr.detectChanges();
    }
  }

  addChip(field: string): void {
    const value = this.newChipValue.trim();
    if (!value) return;

    const current =
      ((this.profile as unknown as Record<string, unknown>)[field] as string[]) ||
      [];
    if (!current.includes(value)) {
      (this.profile as unknown as Record<string, unknown>)[field] = [
        ...current,
        value,
      ];
      this.newChipValue = '';
      this.cdr.detectChanges();
    }
  }

  removeChip(field: string, value: string): void {
    (this.profile as unknown as Record<string, unknown>)[field] = (
      ((this.profile as unknown as Record<string, unknown>)[field] as string[]) ||
      []
    ).filter((item: string) => item !== value);
    this.cdr.detectChanges();
  }

  toggleMultiSelect(field: string, value: string): void {
    const current =
      ((this.profile as unknown as Record<string, unknown>)[field] as string[]) ||
      [];
    if (current.includes(value)) {
      (this.profile as unknown as Record<string, unknown>)[field] = current.filter(
        (item: string) => item !== value
      );
    } else {
      (this.profile as unknown as Record<string, unknown>)[field] = [
        ...current,
        value,
      ];
    }
    this.cdr.detectChanges();
  }

  isMultiSelected(field: string, value: string): boolean {
    const current =
      ((this.profile as unknown as Record<string, unknown>)[field] as string[]) ||
      [];
    return current.includes(value);
  }

  onChipInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addChip(this.currentQuestion.id);
    }
  }

  submitForAnalysis(): void {
    this.commitPendingChipForCurrentQuestion();
    if (!this.canSubmit) return;
    this.beginDiscInterview();
  }

  submitDiscAnswer(): void {
    const answer = this.discAnswerValue.trim();
    if (!answer || this.isDiscLoading) {
      return;
    }

    this.discTranscript = [
      ...this.discTranscript,
      { role: 'user', text: answer },
    ];
    this.discAnswerValue = '';
    this.requestDiscTurn();
  }

  onDiscAdvanced(response: DiscInterviewResponse): void {
    this.isDiscLoading = false;

    if (response.complete && response.assessment) {
      this.profile.discAssessment = response.assessment;
      this.profile.discType =
        response.discType || response.assessment.primaryType;
      this.submitForTopicAnalysis();
      return;
    }

    if (response.nextQuestion) {
      this.discTranscript = [
        ...this.discTranscript,
        { role: 'assistant', text: response.nextQuestion },
      ];
    }
    this.cdr.detectChanges();
  }

  onDiscAdvanceFailed(): void {
    this.isDiscLoading = false;
    this.cdr.detectChanges();
  }

  onAnalysisFailed(): void {
    this.isAnalyzing = false;
    this.cdr.detectChanges();
  }

  onTopicsAnalyzed(topics: GeneratedTopicSuggestion[]): void {
    this.isAnalyzing = false;
    this.submittedTopics = topics;
    this.showTopicReview = true;
    this.cdr.detectChanges();
  }

  confirmAndCreate(): void {
    this.confirmTopics.emit(this.submittedTopics);
  }

  backToInterview(): void {
    this.showTopicReview = false;
    this.cdr.detectChanges();
  }

  returnToReview(): void {
    if (this.submittedTopics.length === 0) {
      return;
    }
    this.showTopicReview = true;
    this.cdr.detectChanges();
  }

  rerunTopicAnalysis(): void {
    if (!this.profile.discAssessment) {
      return;
    }
    this.submitForTopicAnalysis();
  }

  closeModal(): void {
    if (!this.allowClose) {
      return;
    }
    this.close.emit();
    this.reset();
  }

  private beginDiscInterview(): void {
    this.currentStage = 'disc';
    if (this.profile.discAssessment) {
      this.cdr.detectChanges();
      return;
    }

    if (this.discTranscript.length === 0) {
      this.requestDiscTurn();
    } else {
      this.cdr.detectChanges();
    }
  }

  private requestDiscTurn(): void {
    this.isDiscLoading = true;
    this.advanceDiscInterview.emit({
      profile: this.profile,
      transcript: this.discTranscript,
    });
  }

  private submitForTopicAnalysis(): void {
    this.isAnalyzing = true;
    this.cdr.detectChanges();
    this.analyzeTopics.emit(this.profile);
  }

  private reset(): void {
    this.currentStage = 'mad-lib';
    this.currentQuestionIndex = 0;
    this.showTopicReview = false;
    this.submittedTopics = [];
    this.isAnalyzing = false;
    this.isResumeParsing = false;
    this.isDiscLoading = false;
    this.newChipValue = '';
    this.madLibValue = '';
    this.discAnswerValue = '';
    this.discTranscript = [];
    this.resumeFileName = '';
    this.locationAutocompleteSub?.unsubscribe();
    this.locationSuggestions = [];
    this.locationInputValue = '';
    this.profile = this.buildEmptyProfile();
  }

  private buildEmptyProfile(): UserOnboardingProfile {
    return {
      madLibSummary: '',
      serviceOffer: '',
      yearsExperience: '',
      skills: [],
      certifications: [],
      resumeParseSummary: '',
      resumeDerivedSkills: [],
      resumeDerivedExperience: [],
      resumeDerivedCertifications: [],
      resumeRoleSummaries: [],
      prefillEvidenceByField: {},
      prefillSourceByField: {},
      idealCustomer: '',
      companySizeTarget: [],
      industries: [],
      problemsSolved: [],
      outcomes: [],
      budgetRange: [],
      geographicFocus: '',
      localSearchLocation: '',
      localSearchRadiusMiles: 25,
      salesApproach: '',
      outreachMethod: [],
      communicationStyle: '',
      discType: '',
      leadSignalTypes: [],
      excludedCompanies: [],
      excludedIndustries: [],
      currentStep: 0,
    };
  }

  private hasPendingChipValue(): boolean {
    return this.newChipValue.trim().length > 0;
  }

  private commitPendingChipForCurrentQuestion(): void {
    if (this.currentQuestion.type !== 'chips' || !this.hasPendingChipValue()) {
      return;
    }
    this.addChip(this.currentQuestion.id);
  }

  private mergeUnique(current: string[], next: string[]): string[] {
    return Array.from(new Set([...(current || []), ...(next || [])]));
  }

  private mergeSuggestedProfile(
    suggestions: OnboardingProfileSuggestions,
    evidence: Partial<Record<keyof OnboardingProfileSuggestions, string[]>>,
    source: 'mad-lib' | 'resume'
  ): void {
    const entries = Object.entries(suggestions) as Array<
      [keyof OnboardingProfileSuggestions, string | string[] | undefined]
    >;

    for (const [field, value] of entries) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      const profileValue = (this.profile as unknown as Record<string, unknown>)[field];

      if (field === 'budgetRange' && typeof value === 'string') {
        const normalized = value.trim();
        if (normalized) {
          const merged = this.mergeUnique(
            Array.isArray(profileValue) ? (profileValue as string[]) : [],
            [normalized]
          );
          (this.profile as unknown as Record<string, unknown>)[field] = merged;
        }
      } else if (Array.isArray(value)) {
        const merged = this.mergeUnique(
          Array.isArray(profileValue) ? (profileValue as string[]) : [],
          value
        );
        (this.profile as unknown as Record<string, unknown>)[field] = merged;
      } else if (
        field === 'localSearchRadiusMiles' ||
        !profileValue
      ) {
        (this.profile as unknown as Record<string, unknown>)[field] =
          field === 'localSearchRadiusMiles' ? Number(value) : value;
      }

      const existingEvidence =
        this.profile.prefillEvidenceByField?.[field] || [];
      if (evidence[field]?.length) {
        this.profile.prefillEvidenceByField = {
          ...(this.profile.prefillEvidenceByField || {}),
          [field]: this.mergeUnique(existingEvidence, evidence[field] || []),
        };
      }

      const currentSource = this.profile.prefillSourceByField?.[field];
      this.profile.prefillSourceByField = {
        ...(this.profile.prefillSourceByField || {}),
        [field]:
          currentSource && currentSource !== source ? 'mad-lib+resume' : source,
      };
    }
  }
}
