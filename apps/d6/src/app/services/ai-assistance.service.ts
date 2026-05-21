import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AiPromptRequest {
  userInput: string;
  contextType: 'affirmation' | 'plannedPleasurable' | 'judgement' | 'nonJudgement' | 'mindfulActivity' | 'gratitude';
  additionalContext?: string;
}

export interface AiPromptResponse {
  prompt: string;
}

export interface WellnessContextResponse {
  context: string;
}

export interface AffirmationResponse {
  suggestion: string;
}

export interface MindfulActivityResponse {
  suggestion: string;
}

export interface GratitudeAnalysisResponse {
  analysis: string;
}

export interface JudgmentReflectionResponse {
  reflection: string;
}

@Injectable({ providedIn: 'root' })
export class AiAssistanceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/wellness/ai';

  generateWellnessPrompt(request: AiPromptRequest): Observable<AiPromptResponse> {
    return this.http.post<AiPromptResponse>(
      `${this.baseUrl}/prompt`,
      request
    );
  }

  getContext(contextType: string): Observable<WellnessContextResponse> {
    return this.http.post<WellnessContextResponse>(
      `${this.baseUrl}/context`,
      { contextType }
    );
  }

  getAffirmation(userGoals?: string[]): Observable<AffirmationResponse> {
    return this.http.post<AffirmationResponse>(
      `${this.baseUrl}/affirmation`,
      { userGoals }
    );
  }

  getMindfulActivitySuggestion(previousActivities?: string[]): Observable<MindfulActivityResponse> {
    return this.http.post<MindfulActivityResponse>(
      `${this.baseUrl}/mindful-activity`,
      { previousActivities }
    );
  }

  analyzeGratitudeEntry(gratitudeEntry: string): Observable<GratitudeAnalysisResponse> {
    return this.http.post<GratitudeAnalysisResponse>(
      `${this.baseUrl}/gratitude-analysis`,
      { gratitudeEntry }
    );
  }

  reflectJudgment(judgment: string): Observable<JudgmentReflectionResponse> {
    return this.http.post<JudgmentReflectionResponse>(
      `${this.baseUrl}/judgment-reflection`,
      { judgment }
    );
  }
}
