import { BUSINESS_PRESENCE_RUNTIME_SECTION_TYPES } from './business-presence-runtime';
import { supportsBusinessPresenceSection } from './business-presence-runtime';

describe('business presence runtime', () => {
  it('supports every landing block exposed by the business feature catalog', () => {
    for (const type of BUSINESS_PRESENCE_RUNTIME_SECTION_TYPES) {
      expect(supportsBusinessPresenceSection(type)).toBe(true);
    }
  });

  it('supports blog sections for document and public runtime consumers', () => {
    expect(supportsBusinessPresenceSection('blog')).toBe(true);
  });

  it('rejects an unsupported persisted section type', () => {
    expect(supportsBusinessPresenceSection('retired-promo')).toBe(false);
  });
});
