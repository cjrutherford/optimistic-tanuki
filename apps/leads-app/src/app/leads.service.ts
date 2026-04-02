import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  Lead,
  LeadStats,
  CreateLeadDto,
  UpdateLeadDto,
  Topic,
  LeadFlag,
  CreateLeadFlagDto,
  CreateTopicDto,
  TopicDiscoveryResult,
  UpdateTopicDto,
} from './leads.types';
import {
  DiscInterviewRequest,
  DiscInterviewResponse,
  ConfirmOnboardingRequest,
  GeneratedTopicSuggestion,
  LocationAutocompleteSuggestion,
  MadLibAnalysisResult,
  ResumeParseResult,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/leads';

  private localLeads: Lead[] = [];

  getLeads(): Observable<Lead[]> {
    return this.http
      .get<Lead[]>(this.baseUrl)
      .pipe(tap((leads) => (this.localLeads = leads)));
  }

  getLead(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.baseUrl}/${id}`);
  }

  createLead(dto: CreateLeadDto): Observable<Lead> {
    return this.http.post<Lead>(this.baseUrl, dto).pipe(
      tap((newLead) => {
        this.localLeads = [newLead, ...this.localLeads];
      })
    );
  }

  updateLead(id: string, dto: UpdateLeadDto): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${id}`, dto).pipe(
      tap((updatedLead) => {
        this.localLeads = this.localLeads.map((lead) =>
          lead.id === id ? updatedLead : lead
        );
      })
    );
  }

  deleteLead(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.localLeads = this.localLeads.filter((l) => l.id !== id);
      })
    );
  }

  getStats(): Observable<LeadStats> {
    return this.http.get<LeadStats>(`${this.baseUrl}/stats/overview`);
  }

  getTopics(): Observable<Topic[]> {
    return this.http.get<Topic[]>(`${this.baseUrl}/topics`);
  }

  getTopicDiscoveryStatus(topicId: string): Observable<TopicDiscoveryResult> {
    return this.http.get<TopicDiscoveryResult>(
      `${this.baseUrl}/topics/${topicId}/discovery-status`
    );
  }

  createTopic(dto: CreateTopicDto): Observable<Topic> {
    return this.http.post<Topic>(`${this.baseUrl}/topics`, dto);
  }

  updateTopic(topicId: string, dto: UpdateTopicDto): Observable<Topic> {
    return this.http.patch<Topic>(`${this.baseUrl}/topics/${topicId}`, dto);
  }

  deleteTopic(topicId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/topics/${topicId}`);
  }

  toggleTopic(topic: Topic): Observable<Topic> {
    return this.updateTopic(topic.id, { enabled: !topic.enabled });
  }

  runTopicDiscovery(topicId: string): Observable<TopicDiscoveryResult> {
    return this.http.post<TopicDiscoveryResult>(
      `${this.baseUrl}/topics/${topicId}/discover`,
      {}
    );
  }

  getLeadFlags(leadId: string): Observable<LeadFlag[]> {
    return this.http.get<LeadFlag[]>(`${this.baseUrl}/${leadId}/flags`);
  }

  flagLead(leadId: string, dto: CreateLeadFlagDto): Observable<LeadFlag> {
    return this.http
      .post<LeadFlag>(`${this.baseUrl}/${leadId}/flags`, dto)
      .pipe(
        tap((flag) => {
          this.localLeads = this.localLeads.map((lead) =>
            lead.id === leadId
              ? {
                  ...lead,
                  isFlagged: true,
                  flags: [flag, ...(lead.flags || [])],
                }
              : lead
          );
        })
      );
  }

  analyzeOnboarding(
    profile: UserOnboardingProfile
  ): Observable<{ topics: GeneratedTopicSuggestion[] }> {
    return this.http.post<{ topics: GeneratedTopicSuggestion[] }>(
      `${this.baseUrl}/onboarding/analyze`,
      profile
    );
  }

  analyzeMadLib(text: string): Observable<MadLibAnalysisResult> {
    return this.http.post<MadLibAnalysisResult>(
      `${this.baseUrl}/onboarding/mad-lib/analyze`,
      { text }
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

  confirmOnboarding(
    profile: UserOnboardingProfile,
    topics: GeneratedTopicSuggestion[]
  ): Observable<{ topics: Topic[] }> {
    const payload: ConfirmOnboardingRequest = { profile, topics };
    return this.http.post<{ topics: Topic[] }>(
      `${this.baseUrl}/onboarding/confirm`,
      payload
    );
  }
}
