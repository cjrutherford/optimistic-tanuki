import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

  getLeads(filters?: {
    status?: string;
    source?: string;
    appScope?: string;
  }): Observable<Lead[]> {
    const { status, source, appScope } = filters || {};
    return this.blogging.contactControllerFindAllLeads<Lead[]>({
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(appScope ? { appScope } : {}),
    });
  }

  getLead(id: string): Observable<Lead> {
    return this.blogging.contactControllerGetLead<Lead>(id);
  }

  updateLead(id: string, dto: UpdateLeadDto): Observable<Lead> {
    // Generated body types for these Record-bodied routes are free-form
    // index signatures; spreading keeps the exact wire shape.
    return this.blogging.contactControllerUpdateLead<Lead>(id, { ...dto });
  }

  respondToLead(
    id: string,
    dto: SendLeadResponseDto
  ): Observable<LeadResponseResult> {
    return this.blogging.contactControllerRespondToLead<LeadResponseResult>(
      id,
      { ...dto }
    );
  }
}
