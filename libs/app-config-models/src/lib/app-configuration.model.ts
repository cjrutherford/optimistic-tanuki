import {
  Section,
  LayoutType,
  type SectionType,
  type SectionMediaItem,
  type SectionMotionConfig,
  type SectionMotionKind,
} from './section.model';
import { RouteConfig } from './route-config.model';
import { ThemeConfig } from './theme-config.model';
import { FeaturesConfig } from './feature-config.model';

export type BlockRenderContext = 'landing-page' | 'rich-text';
export type EditorWorkspaceMode = 'guided' | 'studio';

export interface BlockFieldDefinition {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'url' | 'select';
  label: string;
  description?: string;
  editor?: 'text' | 'textarea' | 'select' | 'url' | 'boolean';
  defaultValue?: unknown;
  options?: { label: string; value: unknown }[];
  placeholder?: string;
  rows?: number;
  isOutput?: boolean;
  outputSchema?: unknown;
}

export interface BlockDefinition {
  type: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  renderContexts?: BlockRenderContext[];
  fields?: BlockFieldDefinition[];
  defaultData?: Record<string, unknown>;
}

export const APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS: Record<
  SectionType,
  BlockDefinition
> = {
  hero: {
    type: 'hero',
    name: 'Hero',
    category: 'Intro',
    description: 'Primary headline section with supporting message and CTA.',
    renderContexts: ['landing-page'],
    defaultData: {
      title: 'Welcome',
      subtitle: 'Tell visitors what they should know first.',
      backgroundImage: '',
      background: {
        sourceType: 'url',
        src: '',
        alt: '',
        aspect: 'landscape',
        fit: 'cover',
        focalPoint: 'center',
      },
      motion: {
        kind: 'none',
      },
      ctaText: 'Get Started',
      ctaLink: '/start',
    },
    fields: [
      {
        key: 'title',
        type: 'string',
        label: 'Title',
        editor: 'text',
        placeholder: 'Welcome to our platform',
      },
      {
        key: 'subtitle',
        type: 'string',
        label: 'Subtitle',
        editor: 'textarea',
        rows: 3,
        placeholder: 'Briefly explain the value proposition.',
      },
      {
        key: 'backgroundImage',
        type: 'url',
        label: 'Background Image',
        editor: 'url',
        placeholder: 'https://example.com/hero.jpg',
      },
      {
        key: 'background.src',
        type: 'url',
        label: 'Background Source',
        editor: 'url',
        placeholder: 'https://example.com/hero.jpg',
      },
      {
        key: 'background.alt',
        type: 'string',
        label: 'Background Alt Text',
        editor: 'text',
        placeholder: 'Describe the hero image',
      },
      {
        key: 'background.fit',
        type: 'select',
        label: 'Background Fit',
        editor: 'select',
        defaultValue: 'cover',
        options: [
          { label: 'Cover', value: 'cover' },
          { label: 'Contain', value: 'contain' },
        ],
      },
      {
        key: 'background.focalPoint',
        type: 'select',
        label: 'Background Focus',
        editor: 'select',
        defaultValue: 'center',
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Top', value: 'top' },
          { label: 'Right', value: 'right' },
          { label: 'Bottom', value: 'bottom' },
          { label: 'Left', value: 'left' },
        ],
      },
      {
        key: 'motion.kind',
        type: 'select',
        label: 'Motion',
        editor: 'select',
        defaultValue: 'none',
        options: motionKindOptions(),
      },
      {
        key: 'motion.speed',
        type: 'number',
        label: 'Motion Speed',
        editor: 'text',
        placeholder: '1',
      },
      {
        key: 'motion.intensity',
        type: 'number',
        label: 'Motion Intensity',
        editor: 'text',
        placeholder: '0.65',
      },
      {
        key: 'ctaText',
        type: 'string',
        label: 'CTA Label',
        editor: 'text',
        placeholder: 'Get Started',
      },
      {
        key: 'ctaLink',
        type: 'url',
        label: 'CTA Link',
        editor: 'url',
        placeholder: '/start',
      },
    ],
  },
  features: {
    type: 'features',
    name: 'Features',
    category: 'Proof',
    description: 'Feature grid that explains what the product offers.',
    renderContexts: ['landing-page'],
    fields: [
      {
        key: 'title',
        type: 'string',
        label: 'Section Title',
        editor: 'text',
        placeholder: 'Why choose us',
      },
    ],
  },
  content: {
    type: 'content',
    name: 'Content',
    category: 'Story',
    description: 'Editorial content section with optional supporting image.',
    renderContexts: ['landing-page'],
    defaultData: {
      image: {
        sourceType: 'url',
        src: '',
        alt: '',
        aspect: 'landscape',
        fit: 'cover',
        focalPoint: 'center',
      },
      motion: {
        kind: 'none',
      },
    },
    fields: [
      {
        key: 'title',
        type: 'string',
        label: 'Title',
        editor: 'text',
        placeholder: 'Our approach',
      },
      {
        key: 'content',
        type: 'string',
        label: 'Content',
        editor: 'textarea',
        rows: 6,
        placeholder: 'Add the main body copy for this section.',
      },
      {
        key: 'imageUrl',
        type: 'url',
        label: 'Image URL',
        editor: 'url',
        placeholder: 'https://example.com/content.jpg',
      },
      {
        key: 'image.src',
        type: 'url',
        label: 'Image Source',
        editor: 'url',
        placeholder: 'https://example.com/content.jpg',
      },
      {
        key: 'image.alt',
        type: 'string',
        label: 'Image Alt Text',
        editor: 'text',
        placeholder: 'Describe the image',
      },
      {
        key: 'image.fit',
        type: 'select',
        label: 'Image Fit',
        editor: 'select',
        defaultValue: 'cover',
        options: [
          { label: 'Cover', value: 'cover' },
          { label: 'Contain', value: 'contain' },
        ],
      },
      {
        key: 'image.focalPoint',
        type: 'select',
        label: 'Image Focus',
        editor: 'select',
        defaultValue: 'center',
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Top', value: 'top' },
          { label: 'Right', value: 'right' },
          { label: 'Bottom', value: 'bottom' },
          { label: 'Left', value: 'left' },
        ],
      },
      {
        key: 'imagePosition',
        type: 'select',
        label: 'Image Position',
        editor: 'select',
        defaultValue: 'right',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
          { label: 'Top', value: 'top' },
          { label: 'Bottom', value: 'bottom' },
        ],
      },
      {
        key: 'motion.kind',
        type: 'select',
        label: 'Motion',
        editor: 'select',
        defaultValue: 'none',
        options: motionKindOptions(),
      },
      {
        key: 'motion.speed',
        type: 'number',
        label: 'Motion Speed',
        editor: 'text',
        placeholder: '1',
      },
    ],
  },
  grid: {
    type: 'grid',
    name: 'Grid',
    category: 'Collection',
    description: 'Card grid for resources, portfolio items, or offerings.',
    renderContexts: ['landing-page'],
    fields: [
      {
        key: 'title',
        type: 'string',
        label: 'Section Title',
        editor: 'text',
        placeholder: 'Featured resources',
      },
    ],
  },
  cta: {
    type: 'cta',
    name: 'Call To Action',
    category: 'Conversion',
    description: 'Conversion-focused section with button and supporting copy.',
    renderContexts: ['landing-page'],
    defaultData: {
      title: 'Ready to begin?',
      description: 'Invite visitors to take the next step.',
      buttonText: 'Start now',
      buttonLink: '/start',
    },
    fields: [
      {
        key: 'title',
        type: 'string',
        label: 'Title',
        editor: 'text',
        placeholder: 'Ready to begin?',
      },
      {
        key: 'description',
        type: 'string',
        label: 'Description',
        editor: 'textarea',
        rows: 4,
        placeholder: 'Invite visitors to take action.',
      },
      {
        key: 'buttonText',
        type: 'string',
        label: 'Button Label',
        editor: 'text',
        placeholder: 'Start now',
      },
      {
        key: 'buttonLink',
        type: 'url',
        label: 'Button Link',
        editor: 'url',
        placeholder: '/start',
      },
    ],
  },
  footer: {
    type: 'footer',
    name: 'Footer',
    category: 'Closing',
    description: 'Closing footer content and supporting links.',
    renderContexts: ['landing-page'],
    fields: [
      {
        key: 'content',
        type: 'string',
        label: 'Content',
        editor: 'textarea',
        rows: 5,
        placeholder: 'Add footer copy, legal note, or contact details.',
      },
    ],
  },
};

