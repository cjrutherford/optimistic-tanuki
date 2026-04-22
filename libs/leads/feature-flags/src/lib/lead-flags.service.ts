import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateLeadFlagDto,
  LeadFlag,
} from '@optimistic-tanuki/leads-contracts';

@Injectable({ providedIn: 'root' })
export class LeadFlagsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/leads';

  getLeadFlags(leadId: string): Observable<LeadFlag[]> {
    return this.http.get<LeadFlag[]>(`${this.baseUrl}/${leadId}/flags`);
  }

  flagLead(leadId: string, dto: CreateLeadFlagDto): Observable<LeadFlag> {
    return this.http.post<LeadFlag>(`${this.baseUrl}/${leadId}/flags`, dto);
  }
}
