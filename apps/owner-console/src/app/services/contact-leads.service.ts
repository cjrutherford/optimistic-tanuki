import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Lead,
  SendLeadResponseDto,
  UpdateLeadDto,
} from '@optimistic-tanuki/ui-models';

export interface LeadResponseResult {
  lead: Lead;
  delivery: {
    success: boolean;
    error?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ContactLeadsService {
  private readonly baseUrl = '/api/contact/leads';

  constructor(private readonly http: HttpClient) {}

  getLeads(filters?: {
    status?: string;
    source?: string;
    appScope?: string;
  }): Observable<Lead[]> {
    let params = new HttpParams();
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.source) {
      params = params.set('source', filters.source);
    }
    if (filters?.appScope) {
      params = params.set('appScope', filters.appScope);
    }
    return this.http.get<Lead[]>(this.baseUrl, { params });
  }

  getLead(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.baseUrl}/${id}`);
  }

  updateLead(id: string, dto: UpdateLeadDto): Observable<Lead> {
    return this.http.patch<Lead>(`${this.baseUrl}/${id}`, dto);
  }

  respondToLead(
    id: string,
    dto: SendLeadResponseDto
  ): Observable<LeadResponseResult> {
    return this.http.post<LeadResponseResult>(
      `${this.baseUrl}/${id}/respond`,
      dto
    );
  }
}