export interface BlockInstance<TData = Record<string, unknown>> {
  id: string;
  type: string;
  order: number;
  enabled: boolean;
  data: TData;
  renderContext?: BlockRenderContext;
}

export interface ConfigDocument {
  layout: string;
  blocks: BlockInstance[];
  routes?: RouteConfig[];
  features?: FeaturesConfig;
  theme?: ThemeConfig;
  metadata?: Record<string, unknown>;
}

export interface EditorWorkspaceState {
  mode: EditorWorkspaceMode;
  document: ConfigDocument;
  selectedBlockId: string | null;
}

export interface InsertBlockOptions {
  index?: number;
  renderContext?: BlockRenderContext;
}

/**
 * Landing page configuration
 */
export interface LandingPageConfig {
  sections: Section[];
  layout: LayoutType;
}

/**
 * Main application configuration interface
 */
export interface AppConfiguration {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  landingPage: LandingPageConfig;
  routes: RouteConfig[];
  features: FeaturesConfig;
  theme: ThemeConfig;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * DTO for creating a new app configuration
 */
export interface CreateAppConfigDto {
  name: string;
  description?: string;
  domain?: string;
  landingPage: LandingPageConfig;
  routes: RouteConfig[];
  features: FeaturesConfig;
  theme: ThemeConfig;
  active?: boolean;
}

/**
 * DTO for updating an existing app configuration
 */
export interface UpdateAppConfigDto {
  name?: string;
  description?: string;
  domain?: string;
  landingPage?: LandingPageConfig;
  routes?: RouteConfig[];
  features?: FeaturesConfig;
  theme?: ThemeConfig;
  active?: boolean;
}

function motionKindOptions(): { label: string; value: SectionMotionKind }[] {
  return [
    { label: 'None', value: 'none' },
    { label: 'Particle Veil', value: 'particle-veil' },
    { label: 'Parallax Grid Warp', value: 'parallax-grid-warp' },
    { label: 'Aurora Ribbon', value: 'aurora-ribbon' },
    { label: 'Glass Fog', value: 'glass-fog' },
    { label: 'Pulse Rings', value: 'pulse-rings' },
    { label: 'Signal Mesh', value: 'signal-mesh' },
    { label: 'Topographic Drift', value: 'topographic-drift' },
    { label: 'Shimmer Beam', value: 'shimmer-beam' },
  ];
}

function normalizeSectionMedia(
  media: Record<string, unknown> | undefined,
  fallbackSrc?: string
): SectionMediaItem | undefined {
  const src = typeof media?.['src'] === 'string' ? media['src'] : fallbackSrc;
  if (!src) {
    return undefined;
  }

  return {
    sourceType:
      media?.['sourceType'] === 'asset' || media?.['sourceType'] === 'url'
        ? media['sourceType']
        : 'url',
    src,
    alt: typeof media?.['alt'] === 'string' ? media['alt'] : '',
    caption:
      typeof media?.['caption'] === 'string' ? media['caption'] : undefined,
    aspect:
      media?.['aspect'] === 'landscape' ||
      media?.['aspect'] === 'square' ||
      media?.['aspect'] === 'portrait' ||
      media?.['aspect'] === 'auto'
        ? media['aspect']
        : undefined,
    fit:
      media?.['fit'] === 'cover' || media?.['fit'] === 'contain'
        ? media['fit']
        : undefined,
    focalPoint:
      media?.['focalPoint'] === 'center' ||
      media?.['focalPoint'] === 'top' ||
      media?.['focalPoint'] === 'right' ||
      media?.['focalPoint'] === 'bottom' ||
      media?.['focalPoint'] === 'left'
        ? media['focalPoint']
        : undefined,
  };
}

function normalizeSectionMotion(
  motion: Record<string, unknown> | undefined
): SectionMotionConfig | undefined {
  if (!motion || typeof motion !== 'object') {
    return undefined;
  }

  const kind = motion['kind'];
  const normalizedKind =
    kind === 'none' ||
    kind === 'particle-veil' ||
    kind === 'parallax-grid-warp' ||
    kind === 'aurora-ribbon' ||
    kind === 'glass-fog' ||
    kind === 'pulse-rings' ||
    kind === 'signal-mesh' ||
    kind === 'topographic-drift' ||
    kind === 'shimmer-beam'
      ? kind
      : undefined;

  if (!normalizedKind) {
    return undefined;
  }

  return {
    kind: normalizedKind,
    density: coerceOptionalNumber(motion['density']),
    speed: coerceOptionalNumber(motion['speed']),
    intensity: coerceOptionalNumber(motion['intensity']),
    height: typeof motion['height'] === 'string' ? motion['height'] : undefined,
    reducedMotion:
      typeof motion['reducedMotion'] === 'boolean'
        ? motion['reducedMotion']
        : undefined,
    direction:
      motion['direction'] === 'diagonal' || motion['direction'] === 'horizontal'
        ? motion['direction']
        : undefined,
    ringCount: coerceOptionalNumber(motion['ringCount']),
  };
}

function coerceOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) {
    return target;
  }

  const next = { ...target };
  let cursor: Record<string, unknown> = next;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const current = cursor[segment];
    const nested =
      current && typeof current === 'object'
        ? { ...(current as Record<string, unknown>) }
        : {};
    cursor[segment] = nested;
    cursor = nested;
  }

  cursor[segments[segments.length - 1]] = value;
  return next;
}

