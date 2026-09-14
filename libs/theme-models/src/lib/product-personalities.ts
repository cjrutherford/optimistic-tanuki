/**
 * Canonical product → personality mapping.
 *
 * Each product in the Optimistic Tanuki portfolio declares one default
 * personality from the predefined personality registry. This mapping is the
 * product-catalog source of truth used by:
 *
 * - marketing documentation (PRODUCT.md, per-product one-pagers)
 * - the design-system documentation (`docs/design-system/personalities.md`)
 * - comparison UI that renders product → personality cards
 *
 * - app bootstrap, via `provideProductTheme()` in theme-lib
 *
 * App `index.html` files also set matching `data-personality` attributes for
 * the initial render before Angular hydrates.
 *
 * Users can still switch personalities at runtime; this is the canonical
 * default that ships with each product.
 *
 * See `docs/marketing/marketing-design-review.md` for the rationale behind
 * each pairing.
 */

import { Personality } from './personality.interfaces';
import {
  PREDEFINED_PERSONALITIES,
  classicPersonality,
  getPersonalityById,
} from './personalities';

/**
 * The theme an app starts in before its user has chosen one.
 *
 * `mode: 'auto'` follows the operating system's colour-scheme preference.
 */
export interface ProductThemeDefaults {
  personalityId: string;
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
}

/**
 * Primary colour used when a product does not declare its own.
 */
export const DEFAULT_PRIMARY_COLOR = '#3f51b5';

/**
 * Default personality id used when a product has no explicit mapping.
 */
export const DEFAULT_PERSONALITY_ID = 'classic';

/**
 * Maps Nx project name → the theme the app ships with.
 *
 * Keys match the directory name under `apps/`. Apps apply their entry with
 * `provideProductTheme('<project>')` from theme-lib, which only takes effect
 * while the user has no saved theme of their own.
 */
export const PRODUCT_THEME_DEFAULTS: Record<string, ProductThemeDefaults> = {
  // Optimistic Tanuki - community social surfaces read warmer and more
  // approachable with soft-touch.
  'client-interface': {
    personalityId: 'soft-touch',
    mode: 'light',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  },

  // Towne Square - local-first community + commerce wants the warm,
  // organic, gentle "soft-touch" aesthetic.
  'local-hub': {
    personalityId: 'soft-touch',
    mode: 'light',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  },

  // Forge of Will - focused project execution; the Bold personality
  // emphasises high-energy, action-focused delivery.
  forgeofwill: {
    personalityId: 'bold',
    mode: 'light',
    primaryColor: '#0EA5E9',
  },

  // Fin Commander - data-driven financial planning; the Professional
  // personality emphasises trust and clarity.
  'fin-commander': {
    personalityId: 'professional',
    mode: 'light',
    primaryColor: '#0d5f73',
  },

  // Signal Foundry - generator and editor workflows benefit from the
  // technical density of control-center.
  'marketing-generator': {
    personalityId: 'control-center',
    mode: 'dark',
    primaryColor: '#d97706',
  },

  // Developer Portal - API docs and onboarding put clarity and a neutral
  // layout first.
  'developer-portal': {
    personalityId: 'foundation',
    mode: 'light',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  },

  // Operator and hardware dashboards need technical density and clear
  // controls.
  'owner-console': {
    personalityId: 'control-center',
    mode: 'light',
    primaryColor: '#2dd4bf',
  },
  'system-configurator': {
    personalityId: 'control-center',
    mode: 'light',
    primaryColor: '#2dd4bf',
  },
  'leads-app': {
    personalityId: 'control-center',
    mode: 'light',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  },

  // First-run setup is a guided, practical flow: keep it neutral and clear.
  'setup-console': {
    personalityId: 'foundation',
    mode: 'light',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  },

  // Personal/editorial consulting content: refined typography, premium tone.
  'christopherrutherford-net': {
    personalityId: 'elegant',
    mode: 'dark',
    primaryColor: '#006064',
  },

  // B2B public and portal flows need trustworthy enterprise defaults. Hosted
  // tenant sites replace this with their own configured theme.
  'business-site': {
    personalityId: 'professional',
    mode: 'light',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  },
  'business-configurator': {
    personalityId: 'professional',
    mode: 'light',
    primaryColor: '#1f7a63',
  },

  // Homesteading/community content aligns with organic warmth.
  'digital-homestead': {
    personalityId: 'soft-touch',
    mode: 'dark',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  },

  // Reflection/wellness practice needs calm, gentle visuals.
  d6: {
    personalityId: 'soft-touch',
    mode: 'light',
    primaryColor: '#6b8f8a',
  },

  // Owned-computing messaging should remain clear, practical, and minimal.
  hai: {
    personalityId: 'foundation',
    mode: 'light',
    primaryColor: '#204434',
  },

  // Tenant shells need a neutral baseline that can accept tenant branding.
  'configurable-client': {
    personalityId: 'foundation',
    mode: 'light',
    primaryColor: '#356c91',
  },

  // Commerce surfaces benefit from friendly energy.
  'store-client': {
    personalityId: 'playful',
    mode: 'dark',
    primaryColor: '#c2185b',
  },

  // Video discovery and creator surfaces need kinetic, vibrant personality.
  'video-client': {
    personalityId: 'electric',
    mode: 'light',
    primaryColor: DEFAULT_PRIMARY_COLOR,
  },

  // A lesson console: raw, structural, monospace, following the OS scheme.
  learning: {
    personalityId: 'architect',
    mode: 'auto',
    primaryColor: '#0d7a66',
  },
};

