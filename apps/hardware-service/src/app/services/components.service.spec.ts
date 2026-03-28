import { ComponentsService } from './components.service';

describe('ComponentsService', () => {
  let service: ComponentsService;

  beforeEach(() => {
    service = new ComponentsService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all active components when no filters', async () => {
      const result = await service.findAll('');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter components by type', async () => {
      const result = await service.findAll('cpu');
      expect(result).toBeDefined();
      result.forEach((component: any) => {
        expect(component.type).toBe('cpu');
      });
    });

    it('should filter components by chassis compatibility', async () => {
      const result = await service.findAll('cpu', 'xs-cloud');
      expect(result).toBeDefined();
      result.forEach((component: any) => {
        expect(component.compatibleWith).toContain('xs-cloud');
      });
    });
  });

  describe('findById', () => {
    it('should return a component by id', async () => {
      const result = await service.findById('cpu-n100');
      expect(result).toBeDefined();
      expect(result?.id).toBe('cpu-n100');
    });

    it('should return undefined for non-existent component', async () => {
      const result = await service.findById('non-existent');
      expect(result).toBeUndefined();
    });
  });
});