function mergeBlockData(
  currentData: Record<string, unknown>,
  patchData: Record<string, unknown>
): Record<string, unknown> {
  return Object.entries(patchData).reduce<Record<string, unknown>>(
    (accumulator, [key, value]) => {
      if (key.includes('.')) {
        return setNestedValue(accumulator, key, value);
      }

      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        accumulator[key] &&
        typeof accumulator[key] === 'object' &&
        !Array.isArray(accumulator[key])
      ) {
        accumulator[key] = mergeBlockData(
          accumulator[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    },
    { ...currentData }
  );
}

function sectionToBlockData(section: Section): Record<string, unknown> {
  const {
    id: _id,
    type: _type,
    order: _order,
    visible: _visible,
    ...data
  } = section;
  return data;
}

function blockDataToSection(
  type: SectionType,
  data: Record<string, unknown>
): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return {
        title: String(data['title'] ?? ''),
        subtitle: data['subtitle'] as string | undefined,
        backgroundImage: data['backgroundImage'] as string | undefined,
        background: normalizeSectionMedia(
          data['background'] as Record<string, unknown> | undefined,
          data['backgroundImage'] as string | undefined
        ),
        motion: normalizeSectionMotion(
          data['motion'] as Record<string, unknown> | undefined
        ),
        ctaText: data['ctaText'] as string | undefined,
        ctaLink: data['ctaLink'] as string | undefined,
      };
    case 'features':
      return {
        title: String(data['title'] ?? ''),
        features: Array.isArray(data['features'])
          ? (data['features'] as Array<{
              icon?: string;
              title: string;
              description: string;
            }>)
          : [],
      };
    case 'content':
      return {
        title: data['title'] as string | undefined,
        content: String(data['content'] ?? ''),
        imageUrl: data['imageUrl'] as string | undefined,
        image: normalizeSectionMedia(
          data['image'] as Record<string, unknown> | undefined,
          data['imageUrl'] as string | undefined
        ),
        imagePosition: data['imagePosition'] as
          | 'left'
          | 'right'
          | 'top'
          | 'bottom'
          | undefined,
        motion: normalizeSectionMotion(
          data['motion'] as Record<string, unknown> | undefined
        ),
      };
    case 'grid':
      return {
        title: data['title'] as string | undefined,
        columns: Number(data['columns'] ?? 0),
        items: Array.isArray(data['items'])
          ? (data['items'] as Array<{
              title: string;
              description?: string;
              imageUrl?: string;
              link?: string;
            }>)
          : [],
      };
    case 'cta':
      return {
        title: String(data['title'] ?? ''),
        description: data['description'] as string | undefined,
        buttonText: String(data['buttonText'] ?? ''),
        buttonLink: String(data['buttonLink'] ?? ''),
      };
    case 'footer':
      return {
        content: String(data['content'] ?? ''),
        links: Array.isArray(data['links'])
          ? (data['links'] as Array<{ text: string; url: string }>)
          : undefined,
      };
  }
}

