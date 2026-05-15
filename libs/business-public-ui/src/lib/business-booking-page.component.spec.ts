import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';

import { BusinessBookingPageComponent } from './business-booking-page.component';

@Component({
  standalone: true,
  template: '',
})
class DummyRegisterPageComponent {}

describe('BusinessBookingPageComponent', () => {
  async function render(
    clientUser: {
      userId: string;
      profileId: string;
      email: string;
      name?: string;
    } | null = null,
    accepted = false,
    options: {
      offers?: any[];
      availabilities?: any[];
      availabilityOverrides?: any[];
      busyWindows?: any[];
    } = {}
  ) {
    const offers = options.offers ?? [
      {
        id: 'offer-1',
        label: 'Strategy session',
        description: 'Booked from active availability.',
        serviceType: 'Strategy session',
        startingRate: 120,
        allowOnlineBooking: true,
      },
    ];
    const createLeadIntake = jest.fn().mockReturnValue(of({ id: 'lead-1' }));
    const createBooking = jest.fn().mockReturnValue(of({ id: 'booking-1' }));
    const getClientBookingStatus = jest
      .fn()
      .mockReturnValue(
        of({ accepted, leadId: accepted ? 'lead-accepted' : 'lead-pending' })
      );
    const getAvailabilities = jest.fn().mockReturnValue(
      of(
        options.availabilities ?? [
          {
            id: 'availability-1',
            dayOfWeek: new Date().getDay(),
            startTime: '10:00:00',
            endTime: '12:00:00',
            hourlyRate: 120,
            isActive: true,
            serviceType: 'Strategy session',
          },
        ]
      )
    );
    const getAvailabilityOverrides = jest
      .fn()
      .mockReturnValue(of(options.availabilityOverrides ?? []));
    const getBusyWindows = jest
      .fn()
      .mockReturnValue(of(options.busyWindows ?? []));
    const getOffers = jest.fn().mockReturnValue(of(offers));

    await TestBed.configureTestingModule({
      imports: [BusinessBookingPageComponent],
      providers: [
        provideRouter([
          { path: 'client/register', component: DummyRegisterPageComponent },
        ]),
        {
          provide: BusinessApiService,
          useValue: {
            createLeadIntake,
            createBooking,
            getClientBookingStatus,
            getAvailabilities,
            getAvailabilityOverrides,
            getBusyWindows,
            getOffers,
          },
        },
        {
          provide: BusinessAuthService,
          useValue: {
            clientUser: signal(clientUser).asReadonly(),
            isClientAuthenticated: signal(!!clientUser).asReadonly(),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: signal(DEFAULT_BUSINESS_SITE_CONFIG).asReadonly(),
            fetch: jest.fn().mockReturnValue(of(DEFAULT_BUSINESS_SITE_CONFIG)),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessBookingPageComponent);
    fixture.detectChanges();

    return {
      fixture,
      component: fixture.componentInstance,
      createLeadIntake,
      createBooking,
      getClientBookingStatus,
      getAvailabilities,
      getAvailabilityOverrides,
      getBusyWindows,
    };
  }

  it('submits anonymous intake without requiring a user id and encourages registration after success', async () => {
    const { component, fixture, createLeadIntake } = await render();

    const selectedSlot = component.availableSlots()[0];
    component.selectedSlotKey = selectedSlot.key;
    component.selectedOfferId = 'offer-1';
    component.form.name = 'Jordan Prospect';
    component.form.email = 'jordan@example.com';
    component.form.phone = '(555) 100-2000';
    component.form.goal = 'Build a consistent strength routine';
    component.form.context = 'I need a simple weekly plan.';
    component.submit();
    fixture.detectChanges();

    expect(createLeadIntake).toHaveBeenCalledWith({
      name: 'Jordan Prospect',
      email: 'jordan@example.com',
      phone: '(555) 100-2000',
      goal: 'Build a consistent strength routine',
      context:
        'Requested offer: Strategy session\n\nI need a simple weekly plan.',
      preferredStart: component.form.preferredStart,
      preferredEnd: component.form.preferredEnd,
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Create an account now to make scheduling faster.'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'Name or client ID'
    );
  });

  it('prefills authenticated client identity and links the intake to the signed-in account', async () => {
    const {
      component,
      fixture,
      createLeadIntake,
      createBooking,
      getClientBookingStatus,
    } = await render(
      {
        userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
        profileId: 'client-profile-1',
        email: 'client@example.com',
        name: 'Casey Client',
      },
      false
    );

    expect(component.form.name).toBe('Casey Client');
    expect(component.form.email).toBe('client@example.com');

    const selectedSlot = component.availableSlots()[0];
    component.selectedSlotKey = selectedSlot.key;
    component.selectedOfferId = 'offer-1';
    component.form.goal = 'Prepare for an intake consultation';
    component.submit();
    fixture.detectChanges();

    expect(createLeadIntake).toHaveBeenCalledWith({
      name: 'Casey Client',
      email: 'client@example.com',
      phone: '',
      goal: 'Prepare for an intake consultation',
      context: 'Requested offer: Strategy session',
      preferredStart: component.form.preferredStart,
      preferredEnd: component.form.preferredEnd,
      userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
      profileId: 'client-profile-1',
    });
    expect(fixture.nativeElement.textContent).toContain(
      "We'll follow up in your client workspace and by email."
    );
    expect(getClientBookingStatus).toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('submits a real booking for accepted clients using the signed-in client identity', async () => {
    const { component, fixture, createLeadIntake, createBooking } =
      await render(
        {
          userId: '3b5ef633-4f76-48a5-b2d1-0c82b4dbd65e',
          profileId: 'client-profile-1',
          email: 'client@example.com',
          name: 'Casey Client',
        },
        true
      );

    const selectedSlot = component.availableSlots()[0];
    component.selectedSlotKey = selectedSlot.key;
    component.selectedOfferId = 'offer-1';
    component.form.goal = 'Prepare for an intake consultation';
    component.form.context = 'I need a structured starting point.';
    component.submit();
    fixture.detectChanges();

    expect(createBooking).toHaveBeenCalledWith({
      title: 'Strategy session',
      description:
        'Requested offer: Strategy session\n\nI need a structured starting point.',
      startTime: selectedSlot.start,
      endTime: selectedSlot.end,
      isFreeConsultation: true,
      notes:
        'Client: Casey Client\nEmail: client@example.com\nOffer: Strategy session',
    });
    expect(createLeadIntake).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Consultation request submitted.'
    );
  });

  it('derives appointment choices from published owner availability', async () => {
    const { component, getAvailabilities } = await render();

    expect(getAvailabilities).toHaveBeenCalled();
    expect(component.availableSlots()).toHaveLength(4);
    expect(component.availableSlots()[0]?.serviceType).toBe('Strategy session');
  });

  it('only exposes offers marked as online-bookable in the booking selector', async () => {
    const { component } = await render(null, false, {
      offers: [
        {
          id: 'offer-1',
          label: 'Strategy session',
          description: 'Booked from active availability.',
          serviceType: 'Strategy session',
          startingRate: 120,
          allowOnlineBooking: true,
        },
        {
          id: 'offer-2',
          label: 'Private advisory',
          description: 'Visible on landing only.',
          serviceType: 'Private advisory',
          startingRate: 250,
          allowOnlineBooking: false,
        },
      ],
    });

    expect(component.offers()).toEqual([
      expect.objectContaining({
        id: 'offer-1',
        label: 'Strategy session',
      }),
    ]);
  });

  it('requires name, email, and phone for unsigned booking requests', async () => {
    const { component, fixture, createLeadIntake } = await render();

    component.form.goal = 'Need a starting point';
    component.submit();
    fixture.detectChanges();

    expect(createLeadIntake).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Name, email, and phone are required before sending a request.'
    );
  });

  it('removes busy and blocked times from the public slot list', async () => {
    const now = new Date();
    const date = new Date(now);
    date.setDate(now.getDate() + 1);
    const dayOfWeek = date.getDay();
    const yyyyMmDd = date.toISOString().slice(0, 10);
    const busyStart = new Date(date);
    busyStart.setHours(10, 0, 0, 0);
    const busyEnd = new Date(date);
    busyEnd.setHours(11, 0, 0, 0);
    const blockedStart = new Date(date);
    blockedStart.setHours(11, 0, 0, 0);
    const blockedEnd = new Date(date);
    blockedEnd.setHours(12, 0, 0, 0);
    const { component } = await render(null, false, {
      availabilities: [
        {
          id: 'availability-1',
          dayOfWeek,
          startTime: '10:00:00',
          endTime: '13:00:00',
          hourlyRate: 120,
          isActive: true,
          serviceType: 'Strategy session',
        },
      ],
      busyWindows: [
        {
          startTime: busyStart.toISOString(),
          endTime: busyEnd.toISOString(),
        },
      ],
      availabilityOverrides: [
        {
          id: 'override-1',
          mode: 'blocked',
          startTime: blockedStart.toISOString(),
          endTime: blockedEnd.toISOString(),
          isActive: true,
        },
      ],
    });

    const sameDateSlots = component
      .availableSlots()
      .filter((slot) => slot.start.toISOString().slice(0, 10) === yyyyMmDd);

    expect(sameDateSlots).toHaveLength(1);
    expect(sameDateSlots[0]?.start.getHours()).toBe(12);
  });
});
