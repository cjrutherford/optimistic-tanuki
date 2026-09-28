import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, throwError } from 'rxjs';
import {
  Lead,
  SendLeadResponseDto,
  UpdateLeadDto,
} from '@optimistic-tanuki/ui-models';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/blogging-data-access';

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
  private readonly blogging = inject(OptomisitcTanukiAPIService);
  private readonly http = inject(HttpClient);

  private getHaiLeads(filters?: {
    status?: string;
    source?: string;
  }): Observable<Lead[]> {
    return this.http
      .get<Lead[]>('/api/contact/hai/leads', {
        params: {
          ...(filters?.status ? { status: filters.status } : {}),
          ...(filters?.source ? { source: filters.source } : {}),
        },
      })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          error.status === 403 ? of([]) : throwError(() => error)
        )
      );
  }

  getLeads(filters?: {
    status?: string;
    source?: string;
    appScope?: string;
  }): Observable<Lead[]> {
    const { status, source, appScope } = filters || {};
    const ordinaryLeads = this.blogging.contactControllerFindAllLeads<Lead[]>({
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(appScope && appScope !== 'hai' ? { appScope } : {}),
    });
    if (appScope === 'hai') {
      return this.getHaiLeads({ status, source });
    }
    if (appScope) {
      return ordinaryLeads;
    }
    return forkJoin([ordinaryLeads, this.getHaiLeads({ status, source })]).pipe(
      map(([ordinary, hai]) => [...ordinary, ...hai])
    );
  }

  getLead(id: string, appScope?: string): Observable<Lead> {
    return appScope === 'hai'
      ? this.http.get<Lead>(`/api/contact/hai/leads/${encodeURIComponent(id)}`)
      : this.blogging.contactControllerGetLead<Lead>(id);
  }

  updateLead(
    id: string,
    dto: UpdateLeadDto,
    appScope?: string
  ): Observable<Lead> {
    if (appScope === 'hai') {
      return this.http.patch<Lead>(
        `/api/contact/hai/leads/${encodeURIComponent(id)}`,
        dto
      );
    }
    // Generated body types for these Record-bodied routes are free-form
    // index signatures; spreading keeps the exact wire shape.
    return this.blogging.contactControllerUpdateLead<Lead>(id, { ...dto });
  }

  respondToLead(
    id: string,
    dto: SendLeadResponseDto,
    appScope?: string
  ): Observable<LeadResponseResult> {
    if (appScope === 'hai') {
      return this.http.post<LeadResponseResult>(
        `/api/contact/hai/leads/${encodeURIComponent(id)}/respond`,
        dto
      );
    }
    return this.blogging.contactControllerRespondToLead<LeadResponseResult>(
      id,
      { ...dto }
    );
  }
}
