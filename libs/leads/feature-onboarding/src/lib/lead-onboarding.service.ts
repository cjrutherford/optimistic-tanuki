import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ConfirmOnboardingRequest,
  DiscInterviewRequest,
  DiscInterviewTurn,
  DiscInterviewResponse,
  GeneratedTopicSuggestion,
  LocationAutocompleteSuggestion,
  MadLibAnalysisRequest,
  MadLibAnalysisResult,
  ResumeParseResult,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';
import { AspirationalCompany, Topic } from '@optimistic-tanuki/leads-contracts';

@Injectable({ providedIn: 'root' })
export class LeadOnboardingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/leads';

  analyzeOnboarding(
    profile: UserOnboardingProfile
  ): Observable<{ topics: GeneratedTopicSuggestion[] }> {
    return this.http.post<{ topics: GeneratedTopicSuggestion[] }>(
      `${this.baseUrl}/onboarding/analyze`,
      profile
    );
  }

  analyzeMadLib(
    request: string | MadLibAnalysisRequest
  ): Observable<MadLibAnalysisResult> {
    const body: MadLibAnalysisRequest =
      typeof request === 'string' ? { text: request } : request;
    return this.http.post<MadLibAnalysisResult>(
      `${this.baseUrl}/onboarding/mad-lib/analyze`,
      body
    );
  }

  parseResume(file: File): Observable<ResumeParseResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ResumeParseResult>(
      `${this.baseUrl}/onboarding/resume/parse`,
      formData
    );
  }

  searchLocations(query: string): Observable<LocationAutocompleteSuggestion[]> {
    return this.http.get<LocationAutocompleteSuggestion[]>(
      `${this.baseUrl}/locations/autocomplete`,
      {
        params: {
          q: query,
        },
      }
    );
  }

  advanceDiscInterview(
    request: DiscInterviewRequest
  ): Observable<DiscInterviewResponse> {
    return this.http.post<DiscInterviewResponse>(
      `${this.baseUrl}/onboarding/disc/advance`,
      request
    );
  }

  lookupAtsCompany(
    companyName: string
  ): Observable<(AspirationalCompany & { openingCount: number })[]> {
    return this.http.post<(AspirationalCompany & { openingCount: number })[]>(
      `${this.baseUrl}/ats/company/lookup`,
      { companyName }
    );
  }

  suggestAtsCompanies(): Observable<
    (AspirationalCompany & { openingCount: number; reason: string })[]
  > {
    return this.http.get<
      (AspirationalCompany & { openingCount: number; reason: string })[]
    >(`${this.baseUrl}/ats/company/suggestions`);
  }

  confirmOnboarding(
    profile: UserOnboardingProfile,
    topics: GeneratedTopicSuggestion[],
    discTranscript: DiscInterviewTurn[] = []
  ): Observable<{ topics: Topic[] }> {
    const payload: ConfirmOnboardingRequest = {
      profile,
      topics,
      discTranscript,
    };

    return this.http.post<{ topics: Topic[] }>(
      `${this.baseUrl}/onboarding/confirm`,
      payload
    );
  }
}
