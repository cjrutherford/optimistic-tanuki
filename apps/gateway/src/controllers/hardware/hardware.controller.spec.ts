import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { HardwareController } from './hardware.controller';
import { HardwareCommands, ServiceTokens } from '@optimistic-tanuki/constants';

describe('HardwareController', () => {
  let controller: HardwareController;
  let client: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HardwareController],
      providers: [
        {
          provide: ServiceTokens.SYSTEM_CONFIGURATOR_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of({})),
          },
        },
      ],
    }).compile();

    controller = module.get(HardwareController);
    client = module.get(ServiceTokens.SYSTEM_CONFIGURATOR_SERVICE);
  });

  it('proxies chassis list requests to the system configurator service', async () => {
    await controller.getChassis();

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_CHASSIS },
      {}
    );
  });

  it('proxies chassis lookups by id', async () => {
    await controller.getChassisById('xs-cloud');

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_CHASSIS_BY_ID },
      { id: 'xs-cloud' }
    );
  });

  it('proxies compatible component lookups', async () => {
    await controller.getCompatibleComponents('xs-cloud');

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS },
      { chassisId: 'xs-cloud' }
    );
  });

  it('proxies price calculations', async () => {
    const configuration = {
      chassisId: 'hai-edge-xs',
      chassisType: 'XS',
      useCase: 'dev',
      cpuId: 'cpu-1',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
    };

    await controller.calculatePrice(configuration);

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.CALCULATE_PRICE },
      configuration
    );
  });

  it('proxies order creation including payment method', async () => {
    const payload = {
      configuration: {
        chassisId: 'hai-edge-xs',
        chassisType: 'XS',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: ['storage-1'],
      },
      shippingAddress: {
        name: 'Alex Integrator',
        street: '204 Deployment Lane',
        city: 'Savannah',
        state: 'Georgia',
        zip: '31401',
        country: 'USA',
      },
      customerEmail: 'alex@hai.example',
      paymentMethod: 'zelle' as const,
    };

    await controller.createOrder(payload);

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.CREATE_ORDER },
      payload
    );
  });

  it('proxies order lookups for confirmation pages', async () => {
    await controller.getOrder('hai-order-1');

    expect(client.send).toHaveBeenCalledWith(
      { cmd: HardwareCommands.GET_ORDER },
      { orderId: 'hai-order-1' }
    );
  });
});
