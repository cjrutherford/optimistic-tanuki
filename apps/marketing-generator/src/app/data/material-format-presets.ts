import {
  MarketingMaterialType,
  MaterialSurfaceType,
  MaterialTemplateFamily,
} from '../types';

export interface MaterialFormatPreset {
  id: string;
  type: MarketingMaterialType;
  label: string;
  width: number;
  height: number;
  unit: 'px';
  dpi?: number;
  surfaces: MaterialSurfaceType[];
  templateFamily: MaterialTemplateFamily;
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
      templateFamily: 'print-flyer',
      layoutVariants: ['issue-led', 'community-bulletin', 'offer-dominant'],
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
      templateFamily: 'print-brochure',
      layoutVariants: ['story-sequence', 'feature-panels', 'operator-brief'],
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
      templateFamily: 'print-business-card',
      layoutVariants: ['contact-first', 'brand-mark', 'appointment-card'],
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
      templateFamily: 'web-display-ad',
      layoutVariants: ['display-cta', 'proof-stack'],
    },
    {
      id: 'web-ad-leaderboard',
      type: 'web-ad',
      label: 'Leaderboard',
      width: 1456,
      height: 180,
      unit: 'px',
      surfaces: ['single'],
      templateFamily: 'web-display-ad',
      layoutVariants: ['headline-strip', 'announcement-strip'],
    },
  ],
};

export function findMaterialFormatPreset(
  type: MarketingMaterialType,
  formatId: string
): MaterialFormatPreset | undefined {
  return MATERIAL_FORMAT_PRESETS[type].find((preset) => preset.id === formatId);
}