/**
 * Maps Nx project name → canonical personality id. Derived from
 * `PRODUCT_THEME_DEFAULTS`.
 */
export const PRODUCT_PERSONALITIES: Record<string, string> = Object.fromEntries(
  Object.entries(PRODUCT_THEME_DEFAULTS).map(([project, defaults]) => [
    project,
    defaults.personalityId,
  ])
);

/**
 * Get the theme defaults for a product, falling back to the Classic
 * personality in light mode for unmapped products.
 */
export function getProductThemeDefaults(
  projectName: string
): ProductThemeDefaults {
  return (
    PRODUCT_THEME_DEFAULTS[projectName] ?? {
      personalityId: DEFAULT_PERSONALITY_ID,
      mode: 'light',
      primaryColor: DEFAULT_PRIMARY_COLOR,
    }
  );
}

/**
 * Get the canonical Personality object for a product.
 *
 * Falls back to the Classic personality if the product is unmapped or the
 * mapped personality id is not registered.
 */
export function getProductPersonality(projectName: string): Personality {
  const id = PRODUCT_PERSONALITIES[projectName] ?? DEFAULT_PERSONALITY_ID;
  return getPersonalityById(id) ?? classicPersonality;
}

/**
 * Get the canonical personality id for a product, or the default.
 */
export function getProductPersonalityId(projectName: string): string {
  return PRODUCT_PERSONALITIES[projectName] ?? DEFAULT_PERSONALITY_ID;
}

/**
 * Inverse lookup: which products use a given personality?
 */
export function getProductsForPersonality(personalityId: string): string[] {
  return Object.entries(PRODUCT_PERSONALITIES)
    .filter(([, id]) => id === personalityId)
    .map(([product]) => product);
}

/**
 * Public display name + tagline for each product, mirrored from the
 * marketing one-pagers. Kept here so UI components (e.g. personality
 * comparison, marketing showcase) can render product → personality
 * cards without duplicating the mapping.
 */
export interface ProductDescriptor {
  /** Nx project name (matches keys of PRODUCT_PERSONALITIES). */
  project: string;
  /** Public marketing name. */
  name: string;
  /** Short tagline, suitable for a card/badge. */
  tagline: string;
  /** Canonical personality id. */
  personalityId: string;
  /** Category emoji / badge identifier for marketing docs. */
  category:
    | 'social'
    | 'community'
    | 'execution'
    | 'finance'
    | 'marketing'
    | 'developer';
}

export const PRODUCT_DESCRIPTORS: ProductDescriptor[] = [
  {
    project: 'client-interface',
    name: 'Optimistic Tanuki',
    tagline: 'Community-owned social networking for defined groups.',
    personalityId: 'soft-touch',
    category: 'social',
  },
  {
    project: 'local-hub',
    name: 'Towne Square',
    tagline: 'Local coordination, classifieds, donations, and civic life.',
    personalityId: 'soft-touch',
    category: 'community',
  },
  {
    project: 'forgeofwill',
    name: 'Forge of Will',
    tagline: 'Focused project execution with daily momentum.',
    personalityId: 'bold',
    category: 'execution',
  },
  {
    project: 'fin-commander',
    name: 'Fin Commander',
    tagline: 'Guided financial planning, plans, scenarios, and imports.',
    personalityId: 'professional',
    category: 'finance',
  },
  {
    project: 'marketing-generator',
    name: 'Signal Foundry',
    tagline: 'Briefs → concepts → coordinated campaign output.',
    personalityId: 'control-center',
    category: 'marketing',
  },
  {
    project: 'developer-portal',
    name: 'Developer Portal',
    tagline: 'API docs, SDK onboarding, and metered usage.',
    personalityId: 'foundation',
    category: 'developer',
  },
];

/** Convenience lookup. */
export function getProductDescriptor(
  project: string
): ProductDescriptor | undefined {
  return PRODUCT_DESCRIPTORS.find((p) => p.project === project);
}

/**
 * Quick sanity check used by tests: every product personality id must
 * resolve to a registered personality.
 */
export function assertProductPersonalitiesAreValid(): void {
  const known = new Set(PREDEFINED_PERSONALITIES.map((p) => p.id));
  for (const [project, id] of Object.entries(PRODUCT_PERSONALITIES)) {
    if (!known.has(id)) {
      throw new Error(
        `Product "${project}" maps to unknown personality "${id}".`
      );
    }
  }
}
