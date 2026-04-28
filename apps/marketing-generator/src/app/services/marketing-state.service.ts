import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BrandProfile, CampaignConcept, GenerationRequest } from '../types';

const DEFAULT_BRAND: BrandProfile = {
  businessName: '',
  tagline: '',
  primaryColor: '#f59e0b',
  secondaryColor: '#111827',
  accentColor: '#34d399',
  visualStyle: '',
  logoUrl: '',
};

const DEFAULT_REQUEST: GenerationRequest = {
  offeringKind: 'preset-app',
  selectedOfferingId: 'video-client',
  customApp: {
    name: '',
    category: '',
    summary: '',
    features: '',
    differentiators: '',
    primaryGoal: '',
  },
  audienceId: 'creators',
  campaignIntent: 'awareness',
  channel: 'web',
  tone: 'editorial',
  includeAiPolish: true,
  deliverables: [{ type: 'flyer', formatId: 'flyer-letter', quantity: 1 }],
  brand: DEFAULT_BRAND,
  visualDirection: '',
  generateImages: true,
};

@Injectable({
  providedIn: 'root',
})
export class MarketingStateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly requestKey = 'signal-foundry-request';
  private readonly conceptsKey = 'signal-foundry-concepts';

  readonly request = signal<GenerationRequest>(this.readRequest());
  readonly concepts = signal<CampaignConcept[]>(this.readConcepts());

  setRequest(request: GenerationRequest): void {
    this.request.set(request);
    this.persist(this.requestKey, request);
  }

  patchRequest(patch: Partial<GenerationRequest>): void {
    this.setRequest({
      ...this.request(),
      ...patch,
      customApp: {
        ...this.request().customApp,
        ...(patch.customApp || {}),
      },
      brand: {
        ...this.request().brand,
        ...(patch.brand || {}),
      },
      deliverables: patch.deliverables || this.request().deliverables,
    });
  }

  setConcepts(concepts: CampaignConcept[]): void {
    this.concepts.set(concepts);
    this.persist(this.conceptsKey, concepts);
  }

  private readRequest(): GenerationRequest {
    if (!this.isBrowser()) {
      return DEFAULT_REQUEST;
    }

    const value = localStorage.getItem(this.requestKey);
    if (!value) {
      return DEFAULT_REQUEST;
    }

    const parsed = JSON.parse(value) as Partial<GenerationRequest>;
    return {
      ...DEFAULT_REQUEST,
      ...parsed,
      customApp: {
        ...DEFAULT_REQUEST.customApp,
        ...(parsed.customApp || {}),
      },
      brand: {
        ...DEFAULT_BRAND,
        ...(parsed.brand || {}),
      },
      deliverables: parsed.deliverables?.length
        ? parsed.deliverables
        : DEFAULT_REQUEST.deliverables,
    };
  }

  private readConcepts(): CampaignConcept[] {
    if (!this.isBrowser()) {
      return [];
    }

    const value = localStorage.getItem(this.conceptsKey);
    return value ? (JSON.parse(value) as CampaignConcept[]) : [];
  }

  private persist(key: string, value: unknown): void {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
