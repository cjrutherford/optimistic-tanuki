import { BusinessSiteConfig, LandingSection } from './business-site.types';
import { DEFAULT_BUSINESS_SITE_CONFIG } from './business-site.defaults';

export * from './business-site.types';
export { DEFAULT_BUSINESS_SITE_CONFIG };

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
    site: {
      ...DEFAULT_BUSINESS_SITE_CONFIG.site,
      ...(config?.site ?? {}),
    },
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
      store: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.features.store,
        ...(config?.features?.store ?? {}),
      },
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
