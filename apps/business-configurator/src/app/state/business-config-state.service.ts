import { Injectable, signal } from '@angular/core';
import {
  BusinessSiteConfig,
  BusinessFeatures,
  BusinessService,
  LandingSection,
  mergeBusinessSiteConfig,
} from '@optimistic-tanuki/business-data-access';

export interface BusinessConfigState {
  step: number;
  config: BusinessSiteConfig;
}

const STORAGE_KEY = 'business-configurator:state';

@Injectable({ providedIn: 'root' })
export class BusinessConfigStateService {
  private readonly _step = signal(0);
  private readonly _config = signal<BusinessSiteConfig>(this.loadFromStorage());

  readonly step = this._step.asReadonly();
  readonly config = this._config.asReadonly();

  private loadFromStorage(): BusinessSiteConfig {
    if (typeof localStorage === 'undefined') {
      return this.getDefaultConfig();
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return mergeBusinessSiteConfig(JSON.parse(stored));
      } catch {
        return this.getDefaultConfig();
      }
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): BusinessSiteConfig {
    return mergeBusinessSiteConfig({
      businessType: 'general',
      brand: {
        businessName: '',
        monogram: '',
        ownerName: '',
        tagline: '',
        intro: '',
        longBio: '',
        credentials: [],
        specializations: [],
      },
      contact: {
        email: '',
        phone: '',
        location: '',
        consultationLabel: 'Book a consultation',
      },
      features: {
        store: { enabled: false },
        booking: { enabled: true, allowOnlinePayment: false },
        clientTasks: { enabled: false, allowClientCompletion: false },
        clientPortal: { enabled: true },
        invoices: { enabled: false },
        testimonials: { enabled: true },
      },
      services: [],
      landingPage: {
        sections: [
          {
            id: 'hero',
            type: 'hero',
            title: 'Welcome',
            enabled: true,
            order: 0,
          },
          {
            id: 'about',
            type: 'about',
            title: 'About',
            enabled: true,
            order: 1,
          },
          {
            id: 'services',
            type: 'services',
            title: 'Services',
            enabled: false,
            order: 2,
          },
          {
            id: 'testimonials',
            type: 'testimonials',
            title: 'Testimonials',
            enabled: true,
            order: 3,
          },
          {
            id: 'contact',
            type: 'contact',
            title: 'Contact',
            enabled: true,
            order: 4,
          },
          {
            id: 'booking',
            type: 'booking',
            title: 'Book Now',
            enabled: true,
            order: 5,
          },
        ],
        layout: 'single-column',
      },
      clientPortal: {
        headline: 'Client Portal',
        description: 'Access your account and track progress.',
        capabilities: [],
      },
      testimonials: [],
      theme: {
        mode: 'light',
        personalityId: 'professional',
        primaryColor: '#1f7a63',
      },
    });
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config()));
  }

  nextStep(): void {
    this._step.update((s) => Math.min(s + 1, 5));
  }

  prevStep(): void {
    this._step.update((s) => Math.max(s - 1, 0));
  }

  goToStep(step: number): void {
    this._step.set(step);
  }

  updateBusinessType(type: BusinessSiteConfig['businessType']): void {
    this._config.update((c) => ({ ...c, businessType: type }));
    this.saveToStorage();
  }

  updateBrand(brand: Partial<BusinessSiteConfig['brand']>): void {
    this._config.update((c) => ({ ...c, brand: { ...c.brand, ...brand } }));
    this.saveToStorage();
  }

  updateContact(contact: Partial<BusinessSiteConfig['contact']>): void {
    this._config.update((c) => ({
      ...c,
      contact: { ...c.contact, ...contact },
    }));
    this.saveToStorage();
  }

  updateFeatures(features: Partial<BusinessFeatures>): void {
    this._config.update((c) => ({
      ...c,
      features: { ...c.features, ...features },
    }));
    this.saveToStorage();
  }

  updateServices(services: BusinessService[]): void {
    this._config.update((c) => ({ ...c, services }));
    this.saveToStorage();
  }

  addService(service: BusinessService): void {
    this._config.update((c) => ({
      ...c,
      services: [...c.services, service],
    }));
    this.saveToStorage();
  }

  removeService(serviceId: string): void {
    this._config.update((c) => ({
      ...c,
      services: c.services.filter((s) => s.id !== serviceId),
    }));
    this.saveToStorage();
  }

  updateTheme(theme: Partial<BusinessSiteConfig['theme']>): void {
    this._config.update((c) => ({ ...c, theme: { ...c.theme, ...theme } }));
    this.saveToStorage();
  }

  updateLandingLayout(
    layout: BusinessSiteConfig['landingPage']['layout']
  ): void {
    this._config.update((c) => ({
      ...c,
      landingPage: { ...c.landingPage, layout },
    }));
    this.saveToStorage();
  }

  updateLandingSections(sections: LandingSection[]): void {
    this._config.update((c) => ({
      ...c,
      landingPage: { ...c.landingPage, sections },
    }));
    this.saveToStorage();
  }

  toggleSection(sectionId: string): void {
    this._config.update((c) => ({
      ...c,
      landingPage: {
        ...c.landingPage,
        sections: c.landingPage.sections.map((s) =>
          s.id === sectionId ? { ...s, enabled: !s.enabled } : s
        ),
      },
    }));
    this.saveToStorage();
  }

  reorderSections(fromIndex: number, toIndex: number): void {
    this._config.update((c) => {
      const sections = [...c.landingPage.sections];
      const [moved] = sections.splice(fromIndex, 1);
      sections.splice(toIndex, 0, moved);
      return {
        ...c,
        landingPage: {
          ...c.landingPage,
          sections: sections.map((s, i) => ({ ...s, order: i })),
        },
      };
    });
    this.saveToStorage();
  }

  clear(): void {
    this._config.set(this.getDefaultConfig());
    this._step.set(0);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  getStepTitle(step: number): string {
    const titles = [
      'Business Info',
      'Features',
      'Services',
      'Design',
      'Review',
    ];
    return titles[step] || '';
  }

  canProceed(): boolean {
    const config = this._config();
    const step = this._step();

    switch (step) {
      case 0:
        return !!config.brand.businessName && !!config.brand.monogram;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  }
}