export function normalizeBlockOrder(blocks: BlockInstance[]): BlockInstance[] {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((block, index) => ({
      ...block,
      order: index,
    }));
}

function normalizeConfigDocument(document: ConfigDocument): ConfigDocument {
  return {
    ...document,
    blocks: normalizeBlockOrder(document.blocks),
  };
}

export function createEditorWorkspace(
  document: ConfigDocument,
  mode: EditorWorkspaceMode = 'studio'
): EditorWorkspaceState {
  return {
    mode,
    document: normalizeConfigDocument(document),
    selectedBlockId: null,
  };
}

export function selectBlockInWorkspace(
  workspace: EditorWorkspaceState,
  blockId: string | null
): EditorWorkspaceState {
  if (blockId === null) {
    return {
      ...workspace,
      selectedBlockId: null,
    };
  }

  if (!workspace.document.blocks.some((block) => block.id === blockId)) {
    throw new Error(`Cannot select unknown block "${blockId}".`);
  }

  return {
    ...workspace,
    selectedBlockId: blockId,
  };
}

export function insertBlockInWorkspace(
  workspace: EditorWorkspaceState,
  registry: Record<string, BlockDefinition>,
  block: BlockInstance,
  options: InsertBlockOptions = {}
): EditorWorkspaceState {
  const definition = registry[block.type];
  const renderContext = options.renderContext ?? block.renderContext;

  if (
    definition?.renderContexts?.length &&
    renderContext &&
    !definition.renderContexts.includes(renderContext)
  ) {
    throw new Error(
      `Block type "${block.type}" cannot be inserted into render context "${renderContext}".`
    );
  }

  const nextBlock: BlockInstance = {
    ...block,
    renderContext,
  };
  const blocks = [...workspace.document.blocks];
  const insertionIndex = Math.min(
    Math.max(options.index ?? blocks.length, 0),
    blocks.length
  );
  blocks.splice(insertionIndex, 0, nextBlock);

  return {
    ...workspace,
    document: {
      ...workspace.document,
      blocks: normalizeBlockOrder(blocks),
    },
    selectedBlockId: nextBlock.id,
  };
}

