import { TestBed } from '@angular/core/testing';
import { ConfiguratorStateService } from './configurator-state.service';

describe('ConfiguratorStateService', () => {
  let service: ConfiguratorStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfiguratorStateService);
  });

  it('persists and restores a build draft', () => {
    service.setDraft({
      chassisId: 'chassis-1',
      chassisType: 'M',
      useCase: 'dev',
      cpuId: 'cpu-1',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
      gpuId: 'gpu-1',
    });

    const restored = TestBed.runInInjectionContext(
      () => new ConfiguratorStateService()
    );
    expect(restored.draft()).toEqual({
      chassisId: 'chassis-1',
      chassisType: 'M',
      useCase: 'dev',
      cpuId: 'cpu-1',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
      gpuId: 'gpu-1',
    });
  });
});
