import { PricingService } from './pricing.service';
import { ChassisService } from './chassis.service';
import { ComponentsService } from './components.service';

describe('PricingService', () => {
  let service: PricingService;
  let chassisService: ChassisService;
  let componentsService: ComponentsService;

  beforeEach(() => {
    componentsService = new ComponentsService();
    chassisService = new ChassisService(componentsService);
    service = new PricingService(chassisService, componentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculatePrice', () => {
    it('should calculate price with all components', async () => {
      const config = {
        chassisId: 's-cloud',
        chassisType: 'S',
        useCase: 'cloud',
        cpuId: 'cpu-n100',
        ramId: 'ram-8gb',
        storageIds: ['storage-512gb-nvme'],
        gpuId: 'gpu-none',
      };

      const result = await service.calculatePrice(config as any);
      expect(result).toBeDefined();
      expect(result.totalPrice).toBeGreaterThan(0);
      expect(result.chassisPrice).toBeGreaterThan(0);
      expect(result.cpuPrice).toBeGreaterThan(0);
      expect(result.ramPrice).toBeGreaterThan(0);
      expect(result.storagePrice).toBeGreaterThan(0);
    });

    it('should include assembly fee', async () => {
      const config = {
        chassisId: 'xs-cloud',
        chassisType: 'XS',
        useCase: 'cloud',
        cpuId: 'cpu-pi5',
        ramId: 'ram-4gb',
        storageIds: ['storage-256gb-nvme'],
      };

      const result = await service.calculatePrice(config as any);
      expect(result.assemblyFee).toBeGreaterThan(0);
    });
  });
});
