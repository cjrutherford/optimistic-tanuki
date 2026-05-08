import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LeadSource, LeadStatus } from '@optimistic-tanuki/models';
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

export interface BusinessOffer {
  id: string;
  label: string;
  description: string;
  serviceType: string;
  startingRate: number;
  allowOnlineBooking?: boolean;
}

export interface BusinessBusyWindow {
  startTime: string;
  endTime: string;
}

export interface RoutineAssignment {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  summary: string;
  focusAreas: string[];
  status?: 'assigned' | 'completed';
  completedAt?: string | null;
  createdAt: string;
}

export interface ProgressCheckIn {
  id: string;
  clientId: string;
  assignmentId: string;
  notes: string;
  energy: number;
  completedAt: string;
}

export interface CreateRoutineAssignment {
  clientId: string;
  clientName: string;
  title: string;
  summary: string;
  focusAreas: string[];
}

export interface CreateProgressCheckIn {
  clientId: string;
  assignmentId: string;
  notes: string;
  energy: number;
}

export interface SiteConfigResponse {
  configId: string | null;
  config: BusinessSiteConfig | null;
}

export interface CreateBusinessBookingRequest {
  resourceId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isFreeConsultation?: boolean;
  notes?: string;
}

export interface BusinessLeadIntake {
  name: string;
  email?: string;
  phone?: string;
  goal: string;
  context?: string;
  preferredStart?: string;
  preferredEnd?: string;
  userId?: string;
  profileId?: string;
}

export interface BusinessLeadIntakeRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: LeadStatus | string;
  source: LeadSource | string;
  notes?: string;
  accountStatus: 'No account' | 'Registered' | 'Linked client';
}

export interface BusinessClientBookingStatus {
  accepted: boolean;
  leadId?: string | null;
  leadStatus?: LeadStatus | string | null;
}

export interface AcceptedBusinessClient {
  leadId: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  leadStatus: LeadStatus | string;
}

export interface BusinessAssetLibraryItem {
  id: string;
  name: string;
  type: string;
  profileId: string;
  url: string;
}

@Injectable({
  providedIn: 'root',
})
export class BusinessApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(BusinessAuthService);
  private readonly baseUrl = '/api/business';

  getOffers(): Observable<BusinessOffer[]> {
    return this.http.get<BusinessOffer[]>(`${this.baseUrl}/offers`);
  }

  getSiteConfig(): Observable<SiteConfigResponse> {
    return this.http.get<SiteConfigResponse>(`${this.baseUrl}/site-config`);
  }

  updateSiteConfig(
    configId: string | null,
    config: BusinessSiteConfig
  ): Observable<unknown> {
    return this.http.put(
      `${this.baseUrl}/site-config`,
      { configId, config },
      { headers: this.authHeaders() }
    );
  }

  private authHeaders(): Record<string, string> {
    return this.auth.getAuthHeaders();
  }

  private clientAuthHeaders(): Record<string, string> {
    return this.auth.getClientAuthHeaders();
  }

  getAvailabilities(): Observable<Availability[]> {
    return this.http.get<Availability[]>(`${this.baseUrl}/availabilities`);
  }

  getAvailabilityOverrides(): Observable<AvailabilityOverride[]> {
    return this.http.get<AvailabilityOverride[]>(
      `${this.baseUrl}/availability-overrides`
    );
  }

  getBusyWindows(): Observable<BusinessBusyWindow[]> {
    return this.http.get<BusinessBusyWindow[]>(`${this.baseUrl}/busy-windows`);
  }

  createBooking(payload: CreateBusinessBookingRequest): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/bookings`, payload);
  }

  createLeadIntake(payload: BusinessLeadIntake): Observable<BusinessLeadIntakeRecord> {
    return this.http.post<BusinessLeadIntakeRecord>(`${this.baseUrl}/leads`, payload, {
      headers: this.clientAuthHeaders(),
    });
  }

  getClientBookings(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/bookings`, {
      headers: this.clientAuthHeaders(),
    });
  }

  getClientBookingStatus(): Observable<BusinessClientBookingStatus> {
    return this.http.get<BusinessClientBookingStatus>(`${this.baseUrl}/client-status`, {
      headers: this.clientAuthHeaders(),
    });
  }

  getOwnerBookings(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/owner/bookings`);
  }

  getOwnerProspects(): Observable<BusinessLeadIntakeRecord[]> {
    return this.http.get<BusinessLeadIntakeRecord[]>(`${this.baseUrl}/owner/leads`);
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
    return this.http.get<Availability[]>(`${this.baseUrl}/owner/availabilities`);
  }

  createOwnerAvailability(payload: CreateAvailabilityDto): Observable<Availability> {
    return this.http.post<Availability>(`${this.baseUrl}/owner/availabilities`, payload);
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

  getClientRoutines(clientId: string): Observable<RoutineAssignment[]> {
    return this.http.get<RoutineAssignment[]>(
      `${this.baseUrl}/client/routines`,
      { params: { clientId } }
    );
  }

  completeClientRoutine(id: string): Observable<RoutineAssignment> {
    return this.http.post<RoutineAssignment>(
      `${this.baseUrl}/client/routines/${id}/complete`,
      {},
      { headers: this.clientAuthHeaders() }
    );
  }

  getAllRoutines(): Observable<RoutineAssignment[]> {
    return this.http.get<RoutineAssignment[]>(`${this.baseUrl}/owner/routines`);
  }

  assignRoutine(payload: CreateRoutineAssignment): Observable<RoutineAssignment> {
    return this.http.post<RoutineAssignment>(
      `${this.baseUrl}/owner/routines`,
      payload
    );
  }

  getClientCheckIns(clientId: string): Observable<ProgressCheckIn[]> {
    return this.http.get<ProgressCheckIn[]>(
      `${this.baseUrl}/client/check-ins`,
      { params: { clientId } }
    );
  }

  getAllCheckIns(): Observable<ProgressCheckIn[]> {
    return this.http.get<ProgressCheckIn[]>(`${this.baseUrl}/owner/check-ins`);
  }

  submitCheckIn(payload: CreateProgressCheckIn): Observable<ProgressCheckIn> {
    return this.http.post<ProgressCheckIn>(
      `${this.baseUrl}/client/check-ins`,
      payload
    );
  }

  getClientInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.baseUrl}/client/invoices`, {
      headers: this.clientAuthHeaders(),
    });
  }

  payClientInvoice(id: string): Observable<Invoice> {
    return this.http.post<Invoice>(
      `${this.baseUrl}/client/invoices/${id}/pay`,
      {},
      { headers: this.clientAuthHeaders() }
    );
  }

  listAssets(profileId: string, type = 'image'): Observable<BusinessAssetLibraryItem[]> {
    return this.http.get<BusinessAssetLibraryItem[]>(`/api/asset`, {
      headers: this.authHeaders(),
      params: { profileId, type },
    });
  }
}
