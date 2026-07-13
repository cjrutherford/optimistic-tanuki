import { BusinessOwnerAdCampaignPageComponent } from './business-owner-ad-campaign-page.component';

describe('BusinessOwnerAdCampaignPageComponent', () => {
  it('limits community targets to on-page placement', () => {
    expect(
      BusinessOwnerAdCampaignPageComponent.placementsForTarget('community')
    ).toEqual(['on-page']);
    expect(
      BusinessOwnerAdCampaignPageComponent.placementsForTarget('channel')
    ).toContain('mid-roll');
  });
});
