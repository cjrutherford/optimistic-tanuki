import { Injectable, inject, signal } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import {
  Observable,
  catchError,
  from,
  map,
  mergeMap,
  tap,
  throwError,
} from 'rxjs';
import {
  CustomerBookingDetails,
  DepositPaymentRequest,
  DepositPaymentResponse,
  EstimateCalculation,
  EstimateParameters,
  FlowAvailabilityQuery,
  JobRecord,
  ServiceArrivalWindow,
  OfflineSyncItem,
  ServicePackage,
  ResolvedFlowTenant,
  TenantResolutionState,
} from '../models/field-flow.models';
import type {
  FlowBookingResponse,
  FlowEstimateResponse,
  FlowPaymentIntentResponse,
  FlowAvailabilityResponse,
  JobStatusDto,
} from '@optimistic-tanuki/models';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';
import { FieldFlowSyncService } from './field-flow-sync.service';

export const FLOW_ESTIMATES_PATH = '/api/v1/flow/estimates';
export const FLOW_BOOKINGS_PATH = '/api/v1/flow/bookings';
export const FLOW_DEPOSIT_PATH = '/api/v1/flow/payments/deposit';
export const FLOW_AVAILABILITY_PATH = '/api/v1/flow/availability';
export const FLOW_STATUS_PATH = '/api/v1/flow/status';
export const FLOW_TENANT_PATH = '/api/v1/flow/tenant';

type FlowBookingWireResponse = FlowBookingResponse & {
  id?: string;
};

type FlowPaymentWireResponse = FlowPaymentIntentResponse & {
  id?: string;
  paymentId?: string;
};

