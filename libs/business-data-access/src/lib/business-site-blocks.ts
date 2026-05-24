import {
  type BlockDefinition,
  type BlockFieldDefinition,
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

const COMMON_SECTION_FIELDS: BlockFieldDefinition[] = [
  {
    key: 'title',
    type: 'string',
    label: 'Title',
    editor: 'text',
    placeholder: 'Section title',
  },
  {
    key: 'body',
    type: 'string',
    label: 'Body',
    editor: 'textarea',
    rows: 5,
    placeholder: 'Section copy',
  },
  {
    key: 'ctaLabel',
    type: 'string',
    label: 'CTA Label',
    editor: 'text',
    placeholder: 'Book now',
  },
  {
    key: 'ctaHref',
    type: 'url',
    label: 'CTA Link',
    editor: 'url',
    placeholder: '/book',
  },
];

const MOTION_SECTION_FIELDS: BlockFieldDefinition[] = [
  {
    key: 'motion.kind',
    type: 'select',
    label: 'Motion Component',
    editor: 'select',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Particle Veil', value: 'particle-veil' },
      { label: 'Parallax Grid Warp', value: 'parallax-grid-warp' },
      { label: 'Aurora Ribbon', value: 'aurora-ribbon' },
      { label: 'Glass Fog', value: 'glass-fog' },
      { label: 'Pulse Rings', value: 'pulse-rings' },
      { label: 'Signal Mesh', value: 'signal-mesh' },
      { label: 'Topographic Drift', value: 'topographic-drift' },
      { label: 'Shimmer Beam', value: 'shimmer-beam' },
    ],
  },
  {
    key: 'motion.height',
    type: 'string',
    label: 'Motion Height',
    editor: 'text',
    placeholder: '100%',
  },
  {
    key: 'motion.density',
    type: 'number',
    label: 'Density',
    editor: 'text',
    placeholder: '18',
  },
  {
    key: 'motion.speed',
    type: 'number',
    label: 'Speed',
    editor: 'text',
    placeholder: '1',
  },
  {
    key: 'motion.intensity',
    type: 'number',
    label: 'Intensity',
    editor: 'text',
    placeholder: '0.65',
  },
  {
    key: 'motion.reducedMotion',
    type: 'boolean',
    label: 'Reduced Motion',
    editor: 'select',
    options: [
      { label: 'Off', value: false },
      { label: 'On', value: true },
    ],
  },
  {
    key: 'motion.direction',
    type: 'select',
    label: 'Motion Direction',
    editor: 'select',
    options: [
      { label: 'Diagonal', value: 'diagonal' },
      { label: 'Horizontal', value: 'horizontal' },
    ],
  },
  {
    key: 'motion.ringCount',
    type: 'number',
    label: 'Ring Count',
    editor: 'text',
    placeholder: '4',
  },
];

export const BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS: Record<
  LandingSection['type'],
  BlockDefinition
