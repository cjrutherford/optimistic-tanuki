import { TestBed } from '@angular/core/testing';
import {
  BusinessService,
  LandingSection,
} from '@optimistic-tanuki/business-data-access';
import { BusinessConfigStateService } from './business-config-state.service';

const STORAGE_KEY = 'business-configurator:state';

/**
 * The service hydrates itself from localStorage in its field initialisers, so a
 * test that cares about stored state must seed storage *before* the injector
 * builds the instance. Injection is therefore deferred to this helper rather
 * than done in `beforeEach`.
 */
function createService(): BusinessConfigStateService {
  return TestBed.inject(BusinessConfigStateService);
}

function readPersistedConfig(): Record<string, unknown> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    throw new Error('expected the service to have persisted its config');
  }
  return JSON.parse(raw);
}

function makeService(id: string, price: number): BusinessService {
  return {
    id,
    name: `Service ${id}`,
    description: `Description for ${id}`,
    duration: 60,
    price,
    allowOnlineBooking: true,
  };
}

describe('BusinessConfigStateService behaviour', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('hydration from storage', () => {
    it('starts from the built-in defaults when nothing is stored', () => {
      const service = createService();

      expect(service.step()).toBe(0);
      expect(service.config().brand.businessName).toBe('');
      expect(service.config().contact.consultationLabel).toBe(
        'Book a consultation'
      );
      expect(service.config().landingPage.sections.map((s) => s.id)).toEqual([
        'hero',
        'about',
        'services',
        'testimonials',
        'contact',
        'booking',
      ]);
    });

    it('restores a previously persisted config and fills gaps from the shared defaults', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          businessType: 'coaching',
          brand: { businessName: 'Stored Co', monogram: 'SC' },
        })
      );

      const config = createService().config();

      expect(config.businessType).toBe('coaching');
      expect(config.brand.businessName).toBe('Stored Co');
      expect(config.brand.monogram).toBe('SC');
      // Absent keys come from DEFAULT_BUSINESS_SITE_CONFIG, not from the
      // service's own (blank) starting config.
      expect(config.contact.email).toBe('hello@business.local');
    });

    it('falls back to the defaults when the stored payload is not valid JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{ this is not json');

      const config = createService().config();

      expect(config.brand.businessName).toBe('');
      expect(config.contact.email).toBe('');
    });
  });

  describe('when localStorage is unavailable (server-side rendering)', () => {
    let originalDescriptor: PropertyDescriptor | undefined;

    beforeEach(() => {
      originalDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'localStorage'
      );
      // `typeof x` reports 'undefined' for a defined-but-undefined binding,
      // which is exactly the guard the service uses.
      Object.defineProperty(globalThis, 'localStorage', {
        value: undefined,
        configurable: true,
      });
    });

    afterEach(() => {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
      }
    });

    it('hydrates from the defaults and keeps mutating state in memory only', () => {
      const service = createService();

      expect(service.config().brand.businessName).toBe('');

      service.updateBrand({ businessName: 'In Memory Co' });
      service.clear();

      expect(service.config().brand.businessName).toBe('');
      expect(service.step()).toBe(0);
    });
  });

  describe('step navigation', () => {
    it('advances through the wizard and stops at the final step', () => {
      const service = createService();

      service.nextStep();
      expect(service.step()).toBe(1);

      for (let i = 0; i < 10; i++) {
        service.nextStep();
      }
      expect(service.step()).toBe(5);
    });

    it('walks back through the wizard and stops at the first step', () => {
      const service = createService();
      service.goToStep(2);

      service.prevStep();
      expect(service.step()).toBe(1);

      service.prevStep();
      service.prevStep();
      expect(service.step()).toBe(0);
    });

    it('jumps directly to a requested step', () => {
      const service = createService();

      service.goToStep(4);

      expect(service.step()).toBe(4);
    });

    it.each<[number, string]>([
      [0, 'Business Info'],
      [1, 'Features'],
      [2, 'Services'],
      [3, 'Design'],
      [4, 'Review'],
      [5, ''],
      [-1, ''],
    ])('titles step %i as "%s"', (step, expected) => {
      expect(createService().getStepTitle(step)).toBe(expected);
    });
  });

  describe('canProceed', () => {
    it('blocks the first step until both a business name and a monogram exist', () => {
      const service = createService();

      expect(service.canProceed()).toBe(false);

      service.updateBrand({ businessName: 'Acme' });
      expect(service.canProceed()).toBe(false);

      service.updateBrand({ monogram: 'AC' });
      expect(service.canProceed()).toBe(true);
    });

    it.each([1, 2, 3, 4, 9])('allows step %i unconditionally', (step) => {
      const service = createService();

      service.goToStep(step);

      expect(service.canProceed()).toBe(true);
    });
  });

  describe('config mutations', () => {
    it('records the business type and persists it', () => {
      const service = createService();

      service.updateBusinessType('accounting');

      expect(service.config().businessType).toBe('accounting');
      expect(readPersistedConfig()['businessType']).toBe('accounting');
    });

    it('merges brand edits instead of replacing the whole brand', () => {
      const service = createService();
      service.updateBrand({ businessName: 'Acme', monogram: 'AC' });

      service.updateBrand({ tagline: 'We do things' });

      expect(service.config().brand).toMatchObject({
        businessName: 'Acme',
        monogram: 'AC',
        tagline: 'We do things',
      });
    });

    it('merges contact edits and persists them', () => {
      const service = createService();

      service.updateContact({ email: 'hi@acme.test' });
      service.updateContact({ phone: '(555) 123-4567' });

      expect(service.config().contact).toMatchObject({
        email: 'hi@acme.test',
        phone: '(555) 123-4567',
        consultationLabel: 'Book a consultation',
      });
      const persisted = readPersistedConfig()['contact'] as Record<
        string,
        unknown
      >;
      expect(persisted['email']).toBe('hi@acme.test');
    });

    it('replaces only the named feature groups', () => {
      const service = createService();

      service.updateFeatures({
        store: { enabled: true },
        invoices: { enabled: true },
      });

      expect(service.config().features.store).toEqual({ enabled: true });
      expect(service.config().features.invoices).toEqual({ enabled: true });
      // Untouched groups survive the shallow merge.
      expect(service.config().features.booking).toEqual({
        enabled: true,
        allowOnlinePayment: false,
      });
    });

    it('merges theme edits and persists them', () => {
      const service = createService();

      service.updateTheme({ mode: 'dark' });

      expect(service.config().theme).toEqual({
        mode: 'dark',
        personalityId: 'professional',
        primaryColor: '#1f7a63',
      });
      expect(readPersistedConfig()['theme']).toEqual({
        mode: 'dark',
        personalityId: 'professional',
        primaryColor: '#1f7a63',
      });
    });
  });

  describe('services', () => {
    it('appends services one at a time', () => {
      const service = createService();

      service.addService(makeService('a', 100));
      service.addService(makeService('b', 200));

      expect(service.config().services.map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('removes a service by id and leaves the rest in order', () => {
      const service = createService();
      service.addService(makeService('a', 100));
      service.addService(makeService('b', 200));
      service.addService(makeService('c', 300));

      service.removeService('b');

      expect(service.config().services.map((s) => s.id)).toEqual(['a', 'c']);
    });

    it('ignores a removal for an unknown service id', () => {
      const service = createService();
      service.addService(makeService('a', 100));

      service.removeService('nope');

      expect(service.config().services.map((s) => s.id)).toEqual(['a']);
    });

    it('replaces the whole service list and persists it', () => {
      const service = createService();
      service.addService(makeService('a', 100));

      service.updateServices([makeService('x', 50)]);

      expect(service.config().services).toEqual([makeService('x', 50)]);
      expect(readPersistedConfig()['services']).toEqual([makeService('x', 50)]);
    });
  });

  describe('landing page', () => {
    it('changes the layout and persists it', () => {
      const service = createService();

      service.updateLandingLayout('grid');

      expect(service.config().landingPage.layout).toBe('grid');
      const persisted = readPersistedConfig()['landingPage'] as Record<
        string,
        unknown
      >;
      expect(persisted['layout']).toBe('grid');
    });

    it('replaces the section list wholesale', () => {
      const service = createService();
      const sections: LandingSection[] = [
        { id: 'hero', type: 'hero', title: 'Hi', enabled: true, order: 0 },
      ];

      service.updateLandingSections(sections);

      expect(service.config().landingPage.sections).toEqual(sections);
      expect(service.config().landingPage.layout).toBe('single-column');
    });

    it('toggles the enabled flag of the addressed section only', () => {
      const service = createService();
      const before = service.config().landingPage.sections;
      expect(before.find((s) => s.id === 'services')?.enabled).toBe(false);
      expect(before.find((s) => s.id === 'hero')?.enabled).toBe(true);

      service.toggleSection('services');

      const after = service.config().landingPage.sections;
      expect(after.find((s) => s.id === 'services')?.enabled).toBe(true);
      expect(after.find((s) => s.id === 'hero')?.enabled).toBe(true);
    });

    it('toggles a section back off on a second call', () => {
      const service = createService();

      service.toggleSection('hero');
      service.toggleSection('hero');

      expect(
        service.config().landingPage.sections.find((s) => s.id === 'hero')
          ?.enabled
      ).toBe(true);
    });

    it('leaves every section untouched when the id is unknown', () => {
      const service = createService();
      const before = service.config().landingPage.sections;

      service.toggleSection('does-not-exist');

      expect(service.config().landingPage.sections).toEqual(before);
    });

    it('reorders sections and renumbers their order fields', () => {
      const service = createService();

      service.reorderSections(0, 2);

      const sections = service.config().landingPage.sections;
      expect(sections.map((s) => s.id)).toEqual([
        'about',
        'services',
        'hero',
        'testimonials',
        'contact',
        'booking',
      ]);
      expect(sections.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('reorders backwards and persists the new order', () => {
      const service = createService();

      service.reorderSections(5, 0);

      const persisted = readPersistedConfig()['landingPage'] as {
        sections: { id: string; order: number }[];
      };
      expect(persisted.sections.map((s) => s.id)).toEqual([
        'booking',
        'hero',
        'about',
        'services',
        'testimonials',
        'contact',
      ]);
      expect(persisted.sections.map((s) => s.order)).toEqual([
        0, 1, 2, 3, 4, 5,
      ]);
    });
  });

  describe('clear', () => {
    it('resets the config and step and drops the persisted payload', () => {
      const service = createService();
      service.updateBrand({ businessName: 'Acme', monogram: 'AC' });
      service.addService(makeService('a', 100));
      service.goToStep(3);
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      service.clear();

      expect(service.config().brand.businessName).toBe('');
      expect(service.config().services).toEqual([]);
      expect(service.step()).toBe(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
