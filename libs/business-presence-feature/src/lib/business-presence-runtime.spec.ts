import { BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS } from './business-presence-block-definitions';
import { supportsBusinessPresenceSection } from './business-presence-runtime';

describe('business presence runtime', () => {
  it('supports every landing block exposed by the business feature catalog', () => {
    for (const type of Object.keys(BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS)) {
      expect(supportsBusinessPresenceSection(type)).toBe(true);
    }
  });

  it('rejects an unsupported persisted section type', () => {
    expect(supportsBusinessPresenceSection('retired-promo')).toBe(false);
  });
});