export type FlowStatusLookupOptions = {
  offline?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class FieldFlowApiService {
  private readonly http = inject(HttpClient);
  private readonly brandConfig = inject(BrandConfigService);
  private readonly syncService = inject(FieldFlowSyncService);

  readonly activeEstimate = signal<EstimateCalculation | null>(null);
  readonly activeBooking = signal<CustomerBookingDetails | null>(null);
  readonly currentJob = signal<JobRecord | null>(null);
  readonly tenantResolutionState = signal<TenantResolutionState>('idle');
  readonly tenantResolutionError = signal<string | null>(null);
  readonly resolvedTenant = signal<ResolvedFlowTenant | null>(null);
  private activeEstimateFingerprint: string | null = null;

  initializeTenant(): Observable<ResolvedFlowTenant> {
    this.brandConfig.clearResolvedBrand();
    this.resolvedTenant.set(null);
    this.tenantResolutionError.set(null);
    this.tenantResolutionState.set('loading');

    return this.http
      .get<unknown>(FLOW_TENANT_PATH, { withCredentials: true })
      .pipe(
        map((response) => this.toResolvedTenant(response)),
        tap((tenant) => {
          if (!this.brandConfig.resolveBrandProfile(tenant.profileId)) {
            throw new Error(
              `No Field Flow profile is configured for tenant ${tenant.tenantId}`
            );
          }
          this.resolvedTenant.set(tenant);
          this.tenantResolutionState.set('resolved');
        }),
        catchError((error: unknown) => {
          this.brandConfig.clearResolvedBrand();
          this.resolvedTenant.set(null);
          this.tenantResolutionState.set('error');
          this.tenantResolutionError.set(this.tenantErrorMessage(error));
          return throwError(() => error);
        })
      );
  }

  loadTenant(): Observable<ResolvedFlowTenant> {
    return this.initializeTenant();
  }

  getTenantServices(): ServicePackage[] {
    const brand = this.brandConfig.getResolvedBrand();
    if (!brand?.services?.length) {
      return [];
    }
    return brand.services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      basePrice: 0,
      durationHours: service.durationHours,
      features: service.features,
    }));
  }

  getAvailability(
    query: FlowAvailabilityQuery
  ): Observable<FlowAvailabilityResponse> {
    if (
      !this.isNonEmptyString(query.serviceId) ||
      !this.isIsoDate(query.date) ||
      (query.size !== undefined &&
        !['compact', 'midsize', 'large', 'commercial'].includes(query.size)) ||
      (query.condition !== undefined &&
        !['light', 'moderate', 'heavy', 'severe'].includes(query.condition))
    ) {
      return this.invalidRequest('A valid service and date are required');
    }

    let params = new HttpParams()
      .set('serviceId', query.serviceId)
      .set('date', query.date);
    if (query.size) {
      params = params.set('size', query.size);
    }
    if (query.condition) {
      params = params.set('condition', query.condition);
    }

    return this.http
      .get<FlowAvailabilityResponse>(FLOW_AVAILABILITY_PATH, { params })
      .pipe(
        map((response) =>
          this.requireAvailabilityResponse(response, query.date)
        )
      );
  }

  calculateEstimate(params: EstimateParameters): EstimateCalculation {
    const current = this.activeEstimate();
    const fingerprint = this.estimateParameterFingerprint(params);
    if (current && this.activeEstimateFingerprint === fingerprint) {
      return current;
    }

    const selected = this.getTenantServices().find(
      (service) => service.id === params.servicePackage
    );
    const packageDetails: ServicePackage = selected
      ? { ...selected, basePrice: 0 }
      : {
          id: params.servicePackage,
          name: params.servicePackage,
          description: '',
          basePrice: 0,
          durationHours: 0,
          features: [],
        };

    return {
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      depositAmount: 0,
      taxRate: 0,
      packageDetails,
      isAuthoritative: false,
    };
  }

  dispatchEstimate(
    params: EstimateParameters,
    _legacyCalculation?: EstimateCalculation
  ): Observable<FlowEstimateResponse> {
    this.activeEstimate.set(null);
    this.activeEstimateFingerprint = null;
    const payload = this.toEstimatePayload(params);
    if (!payload) {
      return this.invalidRequest(
        'A valid service, package, size, and condition are required'
      );
    }

    const queuePayload = {
      request: payload,
      idempotencyKey: this.createIdempotencyKey('estimate'),
    };

    return this.http
      .post<FlowEstimateResponse>(FLOW_ESTIMATES_PATH, payload)
      .pipe(
        map((response) => {
          this.setActiveEstimate(
            response,
            this.estimateParameterFingerprint(params)
          );
          return response;
        }),
        catchError((error: unknown) =>
          this.enqueueAndPropagate('estimate', queuePayload, error)
        )
      );
  }

  createBooking(
    details: CustomerBookingDetails
  ): Observable<FlowBookingResponse> {
    const estimate = this.activeEstimate();
    const payload = this.toBookingPayload(details, estimate);
    if (!payload) {
      return this.invalidRequest(
        'A server estimate and valid booking/contact fields are required'
      );
    }

    const queuePayload = {
      request: payload,
      idempotencyKey: this.createIdempotencyKey('booking'),
    };

    return this.http
      .post<FlowBookingWireResponse>(FLOW_BOOKINGS_PATH, payload)
      .pipe(
        map((response) => {
          const booking = this.requireBookingResponse(response);
          this.activeBooking.set({
            ...details,
            bookingId: booking.bookingId,
            ...(booking.trackingCode
              ? { trackingCode: booking.trackingCode }
              : {}),
            status: booking.status,
          });
          return booking;
        }),
        catchError((error: unknown) =>
          this.enqueueAndPropagate('booking', queuePayload, error)
        )
      );
  }

  submitDeposit(
    request: DepositPaymentRequest
  ): Observable<DepositPaymentResponse> {
    const payload = this.toDepositPayload(request);
    if (!payload) {
      return this.invalidRequest(
        'A booking or tracking code and idempotency key are required'
      );
    }

    const queuePayload = {
      request: payload,
      idempotencyKey: payload['idempotencyKey'],
    };

    return this.http
      .post<FlowPaymentWireResponse>(FLOW_DEPOSIT_PATH, payload)
      .pipe(
        map((response) => this.requirePaymentResponse(response)),
        catchError((error: unknown) =>
          this.enqueueAndPropagate('payment', queuePayload, error)
        )
      );
  }

  getJobStatus(
    id: string,
    options: FlowStatusLookupOptions | boolean = {}
  ): Observable<JobRecord> {
    if (!this.isNonEmptyString(id)) {
      return this.invalidRequest('A job id is required');
    }

    const explicitlyOffline =
      typeof options === 'boolean' ? options : options.offline === true;
    const offline = explicitlyOffline || !this.syncService.isOnline();

    if (offline) {
      return this.readCachedStatus(id);
    }

    return this.http
      .get<JobStatusDto>(`${FLOW_STATUS_PATH}/${encodeURIComponent(id)}`)
      .pipe(
        map((response) => {
          const job = this.toJobRecord(response);
          this.cacheJobForLookup(job, id);
          return job;
        }),
        catchError((error: unknown) => {
          if (explicitlyOffline || !this.syncService.isOnline()) {
            return this.readCachedStatus(id);
          }
          return throwError(() => error);
        })
      );
  }

  private requireAvailabilityResponse(
    response: FlowAvailabilityResponse,
    expectedDate: string
  ): FlowAvailabilityResponse {
    if (
      !response ||
      response.date !== expectedDate ||
      !Array.isArray(response.windows)
    ) {
      throw new Error('Flow availability response is invalid');
    }
    const windows = response.windows.map((window) => {
      if (
        !this.isNonEmptyString(window.id) ||
        !this.isNonEmptyString(window.timeSlot) ||
        typeof window.available !== 'boolean'
      ) {
        throw new Error('Flow availability response is invalid');
      }
      return {
        id: window.id,
        timeSlot: window.timeSlot,
        available: window.available,
      };
    });
    return { date: response.date, windows };
  }

  private isUsableEstimate(estimate: EstimateCalculation): boolean {
    return (
      estimate.isAuthoritative === true &&
      this.isNonEmptyString(estimate.estimateId) &&
      this.isNonEmptyString(estimate.serviceId) &&
      this.isNonEmptyString(estimate.expiresAt) &&
      Number.isFinite(Date.parse(estimate.expiresAt)) &&
      Date.parse(estimate.expiresAt) > Date.now()
    );
  }

  private toEstimatePayload(
    params: EstimateParameters
  ): Record<string, unknown> | null {
    if (
      !this.isNonEmptyString(params.servicePackage) ||
      !this.isNonEmptyString(params.tradeType) ||
      !['compact', 'midsize', 'large', 'commercial'].includes(params.size) ||
      !['light', 'moderate', 'heavy', 'severe'].includes(params.condition) ||
      (params.squareFootage !== undefined &&
        (!Number.isFinite(params.squareFootage) || params.squareFootage < 1))
    ) {
      return null;
    }

    const payload: Record<string, unknown> = {
      serviceId: params.servicePackage,
      servicePackage: params.servicePackage,
      size: params.size,
      condition: params.condition,
    };
    if (params.squareFootage !== undefined) {
      payload['squareFootage'] = params.squareFootage;
    }
    if (params.tradeType) {
      payload['tradeType'] = params.tradeType;
    }
    return payload;
  }

  private toBookingPayload(
    details: CustomerBookingDetails,
    estimate: EstimateCalculation | null
  ): Record<string, unknown> | null {
    if (
      !estimate ||
      !this.isUsableEstimate(estimate) ||
      !this.isNonEmptyString(estimate.estimateId) ||
      !this.isNonEmptyString(estimate.serviceId) ||
      !this.isNonEmptyString(details.fullName) ||
      !this.isValidPhone(details.mobilePhone) ||
      !this.isValidEmail(details.emailAddress) ||
      !this.isNonEmptyString(details.streetAddress) ||
      !this.isIsoDate(details.selectedDate) ||
      !this.isNonEmptyString(details.selectedWindow) ||
      !Array.isArray(details.uploadedPhotoUrls)
    ) {
      return null;
    }

    const payload: Record<string, unknown> = {
      estimateId: estimate.estimateId,
      serviceId: estimate.serviceId,
      servicePackage: estimate.serviceId,
      customerName: details.fullName.trim(),
      customerPhone: details.mobilePhone.trim(),
      customerEmail: details.emailAddress?.trim(),
      serviceAddress: details.streetAddress.trim(),
      scheduledDate: details.selectedDate,
      arrivalWindow: details.selectedWindow.trim(),
      photoUrls: details.photoUrls ?? details.uploadedPhotoUrls,
    };

    if (details.gateCode?.trim()) {
      payload['gateCode'] = details.gateCode.trim();
    }
    if (details.serviceNotes?.trim()) {
      payload['notes'] = details.serviceNotes.trim();
    }
    return payload;
  }

  private toDepositPayload(
    request: DepositPaymentRequest
  ): Record<string, string> | null {
    const bookingId = this.nonEmptyOrUndefined(request.bookingId);
    const trackingCode = this.nonEmptyOrUndefined(request.trackingCode);
    const idempotencyKey =
      this.nonEmptyOrUndefined(request.idempotencyKey) ??
      this.createIdempotencyKey('deposit');
    const hasBooking = Boolean(bookingId);
    const hasTracking = Boolean(trackingCode);

    if (hasBooking === hasTracking) {
      return null;
    }

    const payload: Record<string, string> = { idempotencyKey };
    if (bookingId) {
      payload['bookingId'] = bookingId;
    }
    if (trackingCode) {
      payload['trackingCode'] = trackingCode;
    }
    return payload;
  }

  private setActiveEstimate(
    response: FlowEstimateResponse,
    fingerprint: string
  ): void {
    if (
      !this.isNonEmptyString(response.estimateId) ||
      !this.isNonEmptyString(response.serviceId) ||
      !this.isNonEmptyString(response.serviceName) ||
      !this.isFiniteNumber(response.basePrice) ||
      !this.isFiniteNumber(response.conditionMultiplier) ||
      !this.isFiniteNumber(response.subtotal) ||
      !this.isFiniteNumber(response.taxAmount) ||
      !this.isFiniteNumber(response.total) ||
      !this.isFiniteNumber(response.depositRequired) ||
      !this.isNonEmptyString(response.currency) ||
      !this.isNonEmptyString(response.expiresAt)
    ) {
      throw new Error('Flow estimate response is missing authoritative values');
    }

    const service = this.getTenantServices().find(
      (candidate) => candidate.id === response.serviceId
    );
    const packageDetails: ServicePackage = service
      ? { ...service, basePrice: 0 }
      : {
          id: response.serviceId,
          name: response.serviceName,
          description: '',
          basePrice: 0,
          durationHours: 0,
          features: [],
        };

    this.activeEstimate.set({
      estimateId: response.estimateId,
      serviceId: response.serviceId,
      serviceName: response.serviceName,
      subtotal: response.subtotal,
      taxAmount: response.taxAmount,
      total: response.total,
      depositAmount: response.depositRequired,
      depositRequired: response.depositRequired,
      taxRate: 0,
      packageDetails,
      currency: response.currency,
      expiresAt: response.expiresAt,
      isAuthoritative: true,
    });
    this.activeEstimateFingerprint = fingerprint;
  }

  private requireBookingResponse(
    response: FlowBookingWireResponse
  ): FlowBookingResponse {
    const bookingId = response.bookingId ?? response.id;
    if (
      !this.isNonEmptyString(bookingId) ||
      !this.isNonEmptyString(response.status)
    ) {
      throw new Error(
        'Flow booking response did not include a server id and status'
      );
    }
    if (response.bookingId) {
      return response;
    }
    return { ...response, bookingId };
  }

  private requirePaymentResponse(
    response: FlowPaymentWireResponse
  ): DepositPaymentResponse {
    const paymentIntentId =
      response.paymentIntentId ?? response.id ?? response.paymentId;
    if (
      !this.isNonEmptyString(paymentIntentId) ||
      !this.isNonEmptyString(response.status) ||
      !this.isFiniteNumber(response.amount) ||
      !this.isNonEmptyString(response.currency)
    ) {
      throw new Error(
        'Flow payment response did not include authoritative payment values'
      );
    }

    const payment: DepositPaymentResponse = {
      paymentIntentId,
      status: response.status,
      amount: response.amount,
      currency: response.currency,
    };
    if (response.clientSecret !== undefined) {
      payment.clientSecret = response.clientSecret;
    }
    if (response.bookingId !== undefined) {
      payment.bookingId = response.bookingId;
    }
    if (response.trackingCode !== undefined) {
      payment.trackingCode = response.trackingCode;
    }
    if (response.smsConfirmation !== undefined) {
      payment.smsConfirmation = response.smsConfirmation;
    }
    return payment;
  }

  private toJobRecord(response: JobStatusDto): JobRecord {
    const validStatuses = [
      'scheduled',
      'en_route',
      'in_progress',
      'completed',
      'cancelled',
    ];
    if (
      !this.isNonEmptyString(response.id) ||
      !this.isNonEmptyString(response.bookingId) ||
      !this.isNonEmptyString(response.status) ||
      !validStatuses.includes(response.status) ||
      !this.isNonEmptyString(response.customerName) ||
      !this.isNonEmptyString(response.serviceName) ||
      !this.isNonEmptyString(response.serviceAddress) ||
      !this.isNonEmptyString(response.scheduledDate) ||
      !this.isNonEmptyString(response.arrivalWindow) ||
      typeof response.depositPaid !== 'boolean' ||
      !this.isFiniteNumber(response.totalAmount) ||
      (response.depositAmount !== undefined &&
        !this.isFiniteNumber(response.depositAmount)) ||
      typeof response.reviewPromptEligible !== 'boolean' ||
      !this.isNonEmptyString(response.updatedAt) ||
      (response.trackingCode !== undefined &&
        !this.isNonEmptyString(response.trackingCode))
    ) {
      throw new Error(
        'Flow status response did not include a valid job status'
      );
    }

    const totalPrice = this.isFiniteNumber(response.totalAmount)
      ? response.totalAmount
      : undefined;
    const depositPaid = this.isFiniteNumber(response.depositAmount)
      ? response.depositAmount
      : undefined;
    const balanceRemaining =
      totalPrice !== undefined && depositPaid !== undefined
        ? totalPrice - depositPaid
        : undefined;
    const trackingNumber = this.isNonEmptyString(response.trackingCode)
      ? response.trackingCode
      : undefined;

    const job: JobRecord = {
      id: response.id,
      status: response.status,
      reviewPromptEligible: response.reviewPromptEligible,
    };
    if (trackingNumber !== undefined) {
      job.trackingNumber = trackingNumber;
    }
    if (response.customerName !== undefined) {
      job.customerName = response.customerName;
    }
    if (response.customerPhone !== undefined) {
      job.customerPhone = response.customerPhone;
    }
    if (response.serviceAddress !== undefined) {
      job.streetAddress = response.serviceAddress;
    }
    if (response.serviceName !== undefined) {
      job.servicePackageName = response.serviceName;
    }
    if (response.scheduledDate !== undefined) {
      job.scheduledDate = response.scheduledDate;
    }
    if (response.arrivalWindow !== undefined) {
      job.arrivalWindow = response.arrivalWindow;
    }
    if (totalPrice !== undefined) {
      job.totalPrice = totalPrice;
    }
    if (depositPaid !== undefined) {
      job.depositPaid = depositPaid;
    }
    if (balanceRemaining !== undefined) {
      job.balanceRemaining = balanceRemaining;
    }
    if (response.notes !== undefined) {
      job.technicianNotes = response.notes;
    }
    if (response.googleReviewUrl !== undefined) {
      job.googleReviewUrl = response.googleReviewUrl;
    }

    this.currentJob.set(job);
    return job;
  }

  private cacheJobForLookup(job: JobRecord, requestedId: string): void {
    const lookupIds = new Set(
      [requestedId, job.id, job.trackingNumber].filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    );
    for (const lookupId of lookupIds) {
      const cachedJob = lookupId === job.id ? job : { ...job, id: lookupId };
      void this.syncService.cacheAppointment(cachedJob);
    }
  }

  private readCachedStatus(id: string): Observable<JobRecord> {
    return from(this.syncService.getCachedAppointment(id)).pipe(
      map((cached) => {
        if (!cached) {
          throw new Error(`No cached appointment is available for ${id}`);
        }
        return cached;
      })
    );
  }

  private enqueueAndPropagate(
    type: OfflineSyncItem['type'],
    payload: unknown,
    error: unknown
  ): Observable<never> {
    if (!this.isRetryableRequestError(error)) {
      return throwError(() => error);
    }
    return from(this.syncService.enqueueOfflineAction(type, payload)).pipe(
      mergeMap(() => throwError(() => error))
    );
  }

  private isRetryableRequestError(error: unknown): boolean {
    return (
      error instanceof HttpErrorResponse &&
      (error.status === 0 || error.status >= 500)
    );
  }

  private invalidRequest(message: string): Observable<never> {
    return throwError(() => new Error(message));
  }

  private estimateParameterFingerprint(params: EstimateParameters): string {
    return JSON.stringify({
      servicePackage: params.servicePackage,
      size: params.size,
      condition: params.condition,
      squareFootage: params.squareFootage ?? null,
      tradeType: params.tradeType?.trim() ?? '',
    });
  }

  private createIdempotencyKey(prefix: string): string {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID) {
      return `${prefix}_${cryptoApi.randomUUID()}`;
    }
    if (cryptoApi?.getRandomValues) {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      return `${prefix}_${Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('')}`;
    }
    return `${prefix}_${Date.now().toString(36)}`;
  }

  private nonEmptyOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private toResolvedTenant(response: unknown): ResolvedFlowTenant {
    const data =
      this.isRecord(response) && this.isRecord(response['data'])
        ? response['data']
        : response;
    if (!this.isRecord(data)) {
      throw new Error('Tenant response is invalid');
    }

    const tenantId = this.nonEmptyOrUndefined(data['tenantId']);
    const tenant = this.isRecord(data['tenant']) ? data['tenant'] : null;
    const nestedTenantId = tenant
      ? this.nonEmptyOrUndefined(tenant['tenantId'])
      : undefined;
    if (!tenantId || (nestedTenantId && nestedTenantId !== tenantId)) {
      throw new Error('Tenant response is invalid');
    }

    const profileId =
      this.nonEmptyOrUndefined(data['profileId']) ??
      (tenant ? this.nonEmptyOrUndefined(tenant['profileId']) : undefined) ??
      tenantId;
    const matchedBy = this.nonEmptyOrUndefined(data['matchedBy']) ?? null;
    const matchedValue = this.nonEmptyOrUndefined(data['matchedValue']) ?? null;

    return { tenantId, profileId, matchedBy, matchedValue };
  }

  private tenantErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (error instanceof HttpErrorResponse && error.message) {
      return error.message;
    }
    return 'Unable to resolve the service tenant.';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private isValidPhone(value: unknown): value is string {
    return typeof value === 'string' && /^[+()0-9 .-]{7,}$/.test(value.trim());
  }

  private isValidEmail(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    );
  }

  private isIsoDate(value: string): boolean {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
}
