import { FinCommanderImportRegistryService } from './fin-commander-import-registry.service';

describe('FinCommanderImportRegistryService', () => {
  let service: FinCommanderImportRegistryService;

  beforeEach(() => {
    service = new FinCommanderImportRegistryService();
  });

  it('exposes manifests for the csv and demo-bank providers', () => {
    expect(service.manifests.map((m) => m.id)).toEqual(['csv', 'demo-bank']);
  });

  describe('loadProvider', () => {
    it('loads the csv provider', async () => {
      const provider = await service.loadProvider('csv');
      expect(provider.manifest.id).toBe('csv');
      expect(typeof provider.preview).toBe('function');
    });

    it('loads the demo-bank provider', async () => {
      const provider = await service.loadProvider('demo-bank');
      expect(provider.manifest.id).toBe('demo-bank');
      expect(typeof provider.preview).toBe('function');
    });

    it('throws for an unknown provider id', async () => {
      await expect(service.loadProvider('unknown')).rejects.toThrow(
        'Unknown import provider: unknown'
      );
    });
  });
});
