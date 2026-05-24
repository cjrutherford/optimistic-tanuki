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
  businessType: 'fitness' | 'consulting' | 'coaching' | 'wellness' | 'general';
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

function cloneSection(section: LandingSection): LandingSection {
  return {
    ...section,
    layoutPlacement: section.layoutPlacement
      ? { ...section.layoutPlacement }
      : undefined,
    image: section.image ? { ...section.image } : undefined,
    gallery: section.gallery
      ? {
          ...section.gallery,
          items: section.gallery.items.map((item) => ({ ...item })),
        }
      : undefined,
    motion: section.motion ? { ...section.motion } : undefined,
    richContent: section.richContent
      ? {
          ...section.richContent,
          injectedComponents: section.richContent.injectedComponents?.map(
            (component) => ({
              ...component,
              componentData: { ...component.componentData },
            })
          ),
          themeConfig: section.richContent.themeConfig
            ? { ...section.richContent.themeConfig }
            : undefined,
        }
      : undefined,
  };
}

function cloneSections(sections: LandingSection[]): LandingSection[] {
  return sections.map(cloneSection);
}

function mergeLandingSections(
  sections: LandingSection[] | undefined
): LandingSection[] {
  if (!sections?.length) {
    return cloneSections(DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections);
  }

  const defaultsById = new Map(
    DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections.map((section) => [
      section.id,
      section,
    ])
  );

  return sections.map((section, index) => ({
    ...(defaultsById.get(section.id) ?? {}),
    ...section,
    layoutPlacement: {
      ...(defaultsById.get(section.id)?.layoutPlacement ?? {}),
      ...(section.layoutPlacement ?? {}),
    },
    image: section.image
      ? {
          sourceType: section.image.sourceType ?? 'url',
          src: section.image.src ?? '',
          alt: section.image.alt ?? '',
          caption: section.image.caption ?? '',
          aspect: section.image.aspect ?? 'landscape',
          fit: section.image.fit ?? 'cover',
          focalPoint: section.image.focalPoint ?? 'center',
        }
      : undefined,
    gallery: section.gallery
      ? {
          style: section.gallery.style ?? 'grid',
          columns: section.gallery.columns ?? 3,
          items: (section.gallery.items ?? []).map((item) => ({
            sourceType: item.sourceType ?? 'url',
            src: item.src ?? '',
            alt: item.alt ?? '',
            caption: item.caption ?? '',
            aspect: item.aspect ?? 'square',
            fit: item.fit ?? 'cover',
            focalPoint: item.focalPoint ?? 'center',
          })),
        }
      : undefined,
    motion: {
      kind: section.motion?.kind ?? 'none',
      density: section.motion?.density ?? 18,
      speed: section.motion?.speed ?? 1,
      intensity: section.motion?.intensity ?? 0.65,
      height: section.motion?.height ?? '100%',
      reducedMotion: section.motion?.reducedMotion ?? false,
      direction: section.motion?.direction ?? 'diagonal',
      ringCount: section.motion?.ringCount ?? 4,
    },
    richContent: section.richContent
      ? {
          title: section.richContent.title ?? '',
          content: section.richContent.content ?? '',
          injectedComponents: (
            section.richContent.injectedComponents ?? []
          ).map((component) => ({
            instanceId: component.instanceId,
            componentType: component.componentType,
            componentData: { ...(component.componentData ?? {}) },
            position: component.position,
          })),
          themeConfig: section.richContent.themeConfig
            ? { ...section.richContent.themeConfig }
            : undefined,
        }
      : undefined,
    order: typeof section.order === 'number' ? section.order : index,
  }));
}

export function normalizeLandingSections(
  sections: LandingSection[]
): LandingSection[] {
  return sections.map((section, index) => ({
    ...section,
    order: index,
  }));
}

