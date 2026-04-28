import { MarketingMaterialType, MaterialSurfaceType } from '../types';

export interface MaterialFormatPreset {
  id: string;
  type: MarketingMaterialType;
  label: string;
  width: number;
  height: number;
  unit: 'px';
  dpi?: number;
  surfaces: MaterialSurfaceType[];
  layoutVariants: string[];
}

export const MATERIAL_FORMAT_PRESETS: Record<
  MarketingMaterialType,
  MaterialFormatPreset[]
> = {
  flyer: [
    {
      id: 'flyer-letter',
      type: 'flyer',
      label: 'Letter Flyer',
      width: 1275,
      height: 1650,
      unit: 'px',
      dpi: 150,
      surfaces: ['front'],
      layoutVariants: ['hero-focus', 'offer-grid'],
    },
  ],
  brochure: [
    {
      id: 'brochure-trifold',
      type: 'brochure',
      label: 'Tri-Fold Brochure',
      width: 2550,
      height: 3300,
      unit: 'px',
      dpi: 150,
      surfaces: ['front', 'inside-left', 'inside-right', 'back'],
      layoutVariants: ['story-panels', 'feature-walkthrough'],
    },
  ],
  'business-card': [
    {
      id: 'business-card-standard',
      type: 'business-card',
      label: 'Standard Card',
      width: 1050,
      height: 600,
      unit: 'px',
      dpi: 300,
      surfaces: ['front', 'back'],
      layoutVariants: ['minimal-mark', 'contact-first'],
    },
  ],
  'web-ad': [
    {
      id: 'web-ad-square',
      type: 'web-ad',
      label: 'Square Ad',
      width: 1080,
      height: 1080,
      unit: 'px',
      surfaces: ['single'],
      layoutVariants: ['bold-cta', 'product-spotlight'],
    },
    {
      id: 'web-ad-leaderboard',
      type: 'web-ad',
      label: 'Leaderboard',
      width: 1456,
      height: 180,
      unit: 'px',
      surfaces: ['single'],
      layoutVariants: ['headline-strip', 'proof-bar'],
    },
  ],
};

export function findMaterialFormatPreset(
  type: MarketingMaterialType,
  formatId: string
): MaterialFormatPreset | undefined {
  return MATERIAL_FORMAT_PRESETS[type].find((preset) => preset.id === formatId);
}
