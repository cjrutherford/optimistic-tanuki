import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Availability } from '@optimistic-tanuki/ui-models';
import { ColDef } from '@optimistic-tanuki/ag-grid-ui';

import { AuthService } from '../services/auth.service';
import { StoreService } from '../services/store.service';
import { AvailabilityManagementComponent } from './availability-management.component';

const slot = (overrides: Partial<Availability> = {}): Availability =>
  ({
    id: 'avail-1',
    ownerId: 'user-123',
    dayOfWeek: 1,
    startTime: '09:00:00',
    endTime: '17:00:00',
    hourlyRate: 50,
    serviceType: 'consulting',
    isActive: true,
    ...overrides,
  } as Availability);

describe('AvailabilityManagementComponent', () => {
  let storeService: {
    getAvailabilities: jest.Mock;
    createAvailability: jest.Mock;
    updateAvailability: jest.Mock;
    deleteAvailability: jest.Mock;
  };
  let authService: { getSessionUser: jest.Mock };

  beforeEach(async () => {
    storeService = {
      getAvailabilities: jest.fn().mockReturnValue(of([slot()])),
      createAvailability: jest.fn().mockReturnValue(of(slot())),
      updateAvailability: jest.fn().mockReturnValue(of(slot())),
      deleteAvailability: jest.fn().mockReturnValue(of(undefined)),
    };
    authService = {
      getSessionUser: jest.fn().mockReturnValue({ userId: 'user-123' }),
    };

    await TestBed.configureTestingModule({
      imports: [AvailabilityManagementComponent],
      providers: [
        provideRouter([]),
        { provide: StoreService, useValue: storeService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const columnFor = (
    component: AvailabilityManagementComponent,
    headerName: string
  ): ColDef =>
    component.columnDefs.find((c) => c.headerName === headerName) as ColDef;

  it('prefills the availability owner from the restored cookie session', () => {
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    const component = fixture.componentInstance;

    component.openCreateModal();

    expect(component.createForm.ownerId).toBe('user-123');
    expect(component.showCreateModal).toBe(true);
  });

  it('blocks availability creation when the restored session has no user id', () => {
    authService.getSessionUser.mockReturnValue({ profileId: 'profile-1' });
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    const component = fixture.componentInstance;

    component.openCreateModal();

    expect(component.showCreateModal).toBe(false);
    expect(component.error).toBe(
      'Unable to determine operator identity for availability creation.'
    );
  });

  it('renders availability rows through the shared ag-grid table', () => {
    const fixture = TestBed.createComponent(AvailabilityManagementComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('otui-ag-grid')).toBeTruthy();
  });

  it('loads availabilities into the grid on init', () => {
    const component = create();

    expect(component.availabilities).toHaveLength(1);
    expect(component.gridAvailabilities).toBe(component.availabilities);
    expect(component.loading).toBe(false);
  });

  it('reports a load failure', () => {
    storeService.getAvailabilities.mockReturnValue(
      throwError(() => new Error('boom'))
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const component = create();

    expect(component.error).toBe('Failed to load availabilities');
    expect(component.loading).toBe(false);
  });

  describe('creating', () => {
    it('creates the slot, closes the modal and reloads', () => {
      const component = create();

      component.openCreateModal();
      component.createForm.serviceType = 'coaching';
      component.createAvailability();

      expect(storeService.createAvailability).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'user-123',
          serviceType: 'coaching',
        })
      );
      expect(component.showCreateModal).toBe(false);
      expect(storeService.getAvailabilities).toHaveBeenCalledTimes(2);
    });

    it('reports a create failure and keeps the modal open', () => {
      storeService.createAvailability.mockReturnValue(
        throwError(() => new Error('nope'))
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const component = create();

      component.openCreateModal();
      component.createAvailability();

      expect(component.error).toBe('Failed to create availability');
      expect(component.showCreateModal).toBe(true);
    });

    it('closes the create modal on demand', () => {
      const component = create();

      component.openCreateModal();
      component.closeCreateModal();

      expect(component.showCreateModal).toBe(false);
    });
  });

  describe('editing', () => {
    it('seeds the edit form from the selected slot', () => {
      const component = create();

      component.openEditModal(slot({ serviceType: 'audit' }));

      expect(component.showEditModal).toBe(true);
      expect(component.editForm).toEqual({
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '17:00:00',
        hourlyRate: 50,
        serviceType: 'audit',
        isActive: true,
      });
    });

    it('clears the edit state on close', () => {
      const component = create();

      component.openEditModal(slot());
      component.closeEditModal();

      expect(component.showEditModal).toBe(false);
      expect(component.selectedAvailability).toBeNull();
      expect(component.editForm).toEqual({});
    });

    it('updates the selected slot and reloads', () => {
      const component = create();

      component.openEditModal(slot());
      component.editForm.hourlyRate = 75;
      component.updateAvailability();

      expect(storeService.updateAvailability).toHaveBeenCalledWith(
        'avail-1',
        expect.objectContaining({ hourlyRate: 75 })
      );
      expect(component.showEditModal).toBe(false);
    });

    it('reports an update failure', () => {
      storeService.updateAvailability.mockReturnValue(
        throwError(() => new Error('nope'))
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const component = create();

      component.openEditModal(slot());
      component.updateAvailability();

      expect(component.error).toBe('Failed to update availability');
    });

    it('does nothing when no slot is selected', () => {
      const component = create();

      component.updateAvailability();

      expect(storeService.updateAvailability).not.toHaveBeenCalled();
    });
  });

  describe('deleting', () => {
    it('requires confirmation', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const component = create();

      component.deleteAvailability(slot());

      expect(storeService.deleteAvailability).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('deletes and reloads once confirmed', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const component = create();

      component.deleteAvailability(slot());

      expect(storeService.deleteAvailability).toHaveBeenCalledWith('avail-1');
      expect(storeService.getAvailabilities).toHaveBeenCalledTimes(2);
      confirmSpy.mockRestore();
    });

    it('reports a delete failure', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      storeService.deleteAvailability.mockReturnValue(
        throwError(() => new Error('nope'))
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const component = create();

      component.deleteAvailability(slot());

      expect(component.error).toBe('Failed to delete availability');
      confirmSpy.mockRestore();
    });
  });

  describe('formatting helpers', () => {
    it('labels every weekday and falls back for unknown values', () => {
      const component = create();

      expect(component.getDayLabel(0)).toBe('Sunday');
      expect(component.getDayLabel(6)).toBe('Saturday');
      expect(component.getDayLabel(9)).toBe('Unknown');
    });

    it('renders 24h times as 12h with a meridiem', () => {
      const component = create();

      expect(component.formatTime('09:00:00')).toBe('9:00 AM');
      expect(component.formatTime('13:30:00')).toBe('1:30 PM');
      expect(component.formatTime('00:15:00')).toBe('12:15 AM');
      expect(component.formatTime('12:05:00')).toBe('12:05 PM');
    });
  });

  describe('grid column definitions', () => {
    it('formats the day, times, rate and status columns', () => {
      const component = create();
      const format = (header: string, value: unknown) =>
        (columnFor(component, header).valueFormatter as (p: unknown) => string)(
          { value }
        );

      expect(format('Day of Week', 1)).toBe('Monday');
      expect(format('Start Time', '09:00:00')).toBe('9:00 AM');
      expect(format('End Time', '17:00:00')).toBe('5:00 PM');
      expect(format('Hourly Rate', 50)).toBe('$50.00/hr');
      expect(format('Hourly Rate', undefined)).toBe('$0.00/hr');
      expect(format('Status', true)).toBe('Active');
      expect(format('Status', false)).toBe('Inactive');
    });

    it('wires the row action buttons to the edit and delete handlers', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const component = create();
      const render = columnFor(component, 'Actions').cellRenderer as (
        p: unknown
      ) => HTMLElement;

      const container = render({ data: slot() });
      const buttons = Array.from(container.querySelectorAll('button'));
      expect(buttons.map((b) => b.textContent)).toEqual(['Edit', 'Delete']);

      buttons[0].click();
      expect(component.showEditModal).toBe(true);
      component.closeEditModal();

      buttons[1].click();
      expect(storeService.deleteAvailability).toHaveBeenCalledWith('avail-1');
      confirmSpy.mockRestore();
    });
  });
});
