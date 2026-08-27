import { LeadSource, LeadStatus } from '@optimistic-tanuki/models';
import { BusinessSiteConfig } from './business-site.config';

export interface BusinessOffer {
  id: string;
  label: string;
  description: string;
  serviceType: string;
  startingRate: number;
  allowOnlineBooking?: boolean;
}

export interface BusinessStoreProduct {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  type: string;
  active: boolean;
  stock: number;
  imageUrl?: string;
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

export interface PublicBusinessSiteSummary {
  slug: string;
  businessName: string;
  tagline: string;
  location: string;
  businessType: string;
}

export interface CreateBusinessBookingRequest {
  siteSlug?: string;
  resourceId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isFreeConsultation?: boolean;
  notes?: string;
}

export interface BusinessLeadIntake {
  siteSlug?: string;
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

export interface BusinessContactLeadSubmission {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject?: string;
  message: string;
  sourcePage?: string;
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

export type BusinessRelationshipStage =
  | 'new_lead'
  | 'lead_under_review'
  | 'accepted_client'
  | 'booking_requested'
  | 'booking_confirmed'
  | 'session_completed'
  | 'invoice_due';

export type BusinessRelationshipPrimaryAction =
  | 'request_consultation'
  | 'await_review'
  | 'book_session'
  | 'accept_client'
  | 'approve_booking'
  | 'complete_booking'
  | 'generate_invoice'
  | 'none';

export interface BusinessClientBookingStatus {
  accepted: boolean;
  leadId?: string | null;
  leadStatus?: LeadStatus | string | null;
  hasAccount: boolean;
  stage: BusinessRelationshipStage;
  nextAction: string;
  primaryAction: BusinessRelationshipPrimaryAction;
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

export type BusinessOwnerWorkflowBucket =
  | 'needs_response'
  | 'ready_to_schedule'
  | 'needs_invoicing'
  | 'active_clients';

export interface BusinessOwnerWorkflowRecord {
  id: string;
  leadId?: string;
  bookingId?: string;
  title: string;
  subtitle?: string;
  statusLabel: string;
  stage: BusinessRelationshipStage;
  bucket: BusinessOwnerWorkflowBucket;
  nextAction: string;
  details: string[];
  primaryAction: Exclude<
    BusinessRelationshipPrimaryAction,
    'request_consultation' | 'await_review' | 'book_session'
  >;
}
