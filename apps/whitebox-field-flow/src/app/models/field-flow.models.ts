/**
 * Domain models for Field Flow trade and field service operations.
 */

export type ServicePackageTier = 'standard' | 'premium' | 'restoration';

export interface ServicePackage {
  id: ServicePackageTier;
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
  subtotal: number;
  taxAmount: number;
  total: number;
  depositAmount: number;
  taxRate: number;
  packageDetails: ServicePackage;
}

export interface ServiceArrivalWindow {
  id: string;
  timeSlot: string; // e.g. "8:00 AM - 10:00 AM"
  available: boolean;
}

export interface CustomerBookingDetails {
  fullName: string;
  mobilePhone: string;
  streetAddress: string;
  gateCode?: string;
  serviceNotes?: string;
  selectedDate: string;
  selectedWindow: string;
  uploadedPhotoUrls: string[];
}

export interface DepositPaymentRequest {
  bookingId: string;
  amount: number;
  currency: string;
  cardholderName: string;
  cardNumberMasked: string;
  expiration: string;
  receiptEmail?: string;
}

export interface DepositPaymentResponse {
  paymentId: string;
  status: 'succeeded' | 'requires_action' | 'failed';
  bookingId: string;
  receiptNumber: string;
  smsNotificationSent: boolean;
  smsNotificationRecipient: string;
  amount: number;
}

export type JobDispatchStatus =
  | 'scheduled'
  | 'en_route'
  | 'in_progress'
  | 'completed';

export interface JobRecord {
  id: string;
  trackingNumber: string;
  customerName: string;
  customerPhone: string;
  streetAddress: string;
  servicePackageName: string;
  scheduledDate: string;
  arrivalWindow: string;
  totalPrice: number;
  depositPaid: number;
  balanceRemaining: number;
  status: JobDispatchStatus;
  technicianNotes?: string;
  technicianPhotos?: string[];
  completedAt?: string;
  googleReviewUrl?: string;
}

export interface OfflineSyncItem {
  id: string;
  type: 'booking' | 'estimate' | 'completion_note' | 'photo';
  payload: unknown;
  timestamp: number;
  synced: boolean;
}

export interface BrandProfile {
  id: string;
  businessName: string;
  tradeCategory: string;
  phone: string;
  email: string;
  serviceArea: string;
  fixedDeposit: number;
  taxRate: number;
  googleReviewUrl: string;
  isDemoMode: boolean;
  isStandalone: boolean;
}
