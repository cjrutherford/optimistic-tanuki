import { isValidCampaignTargetPlacement } from '@optimistic-tanuki/models';

describe('advertising campaign target placement', () => {
  it('allows roll placement only on a channel target', () => {
    expect(
      isValidCampaignTargetPlacement({
        targetType: 'channel',
        placementType: 'mid-roll',
      })
    ).toBe(true);
    expect(
      isValidCampaignTargetPlacement({
        targetType: 'community',
        placementType: 'mid-roll',
      })
    ).toBe(false);
  });
});
