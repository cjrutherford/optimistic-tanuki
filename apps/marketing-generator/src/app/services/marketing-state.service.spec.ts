import { TestBed } from '@angular/core/testing';
import { MarketingStateService } from './marketing-state.service';

describe('MarketingStateService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MarketingStateService],
    });
  });

  it('provides default deliverables, brand profile, and image generation settings', () => {
    const service = TestBed.inject(MarketingStateService);

    expect(service.request().deliverables.length).toBeGreaterThan(0);
    expect(service.request().deliverables[0]).toEqual(
      expect.objectContaining({
        type: 'flyer',
        formatId: expect.any(String),
        quantity: 1,
      })
    );
    expect(service.request().generateImages).toBe(true);
    expect(service.request().brand.businessName).toBe('');
    expect(service.request().visualDirection).toBe('');
  });

  it('merges nested custom app updates through patchRequest', () => {
    const service = TestBed.inject(MarketingStateService);

    service.patchRequest({
      customApp: {
        name: 'Atlas Room',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
    });

    expect(service.request().customApp.name).toBe('Atlas Room');
    expect(service.request().selectedOfferingId).toBe('video-client');
  });

  it('merges nested brand updates through patchRequest', () => {
    const service = TestBed.inject(MarketingStateService);

    service.patchRequest({
      brand: {
        businessName: 'Atlas Room',
        tagline: '',
        primaryColor: '#1d4ed8',
        secondaryColor: '',
        accentColor: '',
        visualStyle: '',
        logoUrl: '',
      },
    });

    expect(service.request().brand.businessName).toBe('Atlas Room');
    expect(service.request().brand.primaryColor).toBe('#1d4ed8');
    expect(service.request().audienceId).toBe('creators');
  });
});
