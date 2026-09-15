import { computed, signal } from '@angular/core';
import type {
  BusinessAuthUser,
  BusinessLeadIntakeRecord,
  BusinessOwnerWorkflowRecord,
  ProgressCheckIn,
  RoutineAssignment,
} from '@optimistic-tanuki/business-data-access';
import { DEFAULT_BUSINESS_SITE_CONFIG } from '@optimistic-tanuki/business-data-access';
import type { Appointment, Invoice } from '@optimistic-tanuki/ui-models';
import { of } from 'rxjs';

/** Sample business portal data and service stand-ins for Storybook stories. */
const at = (d: number, h = 15) => new Date(Date.UTC(2026, 8, d, h));

export const sampleOwner: BusinessAuthUser = {
  userId: 'user-owner',
  profileId: 'profile-owner',
  email: 'owner@example.com',
  name: 'Riley Morgan',
  token: 'story',
};
export const sampleClient: BusinessAuthUser = {
  userId: 'user-client',
  profileId: 'profile-client',
  email: 'client@example.com',
  name: 'Jordan Lee',
  token: 'story',
};

export const sampleAppointments: Appointment[] = [
  {
    id: 'appt-1',
    userId: 'user-client',
    title: 'Strategy session',
    startTime: at(16, 14),
    endTime: at(16, 15),
    status: 'approved',
    isFreeConsultation: false,
    hourlyRate: 120,
    totalCost: 120,
    createdAt: at(10),
    updatedAt: at(10),
  },
  {
    id: 'appt-2',
    userId: 'user-client',
    title: 'Free consultation',
    startTime: at(9, 10),
    endTime: at(9, 10),
    status: 'completed',
    isFreeConsultation: true,
    createdAt: at(2),
    updatedAt: at(9),
  },
];

export const sampleInvoices: Invoice[] = [
  {
    id: 'inv-1',
    appointmentId: 'appt-1',
    userId: 'user-client',
    invoiceNumber: 'INV-1024',
    amount: 120,
    currency: 'USD',
    status: 'unpaid',
    createdAt: at(16),
    updatedAt: at(16),
  },
  {
    id: 'inv-2',
    appointmentId: 'appt-2',
    userId: 'user-client',
    invoiceNumber: 'INV-1019',
    amount: 0,
    currency: 'USD',
    status: 'paid',
    paidAt: at(9),
    createdAt: at(9),
    updatedAt: at(9),
  },
];

export const sampleRoutines: RoutineAssignment[] = [
  {
    id: 'routine-1',
    clientId: 'user-client',
    clientName: 'Jordan Lee',
    title: 'Weekly cash-flow review',
    summary: 'Twenty minutes every Friday to reconcile and plan.',
    focusAreas: ['Cash flow', 'Habits'],
    status: 'assigned',
    createdAt: '2026-09-10T10:00:00Z',
  },
  {
    id: 'routine-2',
    clientId: 'user-client',
    clientName: 'Jordan Lee',
    title: 'Receipt capture',
    summary: 'Photograph receipts the day you get them.',
    focusAreas: ['Record keeping'],
    status: 'completed',
    completedAt: '2026-09-12T10:00:00Z',
    createdAt: '2026-09-05T10:00:00Z',
  },
];

export const sampleCheckIns: ProgressCheckIn[] = [
  {
    id: 'checkin-1',
    clientId: 'user-client',
    assignmentId: 'routine-1',
    notes: 'Reconciled on time; one surprise subscription.',
    energy: 4,
    completedAt: '2026-09-12T17:00:00Z',
  },
];

export const sampleProspects = [
  {
    id: 'lead-1',
    name: 'Casey Park',
    email: 'casey@example.com',
    status: 'new',
    source: 'website',
    accountStatus: 'No account',
    notes: 'Wants help setting up bookkeeping.',
  },
  {
    id: 'lead-2',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    status: 'contacted',
    source: 'referral',
    accountStatus: 'Registered',
  },
] as unknown as BusinessLeadIntakeRecord[];

export const sampleWorkflow = [
  {
    id: 'wf-1',
    leadId: 'lead-1',
    title: 'Casey Park',
    subtitle: 'Website enquiry',
    statusLabel: 'New lead',
    stage: 'new_lead',
    bucket: 'needs_attention',
    nextAction: 'Reply to the enquiry',
    details: ['Wants help setting up bookkeeping.'],
    primaryAction: 'mark_contacted',
  },
  {
    id: 'wf-2',
    bookingId: 'appt-1',
    title: 'Jordan Lee',
    subtitle: 'Strategy session, Sep 16',
    statusLabel: 'Session booked',
    stage: 'active_client',
    bucket: 'upcoming',
    nextAction: 'Complete the session',
    details: ['$120 hourly'],
    primaryAction: 'complete_booking',
  },
] as unknown as BusinessOwnerWorkflowRecord[];

export class StoryBusinessApiService {
  getSiteConfig = () => of({ config: DEFAULT_BUSINESS_SITE_CONFIG });
  listPublishedSites = () => of([]);
  getClientBookings = () => of(sampleAppointments);
  getClientInvoices = () => of(sampleInvoices);
  payClientInvoice = () => of({ ...sampleInvoices[0], status: 'paid' });
  getClientRoutines = () => of(sampleRoutines);
  getClientCheckIns = () => of(sampleCheckIns);
  getOwnerProspects = () => of(sampleProspects);
  getOwnerBookings = () => of(sampleAppointments);
  getAllRoutines = () => of(sampleRoutines);
  getAllCheckIns = () => of(sampleCheckIns);
  getOwnerWorkflow = () => of(sampleWorkflow);
  markProspectContacted = () => of(sampleProspects[0]);
  approveProspect = () => of(sampleProspects[0]);
  approveBooking = () => of(sampleAppointments[0]);
  completeBooking = () => of(sampleAppointments[0]);
  generateInvoice = () => of(sampleInvoices[0]);
  createLeadIntake = () => of(sampleProspects[0]);
}

export class StoryBusinessAuthService {
  readonly user = signal<BusinessAuthUser | null>(sampleOwner);
  readonly clientUser = signal<BusinessAuthUser | null>(sampleClient);
  readonly isAuthenticated = computed(() => !!this.user());
  readonly isClientAuthenticated = computed(() => !!this.clientUser());
  readonly token = computed(() => this.user()?.token ?? null);
  readonly clientToken = computed(() => this.clientUser()?.token ?? null);
  loginClient = () => of(sampleClient);
  loginAndExchange = () => of(sampleOwner);
  claimOwnerAccess = () => of(sampleOwner);
}

export class StoryBusinessSiteConfigStore {
  readonly site = signal(DEFAULT_BUSINESS_SITE_CONFIG);
  readonly configId = signal<string | null>('config-story');
  readonly loadError = signal<string | null>(null);
  fetch = () => of(DEFAULT_BUSINESS_SITE_CONFIG);
}
