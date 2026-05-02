import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Appointment, Availability, Invoice } from '@optimistic-tanuki/ui-models';
import { TrainerSiteConfig } from './trainer-site.config';

export interface TrainerOffer {
  id: string;
  label: string;
  description: string;
  serviceType: string;
  startingRate: number;
}

export interface RoutineAssignment {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  summary: string;
  focusAreas: string[];
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
  config: TrainerSiteConfig | null;
}

export interface CreateTrainerBookingRequest {
  userId: string;
  resourceId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  notes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TrainerApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/trainer';

  getOffers(): Observable<TrainerOffer[]> {
    return this.http.get<TrainerOffer[]>(`${this.baseUrl}/offers`);
  }

  getSiteConfig(): Observable<SiteConfigResponse> {
    return this.http.get<SiteConfigResponse>(`${this.baseUrl}/site-config`);
  }

  updateSiteConfig(
    configId: string | null,
    config: TrainerSiteConfig
  ): Observable<unknown> {
    return this.http.put(
      `${this.baseUrl}/site-config`,
      { configId, config },
      { headers: this.authHeaders() }
    );
  }

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('trainer_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  getAvailabilities(): Observable<Availability[]> {
    return this.http.get<Availability[]>(`${this.baseUrl}/availabilities`);
  }

  createBooking(payload: CreateTrainerBookingRequest): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/bookings`, payload);
  }

  getClientBookings(userId: string): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/bookings`, {
      params: { userId },
    });
  }

  getOwnerBookings(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.baseUrl}/owner/bookings`);
  }

  approveBooking(id: string, hourlyRate = 120): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${this.baseUrl}/owner/bookings/${id}/approve`,
      { hourlyRate, notes: 'Approved in the trainer workspace.' }
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

  submitCheckIn(payload: CreateProgressCheckIn): Observable<ProgressCheckIn> {
    return this.http.post<ProgressCheckIn>(
      `${this.baseUrl}/client/check-ins`,
      payload
    );
  }
}
