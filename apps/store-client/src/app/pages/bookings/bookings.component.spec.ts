import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BookingsComponent } from './bookings.component';
import {
  StoreService,
  Resource,
  Appointment,
} from '../../services/store.service';

/**
 * The template pulls in the shared store UI, so these exercise the class
 * directly. Booking is a two-step flow -- availability is checked before the
 * appointment is created -- and each step has its own failure message, so
 * both are driven here.
 */
describe('BookingsComponent', () => {
  interface StoreMock {
    getResources: jest.Mock;
    getUserAppointments: jest.Mock;
    checkResourceAvailability: jest.Mock;
    createAppointment: jest.Mock;
    cancelAppointment: jest.Mock;
  }

  let store: StoreMock;

  const resource = (overrides: Partial<Resource> = {}): Resource =>
    ({ id: 'res-1', name: 'Studio', type: 'room', ...overrides } as Resource);

  const appointment = (overrides: Partial<Appointment> = {}): Appointment =>
    ({
      id: 'appt-1',
      startTime: new Date('2026-03-04T10:00:00Z'),
      endTime: new Date('2026-03-04T11:30:00Z'),
      ...overrides,
    } as Appointment);

  const build = (platform: 'browser' | 'server' = 'browser') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: StoreService, useValue: store },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });

    return TestBed.runInInjectionContext(
      () => new BookingsComponent(store as unknown as StoreService)
    );
  };

  beforeEach(() => {
    store = {
      getResources: jest.fn().mockReturnValue(of([resource()])),
      getUserAppointments: jest.fn().mockReturnValue(of([appointment()])),
      checkResourceAvailability: jest.fn().mockReturnValue(of(true)),
      createAppointment: jest.fn().mockReturnValue(of(appointment())),
      cancelAppointment: jest.fn().mockReturnValue(of(undefined)),
    };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('ngOnInit', () => {
    it('loads resources and appointments in the browser', () => {
      const component = build('browser');

      component.ngOnInit();

      expect(store.getResources).toHaveBeenCalled();
      expect(store.getUserAppointments).toHaveBeenCalledWith('current-user-id');
      expect(component.resources).toHaveLength(1);
      expect(component.userAppointments).toHaveLength(1);
      expect(component.loading).toBe(false);
    });

    it('does nothing when rendering on the server', () => {
      const component = build('server');

      component.ngOnInit();

      expect(store.getResources).not.toHaveBeenCalled();
    });
  });

  describe('loading failures', () => {
    it('reports a resource load failure', () => {
      const component = build();
      store.getResources.mockReturnValue(throwError(() => new Error('down')));

      component.loadResources();

      expect(component.error).toBe('Failed to load resources');
      expect(component.loading).toBe(false);
    });

    it('leaves the appointment list alone when that load fails', () => {
      const component = build();
      store.getUserAppointments.mockReturnValue(
        throwError(() => new Error('down'))
      );

      component.loadUserAppointments();

      // This one only logs; it must not surface a blocking page error.
      expect(component.userAppointments).toEqual([]);
      expect(component.error).toBeNull();
    });
  });

  describe('filteredResources', () => {
    it('returns everything for the "all" filter', () => {
      const component = build();
      component.resources = [
        resource({ id: 'a', type: 'room' }),
        resource({ id: 'b', type: 'vehicle' }),
      ];

      expect(component.filteredResources).toHaveLength(2);
    });

    it('narrows to the selected type', () => {
      const component = build();
      component.resources = [
        resource({ id: 'a', type: 'room' }),
        resource({ id: 'b', type: 'vehicle' }),
      ];
      component.selectedType = 'vehicle';

      expect(component.filteredResources.map((r) => r.id)).toEqual(['b']);
    });
  });

  describe('booking modal', () => {
    it('opens against the chosen resource and clears prior messages', () => {
      const component = build();
      component.error = 'stale';
      component.successMessage = 'stale';

      component.openBookingModal(resource({ id: 'res-9' }));

      expect(component.showBookingModal).toBe(true);
      expect(component.selectedResource?.id).toBe('res-9');
      expect(component.bookingForm.resourceId).toBe('res-9');
      expect(component.bookingForm.title).toBe('');
      expect(component.error).toBeNull();
      expect(component.successMessage).toBeNull();
    });

    it('closes and forgets the resource', () => {
      const component = build();
      component.openBookingModal(resource());

      component.closeBookingModal();

      expect(component.showBookingModal).toBe(false);
      expect(component.selectedResource).toBeNull();
    });
  });

  describe('submitBooking', () => {
    it('does nothing without a selected resource', () => {
      const component = build();

      component.submitBooking();

      expect(store.checkResourceAvailability).not.toHaveBeenCalled();
    });

    it('checks availability before creating the appointment', () => {
      const component = build();
      component.openBookingModal(resource({ id: 'res-1' }));

      component.submitBooking();

      expect(store.checkResourceAvailability).toHaveBeenCalledWith(
        'res-1',
        component.bookingForm.startTime,
        component.bookingForm.endTime
      );
      expect(store.createAppointment).toHaveBeenCalledWith(
        component.bookingForm
      );
      expect(component.successMessage).toContain('Booking created');
      expect(component.loading).toBe(false);
    });

    it('refuses to book an unavailable slot', () => {
      const component = build();
      component.openBookingModal(resource());
      store.checkResourceAvailability.mockReturnValue(of(false));

      component.submitBooking();

      expect(component.error).toContain('not available');
      expect(store.createAppointment).not.toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('reports a failed availability check', () => {
      const component = build();
      component.openBookingModal(resource());
      store.checkResourceAvailability.mockReturnValue(
        throwError(() => new Error('down'))
      );

      component.submitBooking();

      expect(component.error).toBe(
        'Failed to check availability. Please try again.'
      );
      expect(store.createAppointment).not.toHaveBeenCalled();
    });

    it('reports a failed creation separately', () => {
      const component = build();
      component.openBookingModal(resource());
      store.createAppointment.mockReturnValue(
        throwError(() => new Error('down'))
      );

      component.submitBooking();

      expect(component.error).toBe(
        'Failed to create booking. Please try again.'
      );
      expect(component.loading).toBe(false);
    });

    it('closes the modal a couple of seconds after a successful booking', () => {
      jest.useFakeTimers();
      const component = build();
      component.openBookingModal(resource());

      component.submitBooking();
      expect(component.showBookingModal).toBe(true);

      jest.advanceTimersByTime(2000);
      expect(component.showBookingModal).toBe(false);
    });

    it('refreshes the appointment list after booking', () => {
      const component = build();
      component.openBookingModal(resource());
      store.getUserAppointments.mockClear();

      component.submitBooking();

      expect(store.getUserAppointments).toHaveBeenCalled();
    });
  });

  describe('cancelAppointment', () => {
    it('does nothing for an appointment with no id', () => {
      const component = build();

      component.cancelAppointment(appointment({ id: undefined }));

      expect(store.cancelAppointment).not.toHaveBeenCalled();
    });

    it('does nothing when the operator declines the confirmation', () => {
      const component = build();
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      component.cancelAppointment(appointment());

      expect(store.cancelAppointment).not.toHaveBeenCalled();
    });

    it('cancels and refreshes once confirmed', () => {
      const component = build();
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      store.getUserAppointments.mockClear();

      component.cancelAppointment(appointment({ id: 'appt-9' }));

      expect(store.cancelAppointment).toHaveBeenCalledWith('appt-9');
      expect(component.successMessage).toBe('Booking cancelled successfully.');
      expect(store.getUserAppointments).toHaveBeenCalled();
    });

    it('clears the success message after a few seconds', () => {
      jest.useFakeTimers();
      const component = build();
      jest.spyOn(window, 'confirm').mockReturnValue(true);

      component.cancelAppointment(appointment());
      expect(component.successMessage).not.toBeNull();

      jest.advanceTimersByTime(3000);
      expect(component.successMessage).toBeNull();
    });

    it('reports a cancellation failure', () => {
      const component = build();
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      store.cancelAppointment.mockReturnValue(
        throwError(() => new Error('down'))
      );

      component.cancelAppointment(appointment());

      expect(component.error).toBe('Failed to cancel booking.');
      expect(component.loading).toBe(false);
    });
  });

  describe('presentation helpers', () => {
    it('toggles the my-bookings panel', () => {
      const component = build();

      component.toggleMyBookings();
      expect(component.showMyBookings).toBe(true);

      component.toggleMyBookings();
      expect(component.showMyBookings).toBe(false);
    });

    it('formats a duration as hours and minutes', () => {
      const component = build();

      expect(
        component.calculateDuration(
          appointment({
            startTime: new Date('2026-03-04T10:00:00Z'),
            endTime: new Date('2026-03-04T11:30:00Z'),
          })
        )
      ).toBe('1h 30m');
    });

    it('reports a sub-hour duration as zero hours', () => {
      const component = build();

      expect(
        component.calculateDuration(
          appointment({
            startTime: new Date('2026-03-04T10:00:00Z'),
            endTime: new Date('2026-03-04T10:20:00Z'),
          })
        )
      ).toBe('0h 20m');
    });

    it('maps each known status onto a css class', () => {
      const component = build();

      expect(component.getStatusClass('pending')).toBe('status-pending');
      expect(component.getStatusClass('approved')).toBe('status-approved');
      expect(component.getStatusClass('denied')).toBe('status-denied');
      expect(component.getStatusClass('cancelled')).toBe('status-cancelled');
      expect(component.getStatusClass('completed')).toBe('status-completed');
    });

    it('is blank for an unknown or missing status', () => {
      const component = build();

      expect(component.getStatusClass('invented')).toBe('');
      expect(component.getStatusClass(undefined)).toBe('');
    });

    it('formats a date through the locale', () => {
      const component = build();
      const date = new Date('2026-03-04T10:00:00Z');

      expect(component.formatDate(date)).toBe(date.toLocaleString());
    });
  });
});
