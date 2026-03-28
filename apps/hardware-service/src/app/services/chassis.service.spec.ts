import { ComponentsService } from './components.service';

class MockComponentsService {
  async findAll(type: string, chassisId?: string) {
    return [];
  }
}

describe('ChassisService', () => {
  let service: any;
  let componentsService: ComponentsService;

  beforeEach(() => {
    componentsService = new ComponentsService();
    service = new (require('./chassis.service').ChassisService)(
      componentsService
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all active chassis when no filters', async () => {
      const result = await service.findAll();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return chassis filtered by type XS', async () => {
      const result = await service.findAll({ type: 'XS' as any });
      expect(result).toBeDefined();
      result.forEach((chassis: any) => {
        expect(chassis.type).toBe('XS');
      });
    });

    it('should return chassis filtered by use case CLOUD', async () => {
      const result = await service.findAll({ useCase: 'cloud' as any });
      expect(result).toBeDefined();
      result.forEach((chassis: any) => {
        expect(chassis.useCase).toBe('cloud');
      });
    });
  });

  describe('findById', () => {
    it('should return a chassis by id', async () => {
      const result = await service.findById('xs-cloud');
      expect(result).toBeDefined();
      expect(result.id).toBe('xs-cloud');
    });

    it('should return undefined for non-existent chassis', async () => {
      const result = await service.findById('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getCompatibleComponents', () => {
    it('should return compatible components for a chassis', async () => {
      const result = await service.getCompatibleComponents('xs-cloud');
      expect(result).toBeDefined();
      expect(result.cpu).toBeDefined();
      expect(result.ram).toBeDefined();
      expect(result.storage).toBeDefined();
      expect(result.gpu).toBeDefined();
    });

    it('should return empty arrays for non-existent chassis', async () => {
      const result = await service.getCompatibleComponents('non-existent');
      expect(result).toEqual({ cpu: [], ram: [], storage: [], gpu: [] });
    });
  });
});
