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
 * Maps Nx project name → canonical personality id.
 *
 * Keys are the project / app names as they appear in the Nx workspace
 * (matching the directory name under `apps/`).
 */
export const PRODUCT_PERSONALITIES: Record<string, string> = {
  // Optimistic Tanuki - the namesake community social app keeps the
  // traditional, trustworthy Classic personality.
  'client-interface': 'classic',

  // Towne Square - local-first community + commerce wants the warm,
  // organic, gentle "soft-touch" aesthetic.
  'local-hub': 'soft-touch',

  // Forge of Will - focused project execution; the Bold personality
  // emphasises high-energy, action-focused delivery.
  forgeofwill: 'bold',

  // Fin Commander - data-driven financial planning; the Professional
  // personality emphasises trust and clarity.
  'fin-commander': 'professional',

  // Signal Foundry - marketing-generator campaign workbench; the
  // Electric personality reflects vibrant, kinetic creative output.
  'marketing-generator': 'electric',

  // Developer Portal - API and SDK documentation; Architect (brutalist
  // technical) reflects the developer-focused aesthetic.
  'developer-portal': 'architect',
};

/**
 * Default personality id used when a product has no explicit mapping.
 */
export const DEFAULT_PERSONALITY_ID = 'classic';

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
    personalityId: 'classic',
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
    personalityId: 'electric',
    category: 'marketing',
  },
  {
    project: 'developer-portal',
    name: 'Developer Portal',
    tagline: 'API docs, SDK onboarding, and metered usage.',
    personalityId: 'architect',
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
