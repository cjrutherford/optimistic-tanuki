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

  it('patchDraft merges onto an existing draft', () => {
    service.setDraft({
      chassisId: 'chassis-1',
      chassisType: 'M',
      useCase: 'dev',
      cpuId: 'cpu-1',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
    });

    service.patchDraft({ cpuId: 'cpu-2' });

    expect(service.draft()).toEqual({
      chassisId: 'chassis-1',
      chassisType: 'M',
      useCase: 'dev',
      cpuId: 'cpu-2',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
    });
  });

  it('patchDraft starts from defaults when there is no existing draft', () => {
    service.patchDraft({ chassisId: 'chassis-9' });

    expect(service.draft()).toEqual({
      chassisId: 'chassis-9',
      chassisType: '',
      useCase: '',
      cpuId: '',
      ramId: '',
      storageIds: [],
    });
  });

  it('sets and persists a price breakdown', () => {
    service.setPriceBreakdown({ totalPrice: 999 } as never);
    expect(service.priceBreakdown()).toEqual({ totalPrice: 999 });

    service.setPriceBreakdown(null);
    expect(service.priceBreakdown()).toBeNull();
  });

  it('persists and restores a checkout draft', () => {
    service.setCheckoutDraft({
      shipping: {
        name: 'Hai',
        street: '1 Main',
        city: 'Metropolis',
        state: 'NY',
        zip: '10001',
        country: 'USA',
      },
      customerEmail: 'hai@example.com',
      paymentMethod: 'card',
    });

    const restored = TestBed.runInInjectionContext(
      () => new ConfiguratorStateService()
    );
    expect(restored.checkoutDraft().customerEmail).toBe('hai@example.com');
  });

  it('checkoutDraft falls back to defaults when nothing is persisted', () => {
    expect(service.checkoutDraft()).toEqual({
      shipping: {
        name: '',
        street: '',
        city: '',
        state: '',
        zip: '',
        country: 'USA',
      },
      customerEmail: '',
      paymentMethod: 'card',
    });
  });

  it('clear resets draft, price breakdown and checkout draft and wipes storage', () => {
    service.setDraft({
      chassisId: 'chassis-1',
      chassisType: 'M',
      useCase: 'dev',
      cpuId: 'cpu-1',
      ramId: 'ram-1',
      storageIds: ['storage-1'],
    });
    service.setPriceBreakdown({ totalPrice: 100 } as never);
    service.setCheckoutDraft({
      shipping: {
        name: 'Hai',
        street: '1 Main',
        city: 'Metropolis',
        state: 'NY',
        zip: '10001',
        country: 'USA',
      },
      customerEmail: 'hai@example.com',
      paymentMethod: 'card',
    });

    service.clear();

    expect(service.draft()).toBeNull();
    expect(service.priceBreakdown()).toBeNull();
    expect(service.checkoutDraft().paymentMethod).toBe('card');
    expect(service.checkoutDraft().customerEmail).toBe('');
    expect(localStorage.getItem('hai-system-configurator-draft')).toBeNull();
    expect(localStorage.getItem('hai-system-configurator-checkout')).toBeNull();
  });
});
