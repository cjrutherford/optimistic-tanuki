import {
  normalizeBlockOrder,
  type BlockInstance,
  type ConfigDocument,
} from '@optimistic-tanuki/app-config-models';

import {
  cloneBusinessSiteConfig,
  normalizeLandingSections,
  type BusinessSiteConfig,
  type LandingSection,
} from './business-site.config';

export { BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS } from './business-site-block-definitions';

function landingSectionToBlock(section: LandingSection): BlockInstance {
  const {
    id,
    type,
    order,
    enabled,
    title,
    body,
    ctaLabel,
    ctaHref,
    layoutPlacement,
    image,
    gallery,
    motion,
    richContent,
  } = section;

  return {
    id,
    type,
    order,
    enabled,
    renderContext: 'landing-page',
    data: {
      title,
      body,
      ctaLabel,
      ctaHref,
      layoutPlacement,
      image,
      gallery,
      motion,
      richContent,
    },
  };
}

function blockToLandingSection(block: BlockInstance): LandingSection {
  const data = block.data as Partial<LandingSection>;
  return {
    id: block.id,
    type: block.type as LandingSection['type'],
    title: String(data.title ?? 'Untitled section'),
    enabled: block.enabled,
    order: block.order,
    body: data.body,
    ctaLabel: data.ctaLabel,
    ctaHref: data.ctaHref,
    layoutPlacement: data.layoutPlacement,
    image: data.image,
    gallery: data.gallery,
    motion: data.motion,
    richContent: data.richContent,
  };
}

export function businessSiteConfigToConfigDocument(
  config: BusinessSiteConfig
): ConfigDocument {
  return {
    layout: config.landingPage.layout,
    blocks: normalizeBlockOrder(
      config.landingPage.sections.map(landingSectionToBlock)
    ),
    theme: {
      mode: config.theme.mode,
      primaryColor: config.theme.primaryColor,
      personalityId: config.theme.personalityId,
    },
    metadata: {
      businessSite: {
        ...config,
        landingPage: undefined,
      },
    },
  };
}

export function configDocumentToBusinessSiteConfig(
  document: ConfigDocument
): BusinessSiteConfig {
  const metadata = (document.metadata?.['businessSite'] ??
    {}) as Partial<BusinessSiteConfig>;
  const base = cloneBusinessSiteConfig(metadata);

  base.landingPage = {
    ...base.landingPage,
    layout: document.layout as BusinessSiteConfig['landingPage']['layout'],
    sections: normalizeLandingSections(
      normalizeBlockOrder(document.blocks).map(blockToLandingSection)
    ),
  };

  if (document.theme?.primaryColor) {
    base.theme.primaryColor = document.theme.primaryColor;
  }

  if (document.theme?.mode) {
    base.theme.mode = document.theme.mode;
  }

  if (document.theme?.personalityId) {
    base.theme.personalityId = document.theme.personalityId;
  }

  return base;
}
