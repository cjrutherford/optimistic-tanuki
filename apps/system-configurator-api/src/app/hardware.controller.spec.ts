import { Test, TestingModule } from '@nestjs/testing';
import { HardwareController } from './hardware.controller';
import { HardwareCatalogService } from './hardware.service';
import { HardwareCommands } from '@optimistic-tanuki/constants';

describe('System Configurator HardwareController', () => {
  let controller: HardwareController;
  let service: jest.Mocked<HardwareCatalogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HardwareController],
      providers: [
        {
          provide: HardwareCatalogService,
          useValue: {
            getChassis: jest.fn().mockReturnValue([]),
            getChassisById: jest.fn().mockReturnValue({ id: 'xs-cloud' }),
            getCompatibleComponents: jest.fn().mockReturnValue({
              cpu: [],
              ram: [],
              storage: [],
              gpu: [],
            }),
            calculatePrice: jest.fn().mockReturnValue({ totalPrice: 2999 }),
            createOrder: jest.fn().mockReturnValue({ id: 'hai-order-1' }),
            getOrder: jest.fn().mockReturnValue({ id: 'hai-order-1' }),
            saveConfiguration: jest.fn().mockReturnValue({ id: 'cfg-1' }),
            getConfiguration: jest.fn().mockReturnValue({ id: 'cfg-1' }),
          },
        },
      ],
    }).compile();

    controller = module.get(HardwareController);
    service = module.get(HardwareCatalogService);
  });

  it('routes message-pattern requests to the catalog service', () => {
    controller.getChassis();
    controller.getChassisById({ id: 'xs-cloud' });
    controller.getCompatibleComponents({ chassisId: 'xs-cloud' });
    controller.calculatePrice({
      chassisId: 'xs-cloud',
      chassisType: 'XS',
      useCase: 'dev',
      cpuId: 'cpu-1',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
    });
    controller.createOrder({
      configuration: {
        chassisId: 'xs-cloud',
        chassisType: 'XS',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: ['storage-1'],
      },
      shippingAddress: {
        name: 'Alex',
        street: '204 Deployment Lane',
        city: 'Savannah',
        state: 'Georgia',
        zip: '31401',
        country: 'USA',
      },
      customerEmail: 'alex@hai.example',
      paymentMethod: 'card',
    });
    controller.getOrder({ orderId: 'hai-order-1' });
    controller.saveConfiguration({
      configuration: {
        chassisId: 'xs-cloud',
        chassisType: 'XS',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: ['storage-1'],
      },
      label: 'alpha',
      customerEmail: 'alex@hai.example',
    });
    controller.getConfiguration({ configurationId: 'cfg-1' });

    expect(service.getChassis).toHaveBeenCalled();
    expect(service.getChassisById).toHaveBeenCalledWith('xs-cloud');
    expect(service.getCompatibleComponents).toHaveBeenCalledWith('xs-cloud');
    expect(service.getOrder).toHaveBeenCalledWith('hai-order-1');
  });

  it('exposes the shared hardware command contract', () => {
    expect(HardwareCommands.GET_CHASSIS).toContain('system-configurator.hardware');
  });
});