> = {
  hero: {
    type: 'hero',
    name: 'Hero',
    category: 'Intro',
    description:
      'Lead section for the business story, owner positioning, and CTA.',
    renderContexts: ['landing-page'],
    fields: [...COMMON_SECTION_FIELDS, ...MOTION_SECTION_FIELDS],
  },
  about: {
    type: 'about',
    name: 'About',
    category: 'Story',
    description: 'Narrative section that deepens credibility and fit.',
    renderContexts: ['landing-page'],
    fields: [...COMMON_SECTION_FIELDS, ...MOTION_SECTION_FIELDS],
  },
  services: {
    type: 'services',
    name: 'Services',
    category: 'Offer',
    description: 'Offer overview section with supporting copy and CTA.',
    renderContexts: ['landing-page'],
    fields: [...COMMON_SECTION_FIELDS, ...MOTION_SECTION_FIELDS],
  },
  testimonials: {
    type: 'testimonials',
    name: 'Testimonials',
    category: 'Proof',
    description: 'Social proof section with supporting framing copy.',
    renderContexts: ['landing-page'],
    fields: [...COMMON_SECTION_FIELDS, ...MOTION_SECTION_FIELDS],
  },
  contact: {
    type: 'contact',
    name: 'Contact',
    category: 'Conversion',
    description: 'Contact section with CTA and supporting next-step copy.',
    renderContexts: ['landing-page'],
    fields: [...COMMON_SECTION_FIELDS, ...MOTION_SECTION_FIELDS],
  },
  booking: {
    type: 'booking',
    name: 'Booking',
    category: 'Conversion',
    description: 'Dedicated booking conversion section.',
    renderContexts: ['landing-page'],
    fields: [...COMMON_SECTION_FIELDS, ...MOTION_SECTION_FIELDS],
  },
  custom: {
    type: 'custom',
    name: 'Custom',
    category: 'Flexible',
    description: 'Flexible editorial section for FAQs, process, proof, or CTA.',
    renderContexts: ['landing-page'],
    fields: [...COMMON_SECTION_FIELDS, ...MOTION_SECTION_FIELDS],
  },
  image: {
    type: 'image',
    name: 'Image',
    category: 'Media',
    description: 'Single-image section with framing and motion controls.',
    renderContexts: ['landing-page'],
    fields: [
      {
        key: 'title',
        type: 'string',
        label: 'Title',
        editor: 'text',
        placeholder: 'Image section title',
      },
      {
        key: 'image.sourceType',
        type: 'select',
        label: 'Source Type',
        editor: 'select',
        options: [
          { label: 'External URL', value: 'url' },
          { label: 'Asset path', value: 'asset' },
        ],
      },
      {
        key: 'image.src',
        type: 'url',
        label: 'Image Source',
        editor: 'url',
        placeholder: 'https://example.com/image.jpg',
      },
      {
        key: 'image.alt',
        type: 'string',
        label: 'Alt Text',
        editor: 'text',
        placeholder: 'Describe the image',
      },
      {
        key: 'image.caption',
        type: 'string',
        label: 'Caption',
        editor: 'text',
        placeholder: 'Optional caption',
      },
      {
        key: 'image.aspect',
        type: 'select',
        label: 'Aspect',
        editor: 'select',
        options: [
          { label: 'Landscape', value: 'landscape' },
          { label: 'Square', value: 'square' },
          { label: 'Portrait', value: 'portrait' },
          { label: 'Auto', value: 'auto' },
        ],
      },
      {
        key: 'image.fit',
        type: 'select',
        label: 'Fit',
        editor: 'select',
        options: [
          { label: 'Cover', value: 'cover' },
          { label: 'Contain', value: 'contain' },
        ],
      },
      {
        key: 'image.focalPoint',
        type: 'select',
        label: 'Focal Point',
        editor: 'select',
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Top', value: 'top' },
          { label: 'Right', value: 'right' },
          { label: 'Bottom', value: 'bottom' },
          { label: 'Left', value: 'left' },
        ],
      },
      ...MOTION_SECTION_FIELDS,
    ],
  },
  gallery: {
    type: 'gallery',
    name: 'Gallery',
    category: 'Media',
    description:
      'Multi-image section with layout controls and optional motion.',
    renderContexts: ['landing-page'],
    fields: [
      {
        key: 'title',
        type: 'string',
        label: 'Title',
        editor: 'text',
        placeholder: 'Gallery section title',
      },
      {
        key: 'gallery.style',
        type: 'select',
        label: 'Gallery Style',
        editor: 'select',
        options: [
          { label: 'Grid', value: 'grid' },
          { label: 'Masonry', value: 'masonry' },
        ],
      },
      {
        key: 'gallery.columns',
        type: 'number',
        label: 'Columns',
        editor: 'select',
        options: [
          { label: '2 columns', value: 2 },
          { label: '3 columns', value: 3 },
          { label: '4 columns', value: 4 },
        ],
      },
      ...MOTION_SECTION_FIELDS,
    ],
  },
};

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
