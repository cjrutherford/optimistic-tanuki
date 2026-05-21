import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ConfirmOnboardingRequest,
  DiscInterviewRequest,
  DiscInterviewResponse,
  GeneratedTopicSuggestion,
  LocationAutocompleteSuggestion,
  MadLibAnalysisResult,
  ResumeParseResult,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';
import { Topic } from '@optimistic-tanuki/leads-contracts';

@Injectable({ providedIn: 'root' })
export class LeadOnboardingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/leads';

  analyzeOnboarding(
    profile: UserOnboardingProfile,
  ): Observable<{ topics: GeneratedTopicSuggestion[] }> {
    return this.http.post<{ topics: GeneratedTopicSuggestion[] }>(
      `${this.baseUrl}/onboarding/analyze`,
      profile,
    );
  }

  analyzeMadLib(text: string): Observable<MadLibAnalysisResult> {
    return this.http.post<MadLibAnalysisResult>(
      `${this.baseUrl}/onboarding/mad-lib/analyze`,
      { text },
    );
  }

  parseResume(file: File): Observable<ResumeParseResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ResumeParseResult>(
      `${this.baseUrl}/onboarding/resume/parse`,
      formData,
    );
  }

  searchLocations(query: string): Observable<LocationAutocompleteSuggestion[]> {
    return this.http.get<LocationAutocompleteSuggestion[]>(
      `${this.baseUrl}/locations/autocomplete`,
      {
        params: {
          q: query,
        },
      },
    );
  }

  advanceDiscInterview(
    request: DiscInterviewRequest,
  ): Observable<DiscInterviewResponse> {
    return this.http.post<DiscInterviewResponse>(
      `${this.baseUrl}/onboarding/disc/advance`,
      request,
    );
  }

  confirmOnboarding(
    profile: UserOnboardingProfile,
    topics: GeneratedTopicSuggestion[],
  ): Observable<{ topics: Topic[] }> {
    const payload: ConfirmOnboardingRequest = { profile, topics };

    return this.http.post<{ topics: Topic[] }>(
      `${this.baseUrl}/onboarding/confirm`,
      payload,
    );
  }
}
