import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  Lead,
  LeadStats,
  CreateLeadDto,
  UpdateLeadDto,
  Topic,
  LeadFlag,
  LeadFlagReason,
} from './leads.types';
import { DUMMY_LEADS, DUMMY_STATS, DUMMY_TOPICS } from './dummy-data';

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/leads';

  private topicsSubject = new BehaviorSubject<Topic[]>([...DUMMY_TOPICS]);
  private flagsMap = new Map<string, LeadFlag[]>();
  private localLeads: Lead[] = [];

  getLeads(): Observable<Lead[]> {
    return this.http.get<Lead[]>(this.baseUrl).pipe(
      tap((leads) => (this.localLeads = leads)),
      catchError(() => {
        this.localLeads = [...DUMMY_LEADS];
        return of(this.localLeads);
      })
    );
  }

  getLead(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.baseUrl}/${id}`).pipe(
      catchError(() => {
        const lead = DUMMY_LEADS.find((l) => l.id === id);
        return of(lead as Lead);
      })
    );
  }

  createLead(dto: CreateLeadDto): Observable<Lead> {
    return this.http.post<Lead>(this.baseUrl, dto).pipe(
      catchError(() => {
        const newLead: Lead = {
          id: `lead-${Date.now()}`,
          name: dto.name,
          company: dto.company,
          email: dto.email,
          phone: dto.phone,
          source: dto.source,
          status: dto.status || 'new' as any,
          value: dto.value || 0,
          notes: dto.notes || '',
          nextFollowUp: dto.nextFollowUp,
          isAutoDiscovered: dto.isAutoDiscovered || false,
          searchKeywords: dto.searchKeywords,
          assignedTo: dto.assignedTo,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.localLeads = [newLead, ...this.localLeads];
        return of(newLead);
      })
    );
  }

  updateLead(id: string, dto: UpdateLeadDto): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${id}`, dto).pipe(
      catchError(() => {
        const idx = this.localLeads.findIndex((l) => l.id === id);
        if (idx >= 0) {
          this.localLeads[idx] = { ...this.localLeads[idx], ...dto } as Lead;
          return of(this.localLeads[idx]);
        }
        return of({} as Lead);
      })
    );
  }

  deleteLead(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError(() => {
        this.localLeads = this.localLeads.filter((l) => l.id !== id);
        return of(undefined as unknown as void);
      })
    );
  }

  getStats(): Observable<LeadStats> {
    return this.http.get<LeadStats>(`${this.baseUrl}/stats/overview`).pipe(
      catchError(() => of(DUMMY_STATS))
    );
  }

  // --- Topics (frontend-only for now) ---

  getTopics(): Observable<Topic[]> {
    return this.topicsSubject.asObservable();
  }

  toggleTopic(topicId: string): void {
    const topics = this.topicsSubject.value.map((t) =>
      t.id === topicId ? { ...t, enabled: !t.enabled } : t
    );
    this.topicsSubject.next(topics);
  }

  addTopic(topic: Omit<Topic, 'id' | 'leadCount'>): void {
    const newTopic: Topic = {
      ...topic,
      id: `topic-${Date.now()}`,
      leadCount: 0,
    };
    this.topicsSubject.next([...this.topicsSubject.value, newTopic]);
  }

  getActiveTopicCount(): number {
    return this.topicsSubject.value.filter((t) => t.enabled).length;
  }

  // --- Flagging (frontend-only for now) ---

  flagLead(
    leadId: string,
    reasons: LeadFlagReason[],
    notes?: string
  ): LeadFlag {
    const flag: LeadFlag = {
      id: `flag-${Date.now()}`,
      leadId,
      reasons,
      notes,
      createdAt: new Date(),
    };
    const existing = this.flagsMap.get(leadId) || [];
    this.flagsMap.set(leadId, [...existing, flag]);
    return flag;
  }

  getLeadFlags(leadId: string): LeadFlag[] {
    return this.flagsMap.get(leadId) || [];
  }

  isLeadFlagged(leadId: string): boolean {
    return (this.flagsMap.get(leadId) || []).length > 0;
  }
}
