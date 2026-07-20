export interface BusinessThemeConfig {
  mode: 'light' | 'dark';
  personalityId: string;
  primaryColor: string;
}

export interface BusinessTestimonial {
  quote: string;
  clientName: string;
  clientDetail: string;
}

export interface BusinessFeatures {
  store: {
    enabled: boolean;
  };
  booking: {
    enabled: boolean;
    allowOnlinePayment?: boolean;
  };
  clientTasks: {
    enabled: boolean;
    allowClientCompletion: boolean;
  };
  clientPortal: {
    enabled: boolean;
  };
  invoices: {
    enabled: boolean;
  };
  testimonials: {
    enabled: boolean;
  };
}

export interface BusinessService {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  allowOnlineBooking: boolean;
}

export interface BusinessServiceCatalogConfig {
  source: 'manual' | 'store';
}

export interface BusinessLeadContext {
  profileId: string;
  appScope: string;
}

export interface BusinessSiteMetadata {
  slug: string;
  ownerProfileId: string;
  ownerUserId?: string;
  status: 'draft' | 'published';
  onboardingCompletedAt: string;
}

export type SplitLayoutSlot = 'primary' | 'secondary';
export type GridLayoutSlot =
  | 'hero-wide'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type LandingSectionType =
  | 'hero'
  | 'about'
  | 'services'
  | 'store'
  | 'testimonials'
  | 'contact'
  | 'booking'
  | 'custom'
  | 'image'
  | 'gallery';

export type LandingSectionMediaSourceType = 'url' | 'asset';
export type LandingSectionMediaAspect =
  | 'landscape'
  | 'square'
  | 'portrait'
  | 'auto';
export type LandingSectionMediaFit = 'cover' | 'contain';
export type LandingSectionMediaFocalPoint =
  | 'center'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left';
export type LandingSectionGalleryStyle = 'grid' | 'masonry';
export type LandingSectionMotionKind =
  | 'none'
  | 'particle-veil'
  | 'parallax-grid-warp'
  | 'aurora-ribbon'
  | 'glass-fog'
  | 'pulse-rings'
  | 'signal-mesh'
  | 'topographic-drift'
  | 'shimmer-beam';

export interface LandingSectionMediaItem {
  sourceType: LandingSectionMediaSourceType;
  src: string;
  alt: string;
  caption?: string;
  aspect?: LandingSectionMediaAspect;
  fit?: LandingSectionMediaFit;
  focalPoint?: LandingSectionMediaFocalPoint;
}

export interface LandingSectionGalleryConfig {
  style?: LandingSectionGalleryStyle;
  columns?: 2 | 3 | 4;
  items: LandingSectionMediaItem[];
}

export interface LandingSectionMotionConfig {
  kind?: LandingSectionMotionKind;
  density?: number;
  speed?: number;
  intensity?: number;
  height?: string;
  reducedMotion?: boolean;
  direction?: 'diagonal' | 'horizontal';
  ringCount?: number;
}

export interface LandingSectionRichContentComponent {
  instanceId: string;
  componentType: string;
  componentData: Record<string, unknown>;
  position?: number;
}

export interface LandingSectionRichContent {
  title?: string;
  content: string;
  injectedComponents?: LandingSectionRichContentComponent[];
  themeConfig?: {
    theme?: 'light' | 'dark';
    accentColor?: string;
  };
}

export interface LandingSection {
  id: string;
  type: LandingSectionType;
  title: string;
  enabled: boolean;
  order: number;
  layoutPlacement?: {
    split?: SplitLayoutSlot;
    grid?: GridLayoutSlot;
  };
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  image?: LandingSectionMediaItem;
  gallery?: LandingSectionGalleryConfig;
  motion?: LandingSectionMotionConfig;
  richContent?: LandingSectionRichContent;
}

export interface BusinessSiteConfig {
  businessType:
    | 'fitness'
    | 'consulting'
    | 'coaching'
    | 'wellness'
    | 'general'
    | 'accounting';
  site: BusinessSiteMetadata;
  leadContext: BusinessLeadContext;
  brand: {
    businessName: string;
    monogram: string;
    ownerName: string;
    trainerName?: string;
    tagline: string;
    intro: string;
    longBio: string;
    credentials: string[];
    specializations: string[];
  };
  contact: {
    email: string;
    phone: string;
    location: string;
    consultationLabel: string;
  };
  features: BusinessFeatures;
  serviceCatalog: BusinessServiceCatalogConfig;
  services: BusinessService[];
  landingPage: {
    sections: LandingSection[];
    layout: 'single-column' | 'split' | 'grid';
  };
  clientPortal: {
    headline: string;
    description: string;
    capabilities: string[];
  };
  testimonials: BusinessTestimonial[];
  theme: BusinessThemeConfig;
}