export function mergeBusinessSiteConfig(
  config: Partial<BusinessSiteConfig> | BusinessSiteConfig | null | undefined
): BusinessSiteConfig {
  return {
    ...DEFAULT_BUSINESS_SITE_CONFIG,
    ...(config ?? {}),
    brand: {
      ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
      ...(config?.brand ?? {}),
      credentials: [
        ...(config?.brand?.credentials ??
          DEFAULT_BUSINESS_SITE_CONFIG.brand.credentials),
      ],
      specializations: [
        ...(config?.brand?.specializations ??
          DEFAULT_BUSINESS_SITE_CONFIG.brand.specializations),
      ],
    },
    contact: {
      ...DEFAULT_BUSINESS_SITE_CONFIG.contact,
      ...(config?.contact ?? {}),
    },
    features: {
      booking: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features.booking,
        ...(config?.features?.booking ?? {}),
      },
      clientTasks: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features.clientTasks,
        ...(config?.features?.clientTasks ?? {}),
      },
      clientPortal: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features.clientPortal,
        ...(config?.features?.clientPortal ?? {}),
      },
      invoices: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features.invoices,
        ...(config?.features?.invoices ?? {}),
      },
      testimonials: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features.testimonials,
        ...(config?.features?.testimonials ?? {}),
      },
    },
    serviceCatalog: {
      ...DEFAULT_BUSINESS_SITE_CONFIG.serviceCatalog,
      ...(config?.serviceCatalog ?? {}),
    },
    services: [...(config?.services ?? DEFAULT_BUSINESS_SITE_CONFIG.services)],
    landingPage: {
      ...DEFAULT_BUSINESS_SITE_CONFIG.landingPage,
      ...(config?.landingPage ?? {}),
      sections: mergeLandingSections(config?.landingPage?.sections),
    },
    clientPortal: {
      ...DEFAULT_BUSINESS_SITE_CONFIG.clientPortal,
      ...(config?.clientPortal ?? {}),
      capabilities: [
        ...(config?.clientPortal?.capabilities ??
          DEFAULT_BUSINESS_SITE_CONFIG.clientPortal.capabilities),
      ],
    },
    testimonials: [
      ...(config?.testimonials ?? DEFAULT_BUSINESS_SITE_CONFIG.testimonials),
    ],
    theme: {
      ...DEFAULT_BUSINESS_SITE_CONFIG.theme,
      ...(config?.theme ?? {}),
    },
  };
}

export function cloneBusinessSiteConfig(
  config:
    | Partial<BusinessSiteConfig>
    | BusinessSiteConfig
    | null
    | undefined = DEFAULT_BUSINESS_SITE_CONFIG
): BusinessSiteConfig {
  return mergeBusinessSiteConfig(config);
}

export const DEFAULT_BUSINESS_SITE_CONFIG: BusinessSiteConfig = {
  businessType: 'general',
  leadContext: {
    profileId: '',
    appScope: 'business-site',
  },
  brand: {
    businessName: 'My Business',
    monogram: 'MB',
    ownerName: 'Business Owner',
    tagline: 'Professional services for your needs.',
    intro: 'Quality service built around your goals.',
    longBio: 'We provide professional services tailored to your unique needs.',
    credentials: [],
    specializations: [],
  },
  contact: {
    email: 'hello@business.local',
    phone: '(555) 000-0000',
    location: 'By appointment.',
    consultationLabel: 'Book a consultation',
  },
  features: {
    booking: { enabled: true, allowOnlinePayment: false },
    clientTasks: { enabled: false, allowClientCompletion: false },
    clientPortal: { enabled: true },
    invoices: { enabled: false },
    testimonials: { enabled: true },
  },
  serviceCatalog: {
    source: 'manual',
  },
  services: [],
  landingPage: {
    sections: [
      {
        id: 'hero',
        type: 'hero',
        title: 'Welcome',
        enabled: true,
        order: 0,
        layoutPlacement: { split: 'primary', grid: 'hero-wide' },
      },
      {
        id: 'about',
        type: 'about',
        title: 'About',
        enabled: true,
        order: 1,
        layoutPlacement: { split: 'primary', grid: 'top-left' },
      },
      {
        id: 'services',
        type: 'services',
        title: 'Services',
        enabled: false,
        order: 2,
        layoutPlacement: { split: 'primary', grid: 'top-right' },
      },
      {
        id: 'testimonials',
        type: 'testimonials',
        title: 'Testimonials',
        enabled: true,
        order: 3,
        layoutPlacement: { split: 'secondary', grid: 'bottom-left' },
      },
      {
        id: 'contact',
        type: 'contact',
        title: 'Contact',
        enabled: true,
        order: 4,
        layoutPlacement: { split: 'secondary', grid: 'bottom-right' },
      },
      {
        id: 'booking',
        type: 'booking',
        title: 'Book Now',
        enabled: true,
        order: 5,
        layoutPlacement: { split: 'secondary', grid: 'bottom-right' },
      },
    ],
    layout: 'single-column',
  },
  clientPortal: {
    headline: 'The client portal keeps your plan and progress in one place.',
    description:
      'Clients can review sessions, follow instructions, submit updates, and stay current on billing.',
    capabilities: [
      'View upcoming sessions and history',
      'Follow assigned instructions',
      'Submit progress updates',
      'Track invoices and packages',
    ],
  },
  testimonials: [],
  theme: {
    mode: 'light',
    personalityId: 'professional',
    primaryColor: '#1f7a63',
  },
};