export function moveBlockInWorkspace(
  workspace: EditorWorkspaceState,
  blockId: string,
  targetIndex: number
): EditorWorkspaceState {
  const blocks = [...workspace.document.blocks];
  const currentIndex = blocks.findIndex((block) => block.id === blockId);
  if (currentIndex === -1) {
    throw new Error(`Cannot move unknown block "${blockId}".`);
  }

  const [block] = blocks.splice(currentIndex, 1);
  const nextIndex = Math.min(Math.max(targetIndex, 0), blocks.length);
  blocks.splice(nextIndex, 0, block);

  return {
    ...workspace,
    document: {
      ...workspace.document,
      blocks: normalizeBlockOrder(blocks),
    },
  };
}

export function updateBlockInWorkspace(
  workspace: EditorWorkspaceState,
  blockId: string,
  patch: Partial<BlockInstance>
): EditorWorkspaceState {
  let found = false;
  const blocks = workspace.document.blocks.map((block) => {
    if (block.id !== blockId) {
      return block;
    }

    found = true;
    return {
      ...block,
      ...patch,
      data:
        patch.data && typeof patch.data === 'object'
          ? mergeBlockData(block.data, patch.data as Record<string, unknown>)
          : block.data,
    };
  });

  if (!found) {
    throw new Error(`Cannot update unknown block "${blockId}".`);
  }

  return {
    ...workspace,
    document: {
      ...workspace.document,
      blocks: normalizeBlockOrder(blocks),
    },
  };
}

