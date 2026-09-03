import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Appointment } from '@optimistic-tanuki/ui-models';
import { ColDef } from '@optimistic-tanuki/ag-grid-ui';

import { AppointmentManagementComponent } from './appointment-management.component';
import { StoreService } from '../services/store.service';

const appointment = (overrides: Partial<Appointment>): Appointment =>
  ({
    id: 'appt-1',
    title: 'Discovery Session',
    userId: 'user-1',
    startTime: new Date('2026-07-05T10:00:00.000Z'),
    endTime: new Date('2026-07-05T11:00:00.000Z'),
    status: 'pending',
    isFreeConsultation: false,
    totalCost: 120,
    ...overrides,
  } as Appointment);

describe('AppointmentManagementComponent', () => {
  const storeService = {
    getAppointments: jest.fn(),
    approveAppointment: jest.fn(),
    denyAppointment: jest.fn(),
    completeAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
    generateInvoice: jest.fn(),
  };

  const appointments: Appointment[] = [
    appointment({}),
    appointment({ id: 'appt-2', status: 'approved' }),
    appointment({ id: 'appt-3', status: 'completed' }),
    appointment({
      id: 'appt-4',
      status: 'completed',
      isFreeConsultation: true,
    }),
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    storeService.getAppointments.mockReturnValue(of(appointments));

    await TestBed.configureTestingModule({
      imports: [AppointmentManagementComponent],
      providers: [
        provideRouter([]),
        { provide: StoreService, useValue: storeService },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(AppointmentManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const columnFor = (
    component: AppointmentManagementComponent,
    headerName: string
  ): ColDef =>
    component.columnDefs.find((c) => c.headerName === headerName) as ColDef;

  it('renders appointments through the shared ag-grid table', () => {
    const fixture = TestBed.createComponent(AppointmentManagementComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('otui-ag-grid')).toBeTruthy();
  });

  it('shows every appointment when the filter is "all"', () => {
    const component = create();

    expect(component.appointments).toHaveLength(4);
    expect(component.gridAppointments).toBe(component.filteredAppointments);
    expect(component.filteredAppointments).toHaveLength(4);
  });

  it('narrows the grid rows when a status filter is applied', () => {
    const component = create();

    component.statusFilter = 'approved';
    component.onStatusFilterChange();

    expect(component.filteredAppointments.map((a) => a.id)).toEqual(['appt-2']);
  });

  it('reports a load failure', () => {
    storeService.getAppointments.mockReturnValue(
      throwError(() => new Error('boom'))
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const component = create();

    expect(component.error).toBe('Failed to load appointments');
    expect(component.loading).toBe(false);
  });

  describe('approval', () => {
    it('seeds the approve modal with the appointment hourly rate', () => {
      const component = create();

      component.openApproveModal(
        appointment({ hourlyRate: 150 } as Partial<Appointment>)
      );

      expect(component.showApproveModal).toBe(true);
      expect(component.approveForm).toEqual({ hourlyRate: 150, notes: '' });
    });

    it('clears the approve modal state on close', () => {
      const component = create();

      component.openApproveModal(appointments[0]);
      component.closeApproveModal();

      expect(component.showApproveModal).toBe(false);
      expect(component.selectedAppointment).toBeNull();
      expect(component.approveForm).toEqual({
        hourlyRate: undefined,
        notes: '',
      });
    });

    it('approves the selected appointment and reloads', () => {
      storeService.approveAppointment.mockReturnValue(of({}));
      const component = create();

      component.openApproveModal(appointments[0]);
      component.approveForm.notes = 'Looks good';
      component.approveAppointment();

      expect(storeService.approveAppointment).toHaveBeenCalledWith(
        'appt-1',
        expect.objectContaining({ notes: 'Looks good' })
      );
      expect(component.showApproveModal).toBe(false);
      expect(storeService.getAppointments).toHaveBeenCalledTimes(2);
    });

    it('keeps the approve modal open when the request fails', () => {
      storeService.approveAppointment.mockReturnValue(
        throwError(() => new Error('nope'))
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const component = create();

      component.openApproveModal(appointments[0]);
      component.approveAppointment();

      expect(component.error).toBe('Failed to approve appointment');
      expect(component.showApproveModal).toBe(true);
    });

    it('does nothing when no appointment is selected', () => {
      const component = create();

      component.approveAppointment();

      expect(storeService.approveAppointment).not.toHaveBeenCalled();
    });
  });

  describe('denial', () => {
    it('opens the deny modal with an empty reason', () => {
      const component = create();

      component.openDenyModal(appointments[0]);

      expect(component.showDenyModal).toBe(true);
      expect(component.denyForm).toEqual({ denialReason: '' });
    });

    it('clears the deny modal state on close', () => {
      const component = create();

      component.openDenyModal(appointments[0]);
      component.closeDenyModal();

      expect(component.showDenyModal).toBe(false);
      expect(component.selectedAppointment).toBeNull();
    });

    it('denies the selected appointment and reloads', () => {
      storeService.denyAppointment.mockReturnValue(of({}));
      const component = create();

      component.openDenyModal(appointments[0]);
      component.denyForm.denialReason = 'No capacity';
      component.denyAppointment();

      expect(storeService.denyAppointment).toHaveBeenCalledWith('appt-1', {
        denialReason: 'No capacity',
      });
      expect(component.showDenyModal).toBe(false);
    });

    it('reports a denial failure', () => {
      storeService.denyAppointment.mockReturnValue(
        throwError(() => new Error('nope'))
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const component = create();

      component.openDenyModal(appointments[0]);
      component.denyAppointment();

      expect(component.error).toBe('Failed to deny appointment');
    });

    it('does nothing when no appointment is selected', () => {
      const component = create();

      component.denyAppointment();

      expect(storeService.denyAppointment).not.toHaveBeenCalled();
    });
  });

  describe('complete and cancel', () => {
    it('requires confirmation before completing', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const component = create();

      component.completeAppointment(appointments[1]);

      expect(storeService.completeAppointment).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('completes and reloads once confirmed', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      storeService.completeAppointment.mockReturnValue(of({}));
      const component = create();

      component.completeAppointment(appointments[1]);

      expect(storeService.completeAppointment).toHaveBeenCalledWith('appt-2');
      expect(storeService.getAppointments).toHaveBeenCalledTimes(2);
      confirmSpy.mockRestore();
    });

    it('reports a completion failure', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      storeService.completeAppointment.mockReturnValue(
        throwError(() => new Error('nope'))
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const component = create();

      component.completeAppointment(appointments[1]);

      expect(component.error).toBe('Failed to complete appointment');
      confirmSpy.mockRestore();
    });

    it('requires confirmation before cancelling', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const component = create();

      component.cancelAppointment(appointments[0]);

      expect(storeService.cancelAppointment).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('cancels and reloads once confirmed', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      storeService.cancelAppointment.mockReturnValue(of({}));
      const component = create();

      component.cancelAppointment(appointments[0]);

      expect(storeService.cancelAppointment).toHaveBeenCalledWith('appt-1');
      confirmSpy.mockRestore();
    });

    it('reports a cancellation failure', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      storeService.cancelAppointment.mockReturnValue(
        throwError(() => new Error('nope'))
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const component = create();

      component.cancelAppointment(appointments[0]);

      expect(component.error).toBe('Failed to cancel appointment');
      confirmSpy.mockRestore();
    });
  });

  describe('invoicing', () => {
    it('opens the invoice modal with the generated invoice', () => {
      storeService.generateInvoice.mockReturnValue(of({ id: 'inv-1' }));
      const component = create();

      component.generateInvoice(appointments[2]);

      expect(storeService.generateInvoice).toHaveBeenCalledWith('appt-3');
      expect(component.showInvoiceModal).toBe(true);
      expect(component.generatedInvoice).toEqual({ id: 'inv-1' });
    });

    it('discards the invoice when the modal is closed', () => {
      storeService.generateInvoice.mockReturnValue(of({ id: 'inv-1' }));
      const component = create();

      component.generateInvoice(appointments[2]);
      component.closeInvoiceModal();

      expect(component.showInvoiceModal).toBe(false);
      expect(component.generatedInvoice).toBeNull();
    });

    it('reports an invoice failure', () => {
      storeService.generateInvoice.mockReturnValue(
        throwError(() => new Error('nope'))
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const component = create();

      component.generateInvoice(appointments[2]);

      expect(component.error).toBe('Failed to generate invoice');
      expect(component.showInvoiceModal).toBe(false);
    });
  });

  describe('formatting helpers', () => {
    it('maps known statuses to css classes and falls back to empty', () => {
      const component = create();

      expect(component.getStatusClass('pending')).toBe('status-pending');
      expect(component.getStatusClass('approved')).toBe('status-approved');
      expect(component.getStatusClass('denied')).toBe('status-denied');
      expect(component.getStatusClass('cancelled')).toBe('status-cancelled');
      expect(component.getStatusClass('completed')).toBe('status-completed');
      expect(component.getStatusClass('unknown')).toBe('');
    });

    it('formats dates through the locale string', () => {
      const component = create();
      const date = new Date('2026-07-05T10:00:00.000Z');

      expect(component.formatDate(date)).toBe(date.toLocaleString());
    });

    it('renders the duration in hours and minutes', () => {
      const component = create();

      expect(
        component.calculateDuration(
          appointment({
            startTime: new Date('2026-07-05T10:00:00.000Z'),
            endTime: new Date('2026-07-05T11:30:00.000Z'),
          })
        )
      ).toBe('1h 30m');
    });
  });

  describe('grid column definitions', () => {
    it('formats the start and end columns through formatDate', () => {
      const component = create();
      const date = new Date('2026-07-05T10:00:00.000Z');

      const start = columnFor(component, 'Start');
      const end = columnFor(component, 'End');

      expect(
        (start.valueFormatter as (p: unknown) => string)({ value: date })
      ).toBe(date.toLocaleString());
      expect(
        (end.valueFormatter as (p: unknown) => string)({ value: date })
      ).toBe(date.toLocaleString());
    });

    it('derives the duration column from the row data', () => {
      const component = create();
      const duration = columnFor(component, 'Duration');

      expect(
        (duration.valueGetter as (p: unknown) => string)({
          data: appointments[0],
        })
      ).toBe('1h 0m');
    });

    it('formats total cost as currency and dashes when absent', () => {
      const component = create();
      const cost = columnFor(component, 'Total Cost');
      const format = cost.valueFormatter as (p: unknown) => string;

      expect(format({ data: { totalCost: 120 } })).toBe('$120.00');
      expect(format({ data: {} })).toBe('-');
      expect(format({})).toBe('-');
    });

    it('offers approve, deny and cancel actions for pending appointments', () => {
      const component = create();
      const actions = columnFor(component, 'Actions');
      const render = actions.cellRenderer as (p: unknown) => HTMLElement;

      const container = render({ data: appointments[0] });
      const labels = Array.from(container.querySelectorAll('button')).map(
        (b) => b.textContent
      );

      expect(labels).toEqual(['Approve', 'Deny', 'Cancel']);
    });

    it('wires the pending action buttons to the component handlers', () => {
      const component = create();
      const actions = columnFor(component, 'Actions');
      const render = actions.cellRenderer as (p: unknown) => HTMLElement;

      const container = render({ data: appointments[0] });
      const buttons = Array.from(container.querySelectorAll('button'));

      buttons[0].click();
      expect(component.showApproveModal).toBe(true);
      component.closeApproveModal();

      buttons[1].click();
      expect(component.showDenyModal).toBe(true);
      component.closeDenyModal();

      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      storeService.cancelAppointment.mockReturnValue(of({}));
      buttons[2].click();
      expect(storeService.cancelAppointment).toHaveBeenCalledWith('appt-1');
      confirmSpy.mockRestore();
    });

    it('offers complete and cancel actions for approved appointments', () => {
      const component = create();
      const actions = columnFor(component, 'Actions');
      const render = actions.cellRenderer as (p: unknown) => HTMLElement;

      const container = render({ data: appointments[1] });
      const labels = Array.from(container.querySelectorAll('button')).map(
        (b) => b.textContent
      );

      expect(labels).toEqual(['Complete', 'Cancel']);
    });

    it('offers an invoice action for billable completed appointments only', () => {
      const component = create();
      const actions = columnFor(component, 'Actions');
      const render = actions.cellRenderer as (p: unknown) => HTMLElement;

      const billable = render({ data: appointments[2] });
      expect(
        Array.from(billable.querySelectorAll('button')).map(
          (b) => b.textContent
        )
      ).toEqual(['Invoice']);

      const freeConsult = render({ data: appointments[3] });
      expect(freeConsult.querySelectorAll('button')).toHaveLength(0);
    });
  });
});
