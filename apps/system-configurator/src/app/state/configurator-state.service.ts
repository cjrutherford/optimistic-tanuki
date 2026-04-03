import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ConfigurationDto,
  PriceBreakdown,
  ShippingAddress,
} from '../services/hardware.service';

interface CheckoutDraft {
  shipping: ShippingAddress;
  customerEmail: string;
  paymentMethod: string;
}

@Injectable({
  providedIn: 'root',
})
export class ConfiguratorStateService {
  private readonly draftKey = 'hai-system-configurator-draft';
  private readonly checkoutKey = 'hai-system-configurator-checkout';
  private readonly platformId = inject(PLATFORM_ID);

  readonly draft = signal<ConfigurationDto | null>(this.readDraft());
  readonly priceBreakdown = signal<PriceBreakdown | null>(null);
  readonly checkoutDraft = signal<CheckoutDraft>(this.readCheckoutDraft());

  setDraft(draft: ConfigurationDto): void {
    this.draft.set(draft);
    if (this.isBrowser()) {
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
    }
  }

  patchDraft(patch: Partial<ConfigurationDto>): void {
    const next = {
      ...(this.draft() || {
        chassisId: '',
        chassisType: '',
        useCase: '',
        cpuId: '',
        ramId: '',
        storageIds: [],
      }),
      ...patch,
    };
    this.setDraft(next);
  }

  setPriceBreakdown(price: PriceBreakdown | null): void {
    this.priceBreakdown.set(price);
  }

  setCheckoutDraft(draft: CheckoutDraft): void {
    this.checkoutDraft.set(draft);
    if (this.isBrowser()) {
      localStorage.setItem(this.checkoutKey, JSON.stringify(draft));
    }
  }

  clear(): void {
    this.draft.set(null);
    this.priceBreakdown.set(null);
    this.checkoutDraft.set(this.defaultCheckoutDraft());
    if (this.isBrowser()) {
      localStorage.removeItem(this.draftKey);
      localStorage.removeItem(this.checkoutKey);
    }
  }

  private readDraft(): ConfigurationDto | null {
    if (!this.isBrowser()) {
      return null;
    }

    const value = localStorage.getItem(this.draftKey);
    return value ? (JSON.parse(value) as ConfigurationDto) : null;
  }

  private readCheckoutDraft(): CheckoutDraft {
    if (!this.isBrowser()) {
      return this.defaultCheckoutDraft();
    }

    const value = localStorage.getItem(this.checkoutKey);
    return value
      ? (JSON.parse(value) as CheckoutDraft)
      : this.defaultCheckoutDraft();
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private defaultCheckoutDraft(): CheckoutDraft {
    return {
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
  }
}
