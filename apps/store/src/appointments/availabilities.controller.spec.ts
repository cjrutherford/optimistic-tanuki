import { AvailabilitiesController } from './availabilities.controller';
import { AvailabilitiesService } from './availabilities.service';

describe('AvailabilitiesController', () => {
  const buildController = () => {
    const service = {
      update: jest.fn(),
      remove: jest.fn(),
      updateOverride: jest.fn(),
      removeOverride: jest.fn(),
    } as unknown as AvailabilitiesService;

    return { controller: new AvailabilitiesController(service), service };
  };

  it('forwards requesterOwnerId to the service on update', async () => {
    const { controller, service } = buildController();

    await controller.update({
      id: 'availability-1',
      updateAvailabilityDto: { hourlyRate: 200 } as never,
      requesterOwnerId: 'owner-1',
    });

    expect(service.update).toHaveBeenCalledWith(
      'availability-1',
      { hourlyRate: 200 },
      'owner-1'
    );
  });

  it('accepts a bare id string for remove (legacy/internal callers) with no requester check', async () => {
    const { controller, service } = buildController();

    await controller.remove('availability-1');

    expect(service.remove).toHaveBeenCalledWith('availability-1', undefined);
  });

  it('accepts an object payload for remove and forwards requesterOwnerId', async () => {
    const { controller, service } = buildController();

    await controller.remove({
      id: 'availability-1',
      requesterOwnerId: 'owner-1',
    });

    expect(service.remove).toHaveBeenCalledWith('availability-1', 'owner-1');
  });

  it('accepts a bare id string for removeOverride with no requester check', async () => {
    const { controller, service } = buildController();

    await controller.removeOverride('override-1');

    expect(service.removeOverride).toHaveBeenCalledWith(
      'override-1',
      undefined
    );
  });

  it('forwards requesterOwnerId to the service on updateOverride', async () => {
    const { controller, service } = buildController();

    await controller.updateOverride({
      id: 'override-1',
      updateAvailabilityOverrideDto: { hourlyRate: 200 } as never,
      requesterOwnerId: 'owner-1',
    });

    expect(service.updateOverride).toHaveBeenCalledWith(
      'override-1',
      { hourlyRate: 200 },
      'owner-1'
    );
  });
});
