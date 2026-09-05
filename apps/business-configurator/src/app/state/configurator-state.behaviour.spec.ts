import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfiguratorStateService } from './configurator-state.service';

const DRAFT_KEY = 'hai-system-configurator-draft';
const CHECKOUT_KEY = 'hai-system-configurator-checkout';

const EMPTY_CHECKOUT_DRAFT = {
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
};

/**
 * The service reads storage in its field initialisers, so seeding localStorage
 * (or switching the platform) has to happen before the injector builds it.
 */
function createService(platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({
    providers: [{ provide: PLATFORM_ID, useValue: platform }],
  });
  return TestBed.inject(ConfiguratorStateService);
}

describe('ConfiguratorStateService behaviour', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('in the browser', () => {
    it('starts with no draft, no price and a blank checkout draft', () => {
      const service = createService();

      expect(service.draft()).toBeNull();
      expect(service.priceBreakdown()).toBeNull();
      expect(service.checkoutDraft()).toEqual(EMPTY_CHECKOUT_DRAFT);
    });

    it('seeds a draft from an empty skeleton when patching with nothing stored', () => {
      const service = createService();

      service.patchDraft({ cpuId: 'cpu-9' });

      expect(service.draft()).toEqual({
        chassisId: '',
        chassisType: '',
        useCase: '',
        cpuId: 'cpu-9',
        ramId: '',
        storageIds: [],
      });
      expect(JSON.parse(localStorage.getItem(DRAFT_KEY) as string)).toEqual({
        chassisId: '',
        chassisType: '',
        useCase: '',
        cpuId: 'cpu-9',
        ramId: '',
        storageIds: [],
      });
    });

    it('merges a patch into the existing draft and persists the result', () => {
      const service = createService();
      service.setDraft({
        chassisId: 'chassis-1',
        chassisType: 'M',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: ['storage-1'],
      });

      service.patchDraft({ ramId: 'ram-2', storageIds: ['storage-2'] });

      expect(service.draft()).toEqual({
        chassisId: 'chassis-1',
        chassisType: 'M',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-2',
        storageIds: ['storage-2'],
      });
      expect(JSON.parse(localStorage.getItem(DRAFT_KEY) as string).ramId).toBe(
        'ram-2'
      );
    });

    it('holds the price breakdown in memory without persisting it', () => {
      const service = createService();

      service.setPriceBreakdown({ subtotal: 1000, tax: 80, total: 1080 });

      expect(service.priceBreakdown()).toEqual({
        subtotal: 1000,
        tax: 80,
        total: 1080,
      });
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
      expect(localStorage.getItem(CHECKOUT_KEY)).toBeNull();
    });

    it('persists the checkout draft and restores it into a fresh instance', () => {
      const service = createService();
      const checkout = {
        shipping: {
          name: 'Ada',
          street: '1 Main St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
          country: 'USA',
        },
        customerEmail: 'ada@example.test',
        paymentMethod: 'invoice',
      };

      service.setCheckoutDraft(checkout);

      expect(JSON.parse(localStorage.getItem(CHECKOUT_KEY) as string)).toEqual(
        checkout
      );
      const restored = TestBed.runInInjectionContext(
        () => new ConfiguratorStateService()
      );
      expect(restored.checkoutDraft()).toEqual(checkout);
    });

    it('clears every signal and removes both storage keys', () => {
      const service = createService();
      service.setDraft({
        chassisId: 'chassis-1',
        chassisType: 'M',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: ['storage-1'],
      });
      service.setPriceBreakdown({ subtotal: 1000, tax: 80, total: 1080 });
      service.setCheckoutDraft({
        ...EMPTY_CHECKOUT_DRAFT,
        customerEmail: 'ada@example.test',
      });

      service.clear();

      expect(service.draft()).toBeNull();
      expect(service.priceBreakdown()).toBeNull();
      expect(service.checkoutDraft()).toEqual(EMPTY_CHECKOUT_DRAFT);
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
      expect(localStorage.getItem(CHECKOUT_KEY)).toBeNull();
    });
  });

  describe('on the server', () => {
    it('ignores stored values and never writes to storage', () => {
      // Storage is populated, but a server-platform instance must not read it.
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ chassisId: 'from-storage' })
      );
      localStorage.setItem(
        CHECKOUT_KEY,
        JSON.stringify({
          ...EMPTY_CHECKOUT_DRAFT,
          customerEmail: 'from-storage@example.test',
        })
      );

      const service = createService('server');

      expect(service.draft()).toBeNull();
      expect(service.checkoutDraft()).toEqual(EMPTY_CHECKOUT_DRAFT);

      service.setDraft({
        chassisId: 'chassis-1',
        chassisType: 'M',
        useCase: 'dev',
        cpuId: 'cpu-1',
        ramId: 'ram-1',
        storageIds: [],
      });
      service.setCheckoutDraft({
        ...EMPTY_CHECKOUT_DRAFT,
        customerEmail: 'server@example.test',
      });

      // The signals still update; only the persistence is skipped.
      expect(service.draft()?.chassisId).toBe('chassis-1');
      expect(
        JSON.parse(localStorage.getItem(DRAFT_KEY) as string).chassisId
      ).toBe('from-storage');
      expect(
        JSON.parse(localStorage.getItem(CHECKOUT_KEY) as string).customerEmail
      ).toBe('from-storage@example.test');
    });

    it('leaves the storage keys alone when cleared', () => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ chassisId: 'from-storage' })
      );

      createService('server').clear();

      expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    });
  });
});
