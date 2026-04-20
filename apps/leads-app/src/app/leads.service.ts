import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LeadFlagsService } from './lead-flags.service';
import { LeadOnboardingService } from './lead-onboarding.service';
import { LeadTopicsService } from './lead-topics.service';
import { LeadsApiService } from './leads-api.service';
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
  private readonly leadsApi = inject(LeadsApiService);
  private readonly topics = inject(LeadTopicsService);
  private readonly flags = inject(LeadFlagsService);
  private readonly onboarding = inject(LeadOnboardingService);

  private localLeads: Lead[] = [];

  getLeads(): Observable<Lead[]> {
    return this.leadsApi
      .getLeads()
      .pipe(tap((leads) => (this.localLeads = leads)));
  }

  getLead(id: string): Observable<Lead> {
    return this.leadsApi.getLead(id);
  }

  createLead(dto: CreateLeadDto): Observable<Lead> {
    return this.leadsApi.createLead(dto).pipe(
      tap((newLead) => {
        this.localLeads = [newLead, ...this.localLeads];
      }),
    );
  }

  updateLead(id: string, dto: UpdateLeadDto): Observable<Lead> {
    return this.leadsApi.updateLead(id, dto).pipe(
      tap((updatedLead) => {
        this.localLeads = this.localLeads.map((lead) =>
          lead.id === id ? updatedLead : lead,
        );
      }),
    );
  }

  deleteLead(id: string): Observable<void> {
    return this.leadsApi.deleteLead(id).pipe(
      tap(() => {
        this.localLeads = this.localLeads.filter((l) => l.id !== id);
      }),
    );
  }

  getStats(): Observable<LeadStats> {
    return this.leadsApi.getStats();
  }

  getTopics(): Observable<Topic[]> {
    return this.topics.getTopics();
  }

  getTopicDiscoveryStatus(topicId: string): Observable<TopicDiscoveryResult> {
    return this.topics.getTopicDiscoveryStatus(topicId);
  }

  createTopic(dto: CreateTopicDto): Observable<Topic> {
    return this.topics.createTopic(dto);
  }

  updateTopic(topicId: string, dto: UpdateTopicDto): Observable<Topic> {
    return this.topics.updateTopic(topicId, dto);
  }

  deleteTopic(topicId: string): Observable<void> {
    return this.topics.deleteTopic(topicId);
  }

  toggleTopic(topic: Topic): Observable<Topic> {
    return this.topics.toggleTopic(topic);
  }

  runTopicDiscovery(topicId: string): Observable<TopicDiscoveryResult> {
    return this.topics.runTopicDiscovery(topicId);
  }

  getLeadFlags(leadId: string): Observable<LeadFlag[]> {
    return this.flags.getLeadFlags(leadId);
  }

  flagLead(leadId: string, dto: CreateLeadFlagDto): Observable<LeadFlag> {
    return this.flags.flagLead(leadId, dto).pipe(
      tap((flag) => {
        this.localLeads = this.localLeads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                isFlagged: true,
                flags: [flag, ...(lead.flags || [])],
              }
            : lead,
        );
      }),
    );
  }

  analyzeOnboarding(
    profile: UserOnboardingProfile,
  ): Observable<{ topics: GeneratedTopicSuggestion[] }> {
    return this.onboarding.analyzeOnboarding(profile);
  }

  analyzeMadLib(text: string): Observable<MadLibAnalysisResult> {
    return this.onboarding.analyzeMadLib(text);
  }

  parseResume(file: File): Observable<ResumeParseResult> {
    return this.onboarding.parseResume(file);
  }

  searchLocations(query: string): Observable<LocationAutocompleteSuggestion[]> {
    return this.onboarding.searchLocations(query);
  }

  advanceDiscInterview(
    request: DiscInterviewRequest,
  ): Observable<DiscInterviewResponse> {
    return this.onboarding.advanceDiscInterview(request);
  }

  confirmOnboarding(
    profile: UserOnboardingProfile,
    topics: GeneratedTopicSuggestion[],
  ): Observable<{ topics: Topic[] }> {
    return this.onboarding.confirmOnboarding(profile, topics);
  }
}
