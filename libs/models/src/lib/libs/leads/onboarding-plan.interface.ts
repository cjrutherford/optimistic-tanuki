import { LeadDiscoverySource } from './lead-discovery-source.enum';
import { LeadTopicDiscoveryIntent } from './lead-topic-discovery-intent.enum';

export type OnboardingOpportunityMode = 'jobs' | 'buyers' | 'both';

export interface OnboardingProfile {
  service: string;
  audience: string;
  outcomes: string;
  opportunityMode: OnboardingOpportunityMode;
  localMarkets: string;
  excludedTerms: string;
}

export interface OnboardingTopicPreset {
  name: string;
  description: string;
  keywords: string[];
  excludedTerms: string[];
  discoveryIntent: LeadTopicDiscoveryIntent;
  sources: LeadDiscoverySource[];
  googleMapsCities?: string[];
  googleMapsTypes?: string[];
  googleMapsLocation?: string;
  googleMapsRadiusMiles?: number;
  enabled: boolean;
}

export interface OnboardingPlan {
  profile: OnboardingProfile;
  topics: OnboardingTopicPreset[];
}

export interface OnboardingValidationResult {
  valid: boolean;
  errors: string[];
}
