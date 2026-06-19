import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BusinessApiService } from '@optimistic-tanuki/business-data-access';

import { BusinessOwnerRequestsPageComponent } from './business-owner-requests-page.component';

describe('BusinessOwnerRequestsPageComponent', () => {
  async function render() {
    const api = {
      getOwnerWorkflow: jest.fn().mockReturnValue(
        of([
          {
            id: 'lead:lead-1',
            leadId: 'lead-1',
            title: 'Jordan Prospect',
            subtitle: 'jordan@example.com',
            statusLabel: 'new',
            stage: 'new_lead',
            bucket: 'needs_response',
            nextAction: 'Accept the client or follow up before booking.',
            details: ['No account', 'Goal: Build a consistent routine'],
            primaryAction: 'accept_client',
          },
          {
            id: 'booking:booking-1',
            bookingId: 'booking-1',
            title: 'Consultation follow-up',
            subtitle: 'Avery Client',
            statusLabel: 'pending',
            stage: 'booking_requested',
            bucket: 'ready_to_schedule',
            nextAction: 'Review the request and confirm the schedule.',
            details: ['Needs a 60 minute consult.'],
            primaryAction: 'approve_booking',
          },
          {
            id: 'booking:booking-3',
            bookingId: 'booking-3',
            title: 'Avery Client',
            subtitle: 'Strategy session',
            statusLabel: 'approved',
            stage: 'booking_confirmed',
            bucket: 'active_clients',
            nextAction: 'Complete the session when delivery is finished.',
            details: ['Scheduled for Friday'],
            primaryAction: 'complete_booking',
          },
          {
            id: 'booking:booking-4',
            bookingId: 'booking-4',
            title: 'Completed audit',
            subtitle: 'Avery Client',
            statusLabel: 'completed',
            stage: 'session_completed',
            bucket: 'needs_invoicing',
            nextAction: 'Generate the invoice for the completed session.',
            details: ['Completed Friday'],
            primaryAction: 'generate_invoice',
          },
        ])
      ),
      approveProspect: jest
        .fn()
        .mockReturnValue(of({ id: 'lead-1', status: 'won' })),
      markProspectContacted: jest
        .fn()
        .mockReturnValue(of({ id: 'lead-1', status: 'contacted' })),
    };

    await TestBed.configureTestingModule({
      imports: [BusinessOwnerRequestsPageComponent],
      providers: [{ provide: BusinessApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessOwnerRequestsPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, api };
  }

  it('renders separate prospects and bookings sections for owner triage', async () => {
    const { fixture } = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Needs response');
    expect(text).toContain('Ready to schedule');
    expect(text).toContain('Needs invoicing');
    expect(text).toContain('Active clients');
    expect(text).toContain('Jordan Prospect');
    expect(text).toContain('Consultation follow-up');
    expect(text).toContain('Completed audit');
  });

  it('renders lifecycle guidance for owner operations', async () => {
    const { fixture } = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Accept the client or follow up before booking.');
    expect(text).toContain('Review the request and confirm the schedule.');
    expect(text).toContain('Generate the invoice for the completed session.');
  });

  it('marks a prospect as contacted and refreshes the list', async () => {
    const { component, api } = await render();

    component.markProspectContacted('lead-1');

    expect(api.markProspectContacted).toHaveBeenCalledWith('lead-1');
    expect(api.getOwnerWorkflow).toHaveBeenCalledTimes(2);
  });

  it('approves a prospect and refreshes the list', async () => {
    const { component, api } = await render();

    component.approveProspect('lead-1');

    expect(api.approveProspect).toHaveBeenCalledWith('lead-1');
    expect(api.getOwnerWorkflow).toHaveBeenCalledTimes(2);
  });
});
