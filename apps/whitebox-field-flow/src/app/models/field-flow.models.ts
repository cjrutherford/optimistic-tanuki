export type ServicePackageTier = string;

export type TenantResolutionState = 'idle' | 'loading' | 'resolved' | 'error';

export interface ResolvedFlowTenant {
  tenantId: string;
  profileId: string;
  matchedBy: string | null;
  matchedValue: string | null;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  durationHours: number;
  features: string[];
}

export type PropertyOrVehicleSize =
  | 'compact'
  | 'midsize'
  | 'large'
  | 'commercial';

export type SurfaceCondition = 'light' | 'moderate' | 'heavy' | 'severe';

export interface EstimateParameters {
  servicePackage: ServicePackageTier;
  size: PropertyOrVehicleSize;
  condition: SurfaceCondition;
  squareFootage?: number;
  tradeType: string;
}

export interface EstimateCalculation {
  estimateId?: string;
  serviceId?: string;
  serviceName?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  depositAmount: number;
  depositRequired?: number;
  taxRate: number;
  packageDetails: ServicePackage;
  currency?: string;
  expiresAt?: string;
  isAuthoritative?: boolean;
}

export interface ServiceArrivalWindow {
  id: string;
  timeSlot: string;
  available: boolean;
}

export interface CustomerBookingDetails {
  fullName: string;
  mobilePhone: string;
  emailAddress?: string;
  streetAddress: string;
  gateCode?: string;
  serviceNotes?: string;
  selectedDate: string;
  selectedWindow: string;
  uploadedPhotoUrls: string[];
  photoUrls?: string[];
  bookingId?: string;
  trackingCode?: string;
  status?: string;
}

export type DepositPaymentRequest =
  | {
      bookingId: string;
      trackingCode?: never;
      idempotencyKey?: string;
    }
  | {
      bookingId?: never;
      trackingCode: string;
      idempotencyKey?: string;
    };

export interface FlowAvailabilityQuery {
  serviceId: string;
  date: string;
  size?: PropertyOrVehicleSize;
  condition?: SurfaceCondition;
}

export interface DepositPaymentResponse {
  paymentIntentId: string;
  clientSecret?: string;
  status: string;
  amount: number;
  currency: string;
  bookingId?: string;
  trackingCode?: string;
  smsConfirmation?: {
    dispatched: boolean;
    to?: string;
    sid?: string;
    message?: string;
  };
}

export type JobDispatchStatus =
  | 'scheduled'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface JobRecord {
  id: string;
  trackingNumber?: string;
  customerName?: string;
  customerPhone?: string;
  streetAddress?: string;
  servicePackageName?: string;
  scheduledDate?: string;
  arrivalWindow?: string;
  totalPrice?: number;
  depositPaid?: number;
  balanceRemaining?: number;
  status: JobDispatchStatus;
  technicianNotes?: string;
  technicianPhotos?: string[];
  completedAt?: string;
  googleReviewUrl?: string;
  reviewPromptEligible?: boolean;
}

export interface OfflineSyncItem {
  id: string;
  type:
    | 'booking'
    | 'estimate'
    | 'completion_note'
    | 'photo'
    | 'payment'
    | 'availability'
    | 'status';
  payload: unknown;
  timestamp: number;
  synced: boolean;
  idempotencyKey: string;
  attempts: number;
  lastError?: string;
  failedPermanently?: boolean;
}

export type {
  BrandProfile,
  WhiteboxBrandProfile,
} from '@optimistic-tanuki/whitebox-brand-config';
