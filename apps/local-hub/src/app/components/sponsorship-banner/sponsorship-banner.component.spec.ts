import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SponsorshipBannerComponent } from './sponsorship-banner.component';
import { PaymentService } from '../../services/payment.service';

describe('SponsorshipBannerComponent', () => {
  let fixture: ComponentFixture<SponsorshipBannerComponent>;
  const paymentService = {
    getEligibleOnPageCampaigns: jest.fn(),
  };

  beforeEach(async () => {
    paymentService.getEligibleOnPageCampaigns.mockResolvedValue([
      {
        id: 'campaign-1',
        name: 'North Star Advisory',
        creative: {
          headline: 'Plan with confidence',
          mediaUrl: 'https://cdn.example.com/new.jpg',
          imageUrl: 'https://cdn.example.com/legacy.jpg',
          ctaLabel: 'Visit North Star',
          ctaUrl: 'https://north-star.example.com',
        },
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [SponsorshipBannerComponent],
      providers: [{ provide: PaymentService, useValue: paymentService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SponsorshipBannerComponent);
    fixture.componentInstance.communityId = 'community-1';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders mediaUrl in preference to the legacy imageUrl and a safe CTA', () => {
    const image = fixture.nativeElement.querySelector(
      '.ad-image'
    ) as HTMLImageElement;
    const link = fixture.nativeElement.querySelector(
      '.ad-cta'
    ) as HTMLAnchorElement;

    expect(image.src).toBe('https://cdn.example.com/new.jpg');
    expect(link.href).toBe('https://north-star.example.com/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.textContent).toContain('Visit North Star');
    expect(fixture.nativeElement.textContent).toContain('Sponsored');
  });

  it('renders a legacy imageUrl when mediaUrl is absent', async () => {
    paymentService.getEligibleOnPageCampaigns.mockResolvedValueOnce([
      {
        id: 'campaign-2',
        name: 'Legacy sponsor',
        creative: {
          headline: 'Legacy creative',
          imageUrl: 'https://cdn.example.com/legacy.jpg',
        },
      },
    ]);

    const secondFixture = TestBed.createComponent(SponsorshipBannerComponent);
    secondFixture.componentInstance.communityId = 'community-2';
    secondFixture.detectChanges();
    await secondFixture.whenStable();
    secondFixture.detectChanges();

    expect(
      (
        secondFixture.nativeElement.querySelector(
          '.ad-image'
        ) as HTMLImageElement
      ).src
    ).toBe('https://cdn.example.com/legacy.jpg');
  });
});
