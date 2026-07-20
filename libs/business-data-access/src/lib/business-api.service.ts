import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Appointment,
  Availability,
  AvailabilityOverride,
  CreateAvailabilityDto,
  CreateAvailabilityOverrideDto,
  Invoice,
  UpdateAvailabilityDto,
  UpdateAvailabilityOverrideDto,
} from '@optimistic-tanuki/ui-models';
import { BusinessSiteConfig } from './business-site.config';
import { BusinessAuthService } from './business-auth.service';
import {
  AcceptedBusinessClient,
  BusinessAssetLibraryItem,
  BusinessBusyWindow,
  BusinessClientBookingStatus,
  BusinessContactLeadSubmission,
  BusinessLeadIntake,
  BusinessLeadIntakeRecord,
  BusinessOffer,
  BusinessOwnerWorkflowRecord,
  BusinessStoreProduct,
  CreateBusinessBookingRequest,
  CreateProgressCheckIn,
  CreateRoutineAssignment,
  ProgressCheckIn,
  PublicBusinessSiteSummary,
  RoutineAssignment,
  SiteConfigResponse,
} from './business-api.models';

export * from './business-api.models';

@Injectable({
  providedIn: 'root',
})
export class BusinessApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(BusinessAuthService);
  private readonly baseUrl = '/api/business';

  getOffers(siteSlug?: string | null): Observable<BusinessOffer[]> {
    return this.http.get<BusinessOffer[]>(`${this.baseUrl}/offers`, {
      params: siteSlug ? { slug: siteSlug } : undefined,
    });
  }

  getStoreProducts(): Observable<BusinessStoreProduct[]> {
    return this.http.get<BusinessStoreProduct[]>('/api/store/products');
  }

  getOwnerProducts(ownerId: string): Observable<BusinessStoreProduct[]> {
    return this.http.get<BusinessStoreProduct[]>(
      `/api/store/products/owner/${ownerId}`
    );
  }

  getSiteConfig(): Observable<SiteConfigResponse> {
    return this.getSiteConfigForSlug();
  }

  getSiteConfigForSlug(
    siteSlug?: string | null
  ): Observable<SiteConfigResponse> {
    return this.http.get<SiteConfigResponse>(`${this.baseUrl}/site-config`, {
      params: siteSlug ? { slug: siteSlug } : undefined,
    });
  }

  listPublishedSites(): Observable<PublicBusinessSiteSummary[]> {
    return this.http.get<PublicBusinessSiteSummary[]>(`${this.baseUrl}/sites`);
  }

  updateSiteConfig(
    configId: string | null,
    config: BusinessSiteConfig,
    siteSlug?: string | null
  ): Observable<unknown> {
    return this.http.put(
      `${this.baseUrl}/site-config`,
      { configId, config },
      {
        headers: this.authHeaders(),
        params: siteSlug ? { slug: siteSlug } : undefined,
      }
    );
  }

  private authHeaders(): Record<string, string> {
    return this.auth.getAuthHeaders();
  }

  private clientAuthHeaders(): Record<string, string> {
    return this.auth.getClientAuthHeaders();
  }

  getAvailabilities(siteSlug?: string | null): Observable<Availability[]> {
    return this.http.get<Availability[]>(`${this.baseUrl}/availabilities`, {
      params: siteSlug ? { slug: siteSlug } : undefined,
    });
  }

  getAvailabilityOverrides(
    siteSlug?: string | null
  ): Observable<AvailabilityOverride[]> {
    return this.http.get<AvailabilityOverride[]>(
      `${this.baseUrl}/availability-overrides`,
      {
        params: siteSlug ? { slug: siteSlug } : undefined,
      }
    );
  }

  getBusyWindows(siteSlug?: string | null): Observable<BusinessBusyWindow[]> {
    return this.http.get<BusinessBusyWindow[]>(`${this.baseUrl}/busy-windows`, {
      params: siteSlug ? { slug: siteSlug } : undefined,
    });
  }

  createBooking(
    payload: CreateBusinessBookingRequest
  ): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/bookings`, payload);
  }

  createLeadIntake(
    payload: BusinessLeadIntake
  ): Observable<BusinessLeadIntakeRecord> {
    return this.http.post<BusinessLeadIntakeRecord>(
      `${this.baseUrl}/leads`,
      payload,
      {
        headers: this.clientAuthHeaders(),
      }
    );
  }

  submitContactLead(
    payload: BusinessContactLeadSubmission,
    routingProfileId?: string
  ): Observable<{ message: string; leadId: string | null }> {
    return this.http.post<{ message: string; leadId: string | null }>(
      '/api/contact',
      {
        ...payload,
        appScope: 'business-site',
        routingProfileId,
        sourceLabel: 'Business Site',
      },
      {
        headers: this.clientAuthHeaders(),
      }
    );
  }

  getClientBookings(siteSlug?: string | null): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/bookings`, {
      headers: this.clientAuthHeaders(),
      params: siteSlug ? { slug: siteSlug } : undefined,
    });
  }

  getClientBookingStatus(
    siteSlug?: string | null
  ): Observable<BusinessClientBookingStatus> {
    return this.http.get<BusinessClientBookingStatus>(
      `${this.baseUrl}/client-status`,
      {
        headers: this.clientAuthHeaders(),
        params: siteSlug ? { slug: siteSlug } : undefined,
      }
    );
  }

  getOwnerWorkflow(
    siteSlug?: string | null
  ): Observable<BusinessOwnerWorkflowRecord[]> {
    return this.http.get<BusinessOwnerWorkflowRecord[]>(
      `${this.baseUrl}/owner/workflow`,
      {
        headers: this.authHeaders(),
        params: siteSlug ? { slug: siteSlug } : undefined,
      }
    );
  }

  getOwnerBookings(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/owner/bookings`);
  }

  getOwnerProspects(): Observable<BusinessLeadIntakeRecord[]> {
    return this.http.get<BusinessLeadIntakeRecord[]>(
      `${this.baseUrl}/owner/leads`
    );
  }

  markProspectContacted(id: string): Observable<BusinessLeadIntakeRecord> {
    return this.http.put<BusinessLeadIntakeRecord>(
      `${this.baseUrl}/owner/leads/${id}/contacted`,
      {}
    );
  }

  approveProspect(id: string): Observable<BusinessLeadIntakeRecord> {
    return this.http.put<BusinessLeadIntakeRecord>(
      `${this.baseUrl}/owner/leads/${id}/approve`,
      {}
    );
  }

  getAcceptedClients(): Observable<AcceptedBusinessClient[]> {
    return this.http.get<AcceptedBusinessClient[]>(
      `${this.baseUrl}/owner/accepted-clients`
    );
  }

  getOwnerAvailabilities(): Observable<Availability[]> {
    return this.http.get<Availability[]>(
      `${this.baseUrl}/owner/availabilities`
    );
  }

  createOwnerAvailability(
    payload: CreateAvailabilityDto
  ): Observable<Availability> {
    return this.http.post<Availability>(
      `${this.baseUrl}/owner/availabilities`,
      payload
    );
  }

  updateOwnerAvailability(
    id: string,
    payload: UpdateAvailabilityDto
  ): Observable<Availability> {
    return this.http.put<Availability>(
      `${this.baseUrl}/owner/availabilities/${id}`,
      payload
    );
  }

  removeOwnerAvailability(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/owner/availabilities/${id}`);
  }

  getOwnerAvailabilityOverrides(): Observable<AvailabilityOverride[]> {
    return this.http.get<AvailabilityOverride[]>(
      `${this.baseUrl}/owner/availability-overrides`
    );
  }

  createOwnerAvailabilityOverride(
    payload: CreateAvailabilityOverrideDto
  ): Observable<AvailabilityOverride> {
    return this.http.post<AvailabilityOverride>(
      `${this.baseUrl}/owner/availability-overrides`,
      payload
    );
  }

  updateOwnerAvailabilityOverride(
    id: string,
    payload: UpdateAvailabilityOverrideDto
  ): Observable<AvailabilityOverride> {
    return this.http.put<AvailabilityOverride>(
      `${this.baseUrl}/owner/availability-overrides/${id}`,
      payload
    );
  }

  removeOwnerAvailabilityOverride(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/owner/availability-overrides/${id}`
    );
  }

  approveBooking(id: string, hourlyRate = 120): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${this.baseUrl}/owner/bookings/${id}/approve`,
      { hourlyRate, notes: 'Approved in the workspace.' }
    );
  }

  completeBooking(id: string): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${this.baseUrl}/owner/bookings/${id}/complete`,
      {}
    );
  }

  generateInvoice(id: string): Observable<Invoice> {
    return this.http.post<Invoice>(
      `${this.baseUrl}/owner/bookings/${id}/invoice`,
      {}
    );
  }

  getClientRoutines(
    clientId: string,
    siteSlug?: string | null
  ): Observable<RoutineAssignment[]> {
    return this.http.get<RoutineAssignment[]>(
      `${this.baseUrl}/client/routines`,
      { params: siteSlug ? { clientId, slug: siteSlug } : { clientId } }
    );
  }

  completeClientRoutine(
    id: string,
    siteSlug?: string | null
  ): Observable<RoutineAssignment> {
    return this.http.post<RoutineAssignment>(
      `${this.baseUrl}/client/routines/${id}/complete`,
      {},
      {
        headers: this.clientAuthHeaders(),
        params: siteSlug ? { slug: siteSlug } : undefined,
      }
    );
  }

  getAllRoutines(): Observable<RoutineAssignment[]> {
    return this.http.get<RoutineAssignment[]>(`${this.baseUrl}/owner/routines`);
  }

  assignRoutine(
    payload: CreateRoutineAssignment
  ): Observable<RoutineAssignment> {
    return this.http.post<RoutineAssignment>(
      `${this.baseUrl}/owner/routines`,
      payload
    );
  }

  getClientCheckIns(
    clientId: string,
    siteSlug?: string | null
  ): Observable<ProgressCheckIn[]> {
    return this.http.get<ProgressCheckIn[]>(
      `${this.baseUrl}/client/check-ins`,
      { params: siteSlug ? { clientId, slug: siteSlug } : { clientId } }
    );
  }

  getAllCheckIns(): Observable<ProgressCheckIn[]> {
    return this.http.get<ProgressCheckIn[]>(`${this.baseUrl}/owner/check-ins`);
  }

  submitCheckIn(
    payload: CreateProgressCheckIn & { siteSlug?: string }
  ): Observable<ProgressCheckIn> {
    return this.http.post<ProgressCheckIn>(
      `${this.baseUrl}/client/check-ins`,
      payload
    );
  }

  getClientInvoices(siteSlug?: string | null): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.baseUrl}/client/invoices`, {
      headers: this.clientAuthHeaders(),
      params: siteSlug ? { slug: siteSlug } : undefined,
    });
  }

  payClientInvoice(id: string, siteSlug?: string | null): Observable<Invoice> {
    return this.http.post<Invoice>(
      `${this.baseUrl}/client/invoices/${id}/pay`,
      {},
      {
        headers: this.clientAuthHeaders(),
        params: siteSlug ? { slug: siteSlug } : undefined,
      }
    );
  }

  listAssets(
    profileId: string,
    type = 'image'
  ): Observable<BusinessAssetLibraryItem[]> {
    return this.http.get<BusinessAssetLibraryItem[]>(`/api/asset`, {
      headers: this.authHeaders(),
      params: { profileId, type },
    });
  }
}
