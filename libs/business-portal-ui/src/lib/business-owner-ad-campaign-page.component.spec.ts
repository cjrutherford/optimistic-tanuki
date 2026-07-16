import { BusinessOwnerAdCampaignPageComponent } from './business-owner-ad-campaign-page.component';
import { BusinessApiService } from '@optimistic-tanuki/business-data-access';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

describe('BusinessOwnerAdCampaignPageComponent', () => {
  it('limits community targets to on-page placement', () => {
    expect(
      BusinessOwnerAdCampaignPageComponent.placementsForTarget('community')
    ).toEqual(['on-page']);
    expect(
      BusinessOwnerAdCampaignPageComponent.placementsForTarget('channel')
    ).toContain('mid-roll');
  });

  it('serializes the placement media URL as mediaUrl when saving', async () => {
    const createAdvertisingCampaign = jest
      .fn()
      .mockReturnValue(of({ id: 'campaign-1' }));
    await TestBed.configureTestingModule({
      imports: [BusinessOwnerAdCampaignPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getOwnerBusinessPages: jest
              .fn()
              .mockReturnValue(
                of([
                  {
                    id: 'business-1',
                    communityId: 'community-1',
                    name: 'Shop',
                  },
                ])
              ),
            getSponsorChannels: jest.fn().mockReturnValue(of([])),
            getOwnerAdvertisingCampaigns: jest.fn().mockReturnValue(of([])),
            createAdvertisingCampaign,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      BusinessOwnerAdCampaignPageComponent
    );
    const component = fixture.componentInstance;
    component.businessPageId = 'business-1';
    component.name = 'Spring campaign';
    component.toggleTarget('community', 'community-1', true);
    (component.creativeDrafts['on-page'] as any).mediaUrl =
      'https://cdn.example.com/spring.jpg';

    await component.save();

    expect(createAdvertisingCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        creatives: [
          expect.objectContaining({
            placementType: 'on-page',
            mediaUrl: 'https://cdn.example.com/spring.jpg',
          }),
        ],
      })
    );
  });

  it('maps a legacy imageUrl into the editor media field when editing', async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessOwnerAdCampaignPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getOwnerBusinessPages: jest.fn().mockReturnValue(of([])),
            getSponsorChannels: jest.fn().mockReturnValue(of([])),
            getOwnerAdvertisingCampaigns: jest.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();

    const component = TestBed.createComponent(
      BusinessOwnerAdCampaignPageComponent
    ).componentInstance;

    component.edit({
      id: 'campaign-1',
      businessPageId: 'business-1',
      name: 'Legacy campaign',
      status: 'draft',
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-01-31T00:00:00.000Z',
      creatives: [
        {
          placementType: 'on-page',
          imageUrl: 'https://cdn.example.com/legacy.jpg',
        },
      ],
      targetPlacements: [
        {
          targetType: 'community',
          targetId: 'community-1',
          placementType: 'on-page',
        },
      ],
    });

    expect((component.creativeDrafts['on-page'] as any).mediaUrl).toBe(
      'https://cdn.example.com/legacy.jpg'
    );
  });

  it('shows actionable validation and does not save an invalid media URL', async () => {
    const createAdvertisingCampaign = jest.fn();
    await TestBed.configureTestingModule({
      imports: [BusinessOwnerAdCampaignPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getOwnerBusinessPages: jest.fn().mockReturnValue(of([])),
            getSponsorChannels: jest.fn().mockReturnValue(of([])),
            getOwnerAdvertisingCampaigns: jest.fn().mockReturnValue(of([])),
            createAdvertisingCampaign,
          },
        },
      ],
    }).compileComponents();

    const component = TestBed.createComponent(
      BusinessOwnerAdCampaignPageComponent
    ).componentInstance;
    component.businessPageId = 'business-1';
    component.name = 'Invalid campaign';
    component.toggleTarget('community', 'community-1', true);
    (component.creativeDrafts['on-page'] as any).mediaUrl =
      'http://unsafe.test/ad.jpg';

    await component.save();

    expect(createAdvertisingCampaign).not.toHaveBeenCalled();
    expect(component.message()).toContain('HTTPS');
  });
});
