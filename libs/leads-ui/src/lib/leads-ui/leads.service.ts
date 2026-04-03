import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Lead, LeadStats } from '@optimistic-tanuki/models';
import { CreateLeadDto } from '@optimistic-tanuki/models';
import { UpdateLeadDto } from '@optimistic-tanuki/models';

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/leads';

  getLeads(): Observable<Lead[]> {
    return this.http.get<Lead[]>(this.baseUrl);
  }

  getLead(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.baseUrl}/${id}`);
  }

  createLead(dto: CreateLeadDto): Observable<Lead> {
    return this.http.post<Lead>(this.baseUrl, dto);
  }

  updateLead(id: string, dto: UpdateLeadDto): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${id}`, dto);
  }

  deleteLead(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getStats(): Observable<LeadStats> {
    return this.http.get<LeadStats>(`${this.baseUrl}/stats/overview`);
  }
}
