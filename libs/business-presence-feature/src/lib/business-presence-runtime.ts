import type { LandingSection } from '@optimistic-tanuki/business-data-access';

/**
 * Section types deliberately supported by the business presence public and
 * preview renderer. Keep this list explicit so catalog additions require a
 * conscious runtime decision.
 */
export const BUSINESS_PRESENCE_RUNTIME_SECTION_TYPES = [
  'hero',
  'about',
  'services',
  'store',
  'testimonials',
  'contact',
  'booking',
  'custom',
  'image',
  'gallery',
] as const satisfies readonly LandingSection['type'][];

const SUPPORTED_SECTION_TYPES = new Set<string>(
  BUSINESS_PRESENCE_RUNTIME_SECTION_TYPES
);

export function supportsBusinessPresenceSection(type: string): boolean {
  return SUPPORTED_SECTION_TYPES.has(type);
}
