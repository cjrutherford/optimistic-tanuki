import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsController', () => {
  const buildController = () => {
    const service = {
      approve: jest.fn(),
      complete: jest.fn(),
      generateInvoice: jest.fn(),
    } as unknown as AppointmentsService;

    return { controller: new AppointmentsController(service), service };
  };

  it('forwards requesterOwnerId to the service on approve', async () => {
    const { controller, service } = buildController();

    await controller.approve({
      id: 'booking-1',
      approveAppointmentDto: { notes: 'ok' } as never,
      requesterOwnerId: 'owner-1',
    });

    expect(service.approve).toHaveBeenCalledWith(
      'booking-1',
      { notes: 'ok' },
      'owner-1'
    );
  });

  it('accepts a bare id string for complete (legacy/internal callers) with no requester check', async () => {
    const { controller, service } = buildController();

    await controller.complete('booking-1');

    expect(service.complete).toHaveBeenCalledWith('booking-1', undefined);
  });

  it('accepts an object payload for complete and forwards requesterOwnerId', async () => {
    const { controller, service } = buildController();

    await controller.complete({ id: 'booking-1', requesterOwnerId: 'owner-1' });

    expect(service.complete).toHaveBeenCalledWith('booking-1', 'owner-1');
  });

  it('accepts a bare id string for generateInvoice with no requester check', async () => {
    const { controller, service } = buildController();

    await controller.generateInvoice('booking-1');

    expect(service.generateInvoice).toHaveBeenCalledWith(
      'booking-1',
      undefined
    );
  });

  it('accepts an object payload for generateInvoice and forwards requesterOwnerId', async () => {
    const { controller, service } = buildController();

    await controller.generateInvoice({
      id: 'booking-1',
      requesterOwnerId: 'owner-1',
    });

    expect(service.generateInvoice).toHaveBeenCalledWith(
      'booking-1',
      'owner-1'
    );
  });
});
