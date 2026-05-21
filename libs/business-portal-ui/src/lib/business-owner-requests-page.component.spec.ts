import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BusinessApiService } from '@optimistic-tanuki/business-data-access';

import { BusinessOwnerRequestsPageComponent } from './business-owner-requests-page.component';

describe('BusinessOwnerRequestsPageComponent', () => {
  async function render() {
    const api = {
      getOwnerProspects: jest.fn().mockReturnValue(
        of([
          {
            id: 'lead-1',
            name: 'Jordan Prospect',
            email: 'jordan@example.com',
            phone: '(555) 100-2000',
            status: 'new',
            source: 'other',
            notes: 'Goal: Build a consistent routine',
            accountStatus: 'No account',
          },
        ])
      ),
      getOwnerBookings: jest.fn().mockReturnValue(
        of([
          {
            id: 'booking-1',
            title: 'Consultation follow-up',
            userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
            status: 'pending',
            description: 'Needs a 60 minute consult.',
            startTime: '2026-05-05T14:00:00.000Z',
            endTime: '2026-05-05T15:00:00.000Z',
          },
        ])
      ),
      approveProspect: jest.fn().mockReturnValue(of({ id: 'lead-1', status: 'won' })),
      markProspectContacted: jest.fn().mockReturnValue(of({ id: 'lead-1', status: 'contacted' })),
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

    expect(text).toContain('Prospects');
    expect(text).toContain('Bookings');
    expect(text).toContain('Jordan Prospect');
    expect(text).toContain('No account');
    expect(text).toContain('Consultation follow-up');
  });

  it('renders hierarchy cues for intake and booking triage', async () => {
    const { fixture } = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Needs response');
    expect(text).toContain('Scheduling pipeline');
  });

  it('marks a prospect as contacted and refreshes the list', async () => {
    const { component, api } = await render();

    component.markProspectContacted('lead-1');

    expect(api.markProspectContacted).toHaveBeenCalledWith('lead-1');
    expect(api.getOwnerProspects).toHaveBeenCalledTimes(2);
  });

  it('approves a prospect and refreshes the list', async () => {
    const { component, api } = await render();

    component.approveProspect('lead-1');

    expect(api.approveProspect).toHaveBeenCalledWith('lead-1');
    expect(api.getOwnerProspects).toHaveBeenCalledTimes(2);
  });
});
