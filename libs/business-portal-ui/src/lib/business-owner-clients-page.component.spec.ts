import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';

import { BusinessOwnerClientsPageComponent } from './business-owner-clients-page.component';

describe('BusinessOwnerClientsPageComponent', () => {
  it('derives accepted clients from approved linked prospects rather than bookings', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessOwnerClientsPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getAllRoutines: jest.fn().mockReturnValue(
              of([
                {
                  id: 'routine-1',
                  clientId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
                  clientName: 'Casey Client',
                  title: 'Four-week reset',
                  summary: 'Strength and mobility plan.',
                  focusAreas: ['Strength'],
                  createdAt: '2026-05-06T00:00:00.000Z',
                },
              ])
            ),
            getAcceptedClients: jest.fn().mockReturnValue(
              of([
                {
                  leadId: 'lead-1',
                  userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
                  name: 'Casey Client',
                  email: 'casey@example.com',
                  phone: '(555) 100-2000',
                  leadStatus: 'won',
                },
              ])
            ),
            getOwnerBookings: jest.fn().mockReturnValue(
              of([
                {
                  id: 'booking-1',
                  userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
                  title: 'Consultation',
                  status: 'pending',
                  startTime: '2026-05-10T14:00:00.000Z',
                  endTime: '2026-05-10T15:00:00.000Z',
                },
              ])
            ),
            assignRoutine: jest.fn().mockReturnValue(of({ id: 'routine-1' })),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn().mockReturnValue({
              ...DEFAULT_BUSINESS_SITE_CONFIG,
              features: {
                ...DEFAULT_BUSINESS_SITE_CONFIG.features,
                clientTasks: {
                  enabled: true,
                  allowClientCompletion: false,
                },
              },
            }),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessOwnerClientsPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.activeClients()).toEqual([
      {
        id: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
        label: 'Casey Client',
      },
    ]);
    expect(fixture.componentInstance.selectedClient()?.email).toBe(
      'casey@example.com'
    );
    expect(fixture.componentInstance.selectedClientBookings()).toHaveLength(1);
    expect(fixture.componentInstance.selectedClientRoutines()).toHaveLength(1);
  });

  it('updates the selected client panel when a different approved client is clicked', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessOwnerClientsPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getAllRoutines: jest.fn().mockReturnValue(
              of([
                {
                  id: 'routine-1',
                  clientId: 'client-2',
                  clientName: 'Jordan Client',
                  title: 'Mobility block',
                  summary: 'Daily mobility work.',
                  focusAreas: ['Mobility'],
                  createdAt: '2026-05-06T00:00:00.000Z',
                },
              ])
            ),
            getAcceptedClients: jest.fn().mockReturnValue(
              of([
                {
                  leadId: 'lead-1',
                  userId: 'client-1',
                  name: 'Casey Client',
                  email: 'casey@example.com',
                  phone: '(555) 100-2000',
                  leadStatus: 'won',
                },
                {
                  leadId: 'lead-2',
                  userId: 'client-2',
                  name: 'Jordan Client',
                  email: 'jordan@example.com',
                  phone: '(555) 100-2001',
                  leadStatus: 'won',
                },
              ])
            ),
            getOwnerBookings: jest.fn().mockReturnValue(
              of([
                {
                  id: 'booking-2',
                  userId: 'client-2',
                  title: 'Review call',
                  status: 'approved',
                  startTime: '2026-05-10T14:00:00.000Z',
                  endTime: '2026-05-10T15:00:00.000Z',
                },
              ])
            ),
            assignRoutine: jest.fn().mockReturnValue(of({ id: 'routine-1' })),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn().mockReturnValue({
              ...DEFAULT_BUSINESS_SITE_CONFIG,
              features: {
                ...DEFAULT_BUSINESS_SITE_CONFIG.features,
                clientTasks: { enabled: true, allowClientCompletion: true },
              },
            }),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessOwnerClientsPageComponent);
    fixture.detectChanges();

    const rosterItems = fixture.nativeElement.querySelectorAll('.roster-item');
    rosterItems[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedClient()?.email).toBe(
      'jordan@example.com'
    );
    expect(fixture.nativeElement.textContent).toContain('Jordan Client');
    expect(fixture.nativeElement.textContent).toContain('Review call');
  });

  it('scrolls to the bookings and routines sections from the top metric tiles', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessOwnerClientsPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getAllRoutines: jest.fn().mockReturnValue(of([])),
            getAcceptedClients: jest.fn().mockReturnValue(of([])),
            getOwnerBookings: jest.fn().mockReturnValue(of([])),
            assignRoutine: jest.fn().mockReturnValue(of({ id: 'routine-1' })),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn().mockReturnValue(DEFAULT_BUSINESS_SITE_CONFIG),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessOwnerClientsPageComponent);
    fixture.detectChanges();

    const bookingsPanel = document.createElement('div');
    bookingsPanel.id = 'owner-client-bookings';
    bookingsPanel.scrollIntoView = jest.fn();
    document.body.appendChild(bookingsPanel);

    const routinesPanel = document.createElement('div');
    routinesPanel.id = 'owner-client-routines';
    routinesPanel.scrollIntoView = jest.fn();
    document.body.appendChild(routinesPanel);

    const metricTiles = fixture.nativeElement.querySelectorAll('.metric-tile');
    metricTiles[1].click();
    metricTiles[2].click();

    expect(bookingsPanel.scrollIntoView).toHaveBeenCalled();
    expect(routinesPanel.scrollIntoView).toHaveBeenCalled();

    bookingsPanel.remove();
    routinesPanel.remove();
  });

  it('hides routine-management actions when client tasks are disabled', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessOwnerClientsPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getAllRoutines: jest.fn().mockReturnValue(of([])),
            getAcceptedClients: jest.fn().mockReturnValue(
              of([
                {
                  leadId: 'lead-1',
                  userId: 'client-1',
                  name: 'Casey Client',
                  email: 'casey@example.com',
                  phone: '(555) 100-2000',
                  leadStatus: 'won',
                },
              ])
            ),
            getOwnerBookings: jest.fn().mockReturnValue(of([])),
            assignRoutine: jest.fn().mockReturnValue(of({ id: 'routine-1' })),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn().mockReturnValue({
              ...DEFAULT_BUSINESS_SITE_CONFIG,
              features: {
                ...DEFAULT_BUSINESS_SITE_CONFIG.features,
                clientTasks: {
                  enabled: false,
                  allowClientCompletion: false,
                },
              },
            }),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessOwnerClientsPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Assign a routine');
    expect(fixture.nativeElement.textContent).not.toContain('Current routines');
  });
});
