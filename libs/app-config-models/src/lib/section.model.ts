/**
 * Types of sections that can be used in landing pages
 */
export type SectionType =
  | 'hero'
  | 'features'
  | 'content'
  | 'grid'
  | 'cta'
  | 'footer';

/**
 * Layout options for landing pages
 */
export type LayoutType = 'single-column' | 'sidebar' | 'wide';

export type SectionMediaSourceType = 'url' | 'asset';
export type SectionMediaAspect = 'landscape' | 'square' | 'portrait' | 'auto';
export type SectionMediaFit = 'cover' | 'contain';
export type SectionMediaFocalPoint =
  | 'center'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left';
export type SectionMotionKind =
  | 'none'
  | 'particle-veil'
  | 'parallax-grid-warp'
  | 'aurora-ribbon'
  | 'glass-fog'
  | 'pulse-rings'
  | 'signal-mesh'
  | 'topographic-drift'
  | 'shimmer-beam';

export interface SectionMediaItem {
  sourceType: SectionMediaSourceType;
  src: string;
  alt: string;
  caption?: string;
  aspect?: SectionMediaAspect;
  fit?: SectionMediaFit;
  focalPoint?: SectionMediaFocalPoint;
}

export interface SectionMotionConfig {
  kind?: SectionMotionKind;
  density?: number;
  speed?: number;
  intensity?: number;
  height?: string;
  reducedMotion?: boolean;
  direction?: 'diagonal' | 'horizontal';
  ringCount?: number;
}

/**
 * Base interface for all section configurations
 */
export interface BaseSection {
  id: string;
  type: SectionType;
  order: number;
  visible: boolean;
  motion?: SectionMotionConfig;
}

/**
 * Hero section configuration
 */
export interface HeroSection extends BaseSection {
  type: 'hero';
  title: string;
  subtitle?: string;
  backgroundImage?: string;
  background?: SectionMediaItem;
  ctaText?: string;
  ctaLink?: string;
}

/**
 * Features section configuration
 */
export interface FeaturesSection extends BaseSection {
  type: 'features';
  title: string;
  features: Array<{
    icon?: string;
    title: string;
    description: string;
  }>;
}

/**
 * Content section configuration
 */
export interface ContentSection extends BaseSection {
  type: 'content';
  title?: string;
  content: string;
  imageUrl?: string;
  image?: SectionMediaItem;
  imagePosition?: 'left' | 'right' | 'top' | 'bottom';
}

/**
 * Grid section configuration
 */
export interface GridSection extends BaseSection {
  type: 'grid';
  title?: string;
  columns: number;
  items: Array<{
    title: string;
    description?: string;
    imageUrl?: string;
    link?: string;
  }>;
}

/**
 * Call-to-action section configuration
 */
export interface CTASection extends BaseSection {
  type: 'cta';
  title: string;
  description?: string;
  buttonText: string;
  buttonLink: string;
}

/**
 * Footer section configuration
 */
export interface FooterSection extends BaseSection {
  type: 'footer';
  content: string;
  links?: Array<{
    text: string;
    url: string;
  }>;
}

/**
 * Union type for all section types
 */
export type Section =
  | HeroSection
  | FeaturesSection
  | ContentSection
  | GridSection
  | CTASection
  | FooterSection;
