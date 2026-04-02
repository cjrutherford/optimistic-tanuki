import { Injectable, signal } from '@angular/core';
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

  readonly draft = signal<ConfigurationDto | null>(this.readDraft());
  readonly priceBreakdown = signal<PriceBreakdown | null>(null);
  readonly checkoutDraft = signal<CheckoutDraft>(this.readCheckoutDraft());

  setDraft(draft: ConfigurationDto): void {
    this.draft.set(draft);
    localStorage.setItem(this.draftKey, JSON.stringify(draft));
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
    localStorage.setItem(this.checkoutKey, JSON.stringify(draft));
  }

  clear(): void {
    this.draft.set(null);
    this.priceBreakdown.set(null);
    this.checkoutDraft.set(this.defaultCheckoutDraft());
    localStorage.removeItem(this.draftKey);
    localStorage.removeItem(this.checkoutKey);
  }

  private readDraft(): ConfigurationDto | null {
    const value = localStorage.getItem(this.draftKey);
    return value ? (JSON.parse(value) as ConfigurationDto) : null;
  }

  private readCheckoutDraft(): CheckoutDraft {
    const value = localStorage.getItem(this.checkoutKey);
    return value
      ? (JSON.parse(value) as CheckoutDraft)
      : this.defaultCheckoutDraft();
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
