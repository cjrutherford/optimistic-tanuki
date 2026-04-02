import { LeadDiscoverySource } from './lead-discovery-source.enum';
import { LeadTopicDiscoveryIntent } from './lead-topic-discovery-intent.enum';

export interface DiscAssessment {
  dScore: number;
  iScore: number;
  sScore: number;
  cScore: number;
  primaryType: string;
  secondaryType?: string;
  summary: string;
  confidence: number;
}

export interface ResumeRoleSummary {
  title: string;
  company?: string;
  dateRange?: string;
  skills: string[];
  industries: string[];
  highlights: string[];
  outcomes: string[];
}

export interface OnboardingProfileSuggestions {
  serviceOffer?: string;
  yearsExperience?: string;
  skills?: string[];
  certifications?: string[];
  idealCustomer?: string;
  companySizeTarget?: string[];
  industries?: string[];
  problemsSolved?: string[];
  outcomes?: string[];
  budgetRange?: string | string[];
  geographicFocus?: string;
  localSearchLocation?: string;
  localSearchRadiusMiles?: number;
  salesApproach?: string;
  outreachMethod?: string[];
  communicationStyle?: string;
  leadSignalTypes?: string[];
  excludedCompanies?: string[];
  excludedIndustries?: string[];
}

export type OnboardingSuggestionEvidence = Partial<
  Record<keyof OnboardingProfileSuggestions, string[]>
>;

export interface ResumeParseResult {
  summary: string;
  skills: string[];
  experience: string[];
  certifications: string[];
  suggestedProfile: OnboardingProfileSuggestions;
  roleSummaries: ResumeRoleSummary[];
  evidenceByField?: OnboardingSuggestionEvidence;
}

export interface MadLibAnalysisResult {
  summary: string;
  suggestedServiceOffer: string;
  suggestedSkills: string[];
  suggestedIdealCustomer?: string;
  suggestedProfile: OnboardingProfileSuggestions;
  evidenceByField?: OnboardingSuggestionEvidence;
}

export interface DiscInterviewTurn {
  role: 'assistant' | 'user';
  text: string;
}

export interface DiscInterviewRequest {
  profile?: Partial<UserOnboardingProfile>;
  transcript: DiscInterviewTurn[];
}

export interface DiscInterviewResponse {
  complete: boolean;
  nextQuestion?: string;
  assessment?: DiscAssessment;
  discType?: string;
}

export interface ResumeParseRequest {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export interface UserOnboardingProfile {
  id?: string;
  userId?: string;
  // Section A: Professional Background
  madLibSummary?: string;
  serviceOffer: string;
  yearsExperience: string;
  skills: string[];
  certifications: string[];
  resumeParseSummary?: string;
  resumeDerivedSkills?: string[];
  resumeDerivedExperience?: string[];
  resumeDerivedCertifications?: string[];
  resumeRoleSummaries?: ResumeRoleSummary[];
  prefillEvidenceByField?: OnboardingSuggestionEvidence;
  prefillSourceByField?: Partial<
    Record<keyof OnboardingProfileSuggestions, 'mad-lib' | 'resume' | 'mad-lib+resume'>
  >;
  // Section B: Target Customer
  idealCustomer: string;
  companySizeTarget: string[];
  industries: string[];
  problemsSolved: string[];
  outcomes: string[];
  budgetRange: string[];
  geographicFocus: string;
  localSearchLocation?: string;
  localSearchRadiusMiles?: number;
  // Section C: Sales & Communication
  salesApproach: string;
  outreachMethod: string[];
  communicationStyle: string;
  discType?: string;
  discAssessment?: DiscAssessment;
  // Section D: Discovery Preferences
  leadSignalTypes: string[];
  excludedCompanies: string[];
  excludedIndustries: string[];
  // Status
  currentStep: number;
  completedAt?: Date;
}

export interface OnboardingQuestion {
  id: string;
  section: 'professional' | 'customer' | 'sales' | 'preferences';
  question: string;
  description?: string;
  type: 'text' | 'textarea' | 'multiselect' | 'chips' | 'single-select';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export interface GeneratedTopicSuggestion {
  name: string;
  description: string;
  keywords: string[];
  excludedTerms: string[];
  discoveryIntent: LeadTopicDiscoveryIntent;
  sources: LeadDiscoverySource[];
  googleMapsCities?: string[];
  googleMapsTypes?: string[];
  priority: number;
  targetCompanies: string[];
  buyerPersona: string;
  painPoints: string[];
  valueProposition: string;
  searchStrategy: 'aggressive' | 'balanced' | 'conservative';
  confidence: number;
  googleMapsLocation?: string;
  googleMapsRadiusMiles?: number;
}

export interface OnboardingAnalysisResult {
  profile: UserOnboardingProfile;
  suggestedTopics: GeneratedTopicSuggestion[];
  analyzedAt: Date;
}

export interface ConfirmOnboardingRequest {
  profile: UserOnboardingProfile;
  topics: GeneratedTopicSuggestion[];
}
