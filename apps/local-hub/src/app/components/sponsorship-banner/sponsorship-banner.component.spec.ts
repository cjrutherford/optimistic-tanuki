import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SponsorshipBannerComponent } from './sponsorship-banner.component';
import { PaymentService } from '../../services/payment.service';

describe('SponsorshipBannerComponent', () => {
  let fixture: ComponentFixture<SponsorshipBannerComponent>;
  const paymentService = {
    getActiveSponsorships: jest.fn(),
  };

  beforeEach(async () => {
    paymentService.getActiveSponsorships.mockResolvedValue([
      {
        id: 'sponsorship-1',
        communityId: 'community-1',
        sponsorUserId: 'sponsor-1',
        type: 'banner',
        amount: 100,
        currency: 'USD',
        status: 'active',
        adContent: 'Plan with confidence',
        adImageUrl: 'https://cdn.example.com/new.jpg',
        paidAt: '2026-07-01T00:00:00.000Z',
        expiresAt: '2026-08-01T00:00:00.000Z',
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

  it('renders an active sponsorship image and content', () => {
    const image = fixture.nativeElement.querySelector(
      '.ad-image'
    ) as HTMLImageElement;

    expect(image.src).toBe('https://cdn.example.com/new.jpg');
    expect(fixture.nativeElement.textContent).toContain('Plan with confidence');
    expect(fixture.nativeElement.textContent).toContain('Sponsored');
  });

  it('does not render an image when a sponsorship has no image URL', async () => {
    paymentService.getActiveSponsorships.mockResolvedValueOnce([
      {
        id: 'sponsorship-2',
        communityId: 'community-2',
        sponsorUserId: 'sponsor-2',
        type: 'banner',
        amount: 100,
        currency: 'USD',
        status: 'active',
        adContent: 'Text-only sponsorship',
        paidAt: '2026-07-01T00:00:00.000Z',
        expiresAt: '2026-08-01T00:00:00.000Z',
      },
    ]);

    const secondFixture = TestBed.createComponent(SponsorshipBannerComponent);
    secondFixture.componentInstance.communityId = 'community-2';
    secondFixture.detectChanges();
    await secondFixture.whenStable();
    secondFixture.detectChanges();

    expect(secondFixture.nativeElement.querySelector('.ad-image')).toBeNull();
    expect(secondFixture.nativeElement.textContent).toContain(
      'Text-only sponsorship'
    );
  });
});