export function removeBlockFromWorkspace(
  workspace: EditorWorkspaceState,
  blockId: string
): EditorWorkspaceState {
  const blocks = workspace.document.blocks.filter(
    (block) => block.id !== blockId
  );
  if (blocks.length === workspace.document.blocks.length) {
    throw new Error(`Cannot remove unknown block "${blockId}".`);
  }

  return {
    ...workspace,
    document: {
      ...workspace.document,
      blocks: normalizeBlockOrder(blocks),
    },
    selectedBlockId:
      workspace.selectedBlockId === blockId ? null : workspace.selectedBlockId,
  };
}

export function sectionToBlockInstance(section: Section): BlockInstance {
  return {
    id: section.id,
    type: section.type,
    order: section.order,
    enabled: section.visible,
    renderContext: 'landing-page',
    data: sectionToBlockData(section),
  };
}

export function blockInstanceToSection(block: BlockInstance): Section {
  const type = block.type as SectionType;
  return {
    id: block.id,
    type,
    order: block.order,
    visible: block.enabled,
    ...blockDataToSection(type, block.data),
  } as Section;
}

export function appConfigToConfigDocument(
  config: AppConfiguration
): ConfigDocument {
  return {
    layout: config.landingPage.layout,
    blocks: normalizeBlockOrder(
      config.landingPage.sections.map(sectionToBlockInstance)
    ),
    routes: config.routes,
    features: config.features,
    theme: config.theme,
    metadata: {
      appConfig: {
        id: config.id,
        name: config.name,
        description: config.description,
        domain: config.domain,
        active: config.active,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    },
  };
}

export function configDocumentToAppConfig(
  document: ConfigDocument,
  base: Pick<AppConfiguration, 'id' | 'name' | 'active'> &
    Partial<Omit<AppConfiguration, 'id' | 'name' | 'active' | 'landingPage'>>
): AppConfiguration {
  const metadata =
    (document.metadata?.['appConfig'] as
      | Partial<AppConfiguration>
      | undefined) ?? {};

  return {
    id: base.id,
    name: base.name,
    active: base.active,
    description: base.description ?? metadata.description,
    domain: base.domain ?? metadata.domain,
    createdAt: base.createdAt ?? metadata.createdAt,
    updatedAt: base.updatedAt ?? metadata.updatedAt,
    landingPage: {
      layout: document.layout as LayoutType,
      sections: normalizeBlockOrder(document.blocks).map(
        blockInstanceToSection
      ),
    },
    routes: document.routes ?? base.routes ?? [],
    features: document.features ?? base.features ?? {},
    theme: document.theme ?? base.theme ?? {},
  };
}
