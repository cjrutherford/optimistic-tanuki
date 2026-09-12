import {
  normalizeBlockOrder,
  type BlockInstance,
  type ConfigDocument,
} from '@optimistic-tanuki/app-config-models';
import type {
  BusinessSiteConfig,
  LandingSection,
} from '@optimistic-tanuki/configurable-plugin-contracts';
import { supportsBusinessPresenceSection } from './business-presence-runtime';

const DEFAULT_DOCUMENT_THEME: BusinessSiteConfig['theme'] = {
  mode: 'light',
  personalityId: 'professional',
  primaryColor: '#1f7a63',
};

function cloneDocumentMetadata(
  config: Partial<BusinessSiteConfig>
): BusinessSiteConfig {
  return structuredClone(config) as BusinessSiteConfig;
}

function normalizeDocumentSections(
  sections: LandingSection[]
): LandingSection[] {
  return sections.map((section, index) => ({ ...section, order: index }));
}

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
  const base = cloneDocumentMetadata(metadata);

  base.landingPage = {
    ...base.landingPage,
    layout: document.layout as BusinessSiteConfig['landingPage']['layout'],
    sections: normalizeDocumentSections(
      normalizeBlockOrder(document.blocks)
        .filter((block) => supportsBusinessPresenceSection(block.type))
        .map(blockToLandingSection)
    ),
  };

  base.theme = {
    ...DEFAULT_DOCUMENT_THEME,
    ...base.theme,
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
