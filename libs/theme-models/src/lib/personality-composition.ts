import type { PersonalityComposition } from './personality.interfaces';

/**
 * How each personality composes shared components: density, primitive shape,
 * header treatment, surface style, primary fill, tab indicator and feedback
 * accent. Components read the CSS variables produced by
 * `resolveCompositionVariables`, so they never branch on a personality id.
 *
 * The combinations are chosen so personalities that used to collapse into the
 * same look (classic / professional / foundation / minimal, soft / soft-touch,
 * bold / electric) differ on several visible axes, not just font face.
 */
export const COMPOSITION_BY_ID: Record<string, PersonalityComposition> = {
  classic: {
    density: 'comfortable',
    shape: 'soft',
    header: 'rule',
    surface: 'elevated',
    fill: 'gradient',
    tabs: 'underline',
    feedback: 'stripe',
    labelCase: 'none',
  },
  minimal: {
    density: 'airy',
    shape: 'square',
    header: 'plain',
    surface: 'borderless',
    fill: 'flat',
    tabs: 'underline',
    feedback: 'tint',
    labelCase: 'none',
  },
  bold: {
    density: 'comfortable',
    shape: 'rounded',
    header: 'bar',
    surface: 'outlined',
    fill: 'gradient',
    tabs: 'underline',
    feedback: 'stripe',
    labelCase: 'none',
  },
  soft: {
    density: 'airy',
    shape: 'pill',
    header: 'plain',
    surface: 'elevated',
    fill: 'flat',
    tabs: 'pill',
    feedback: 'tint',
    labelCase: 'none',
  },
  professional: {
    density: 'compact',
    shape: 'crisp',
    header: 'tint',
    surface: 'outlined',
    fill: 'flat',
    tabs: 'underline',
    feedback: 'outline',
    labelCase: 'none',
  },
  playful: {
    density: 'comfortable',
    shape: 'pill',
    header: 'bar',
    surface: 'elevated',
    fill: 'gradient',
    tabs: 'pill',
    feedback: 'tint',
    labelCase: 'none',
  },
  elegant: {
    density: 'airy',
    shape: 'square',
    header: 'rule',
    surface: 'outlined',
    fill: 'flat',
    tabs: 'underline',
    feedback: 'outline',
    labelCase: 'uppercase',
  },
  architect: {
    density: 'comfortable',
    shape: 'square',
    header: 'bar',
    surface: 'textured',
    fill: 'texture',
    tabs: 'segment',
    feedback: 'stripe',
    labelCase: 'uppercase',
  },
  'soft-touch': {
    density: 'airy',
    shape: 'rounded',
    header: 'rule',
    surface: 'textured',
    fill: 'flat',
    tabs: 'segment',
    feedback: 'tint',
    labelCase: 'none',
  },
  electric: {
    // Kinetic, not formal: circuit-textured surfaces, neon outline feedback,
    // tinted headers with tracked uppercase titles, segmented tabs.
    density: 'airy',
    shape: 'soft',
    header: 'tint',
    surface: 'textured',
    fill: 'gradient',
    tabs: 'segment',
    feedback: 'outline',
    labelCase: 'uppercase',
  },
  'control-center': {
    density: 'compact',
    shape: 'crisp',
    header: 'strip',
    surface: 'inset',
    fill: 'flat',
    tabs: 'segment',
    feedback: 'stripe',
    labelCase: 'uppercase',
  },
  foundation: {
    density: 'comfortable',
    shape: 'square',
    header: 'plain',
    surface: 'outlined',
    fill: 'flat',
    tabs: 'underline',
    feedback: 'outline',
    labelCase: 'none',
  },
};

const DENSITY: Record<
  PersonalityComposition['density'],
  Record<string, string>
> = {
  compact: {
    '--personality-control-height': '36px',
    '--personality-control-height-sm': '30px',
    '--personality-control-height-lg': '42px',
    '--personality-control-padding-x': '12px',
    '--personality-cell-padding': '6px 12px',
    '--personality-surface-padding': '14px',
    '--personality-stack-gap': '10px',
  },
  comfortable: {
    '--personality-control-height': '44px',
    '--personality-control-height-sm': '36px',
    '--personality-control-height-lg': '52px',
    '--personality-control-padding-x': '16px',
    '--personality-cell-padding': '10px 16px',
    '--personality-surface-padding': '20px',
    '--personality-stack-gap': '16px',
  },
  airy: {
    '--personality-control-height': '48px',
    '--personality-control-height-sm': '40px',
    '--personality-control-height-lg': '56px',
    '--personality-control-padding-x': '22px',
    '--personality-cell-padding': '14px 20px',
    '--personality-surface-padding': '28px',
    '--personality-stack-gap': '22px',
  },
};

const SHAPE: Record<PersonalityComposition['shape'], [string, string]> = {
  // [primitive radius, checkbox radius]
  square: ['0px', '0px'],
  crisp: ['2px', '2px'],
  soft: ['6px', '4px'],
  rounded: ['10px', '6px'],
  pill: ['999px', '6px'],
};

const HEADER: Record<
  PersonalityComposition['header'],
  Record<string, string>
> = {
  plain: {
    '--personality-header-bg': 'transparent',
    '--personality-header-fg': 'var(--foreground)',
    '--personality-header-border': '0 solid transparent',
    '--personality-header-font': 'var(--font-heading, inherit)',
    '--personality-header-weight': '600',
    '--personality-header-size': '1.125rem',
    '--personality-table-header-bg': 'transparent',
    '--personality-table-header-fg': 'var(--foreground-secondary)',
    '--personality-table-header-border': '2px solid var(--border)',
  },
  rule: {
    '--personality-header-bg': 'transparent',
    '--personality-header-fg': 'var(--foreground)',
    '--personality-header-border': '1px solid var(--border)',
    '--personality-header-font': 'var(--font-heading, inherit)',
    '--personality-header-weight': '600',
    '--personality-header-size': '1.125rem',
    '--personality-table-header-bg': 'transparent',
    '--personality-table-header-fg': 'var(--foreground-secondary)',
    '--personality-table-header-border':
      '1px solid var(--foreground-secondary)',
  },
  tint: {
    '--personality-header-bg':
      'color-mix(in srgb, var(--primary) 8%, var(--surface))',
    '--personality-header-fg': 'var(--foreground)',
    '--personality-header-border':
      '1px solid color-mix(in srgb, var(--primary) 22%, var(--border))',
    '--personality-header-font': 'var(--font-heading, inherit)',
    '--personality-header-weight': '600',
    '--personality-header-size': '1.0625rem',
    '--personality-table-header-bg':
      'color-mix(in srgb, var(--primary) 8%, var(--surface))',
    '--personality-table-header-fg': 'var(--foreground)',
    '--personality-table-header-border':
      '1px solid color-mix(in srgb, var(--primary) 22%, var(--border))',
  },
  bar: {
    '--personality-header-bg': 'var(--primary)',
    '--personality-header-fg': 'var(--on-primary)',
    '--personality-header-border': '0 solid transparent',
    '--personality-header-font': 'var(--font-heading, inherit)',
    '--personality-header-weight': '700',
    '--personality-header-size': '1.125rem',
    '--personality-table-header-bg': 'var(--primary)',
    '--personality-table-header-fg': 'var(--on-primary)',
    '--personality-table-header-border': '0 solid transparent',
  },
  strip: {
    '--personality-header-bg':
      'color-mix(in srgb, var(--foreground) 7%, var(--surface))',
    '--personality-header-fg': 'var(--foreground)',
    '--personality-header-border': '1px solid var(--border)',
    '--personality-header-font': 'var(--font-mono, monospace)',
    '--personality-header-weight': '600',
    '--personality-header-size': '0.875rem',
    '--personality-table-header-bg':
      'color-mix(in srgb, var(--foreground) 7%, var(--surface))',
    '--personality-table-header-fg': 'var(--foreground)',
    '--personality-table-header-border': '1px solid var(--border)',
  },
};

const SURFACE: Record<
  PersonalityComposition['surface'],
  Record<string, string>
> = {
  elevated: {
    '--personality-surface-bg': 'var(--background-elevated, var(--surface))',
    '--personality-surface-border':
      '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
    '--personality-surface-shadow':
      'var(--personality-card-shadow, var(--shadow-md))',
    '--personality-surface-texture': 'none',
  },
  outlined: {
    '--personality-surface-bg': 'var(--background)',
    // Always a visible outline: personalities with a 0px / `none` component
    // border (foundation) would otherwise render outlined surfaces bare.
    '--personality-surface-border':
      'max(1px, var(--personality-border-width, 1px)) solid var(--border)',
    '--personality-surface-shadow': 'none',
    '--personality-surface-texture': 'none',
  },
  inset: {
    '--personality-surface-bg':
      'color-mix(in srgb, var(--foreground) 5%, var(--surface))',
    '--personality-surface-border': '1px solid var(--border)',
    '--personality-surface-shadow': 'inset 0 1px 3px rgb(0 0 0 / 0.18)',
    '--personality-surface-texture': 'none',
  },
  textured: {
    '--personality-surface-bg': 'var(--surface)',
    '--personality-surface-border': '1px solid var(--border)',
    '--personality-surface-shadow': 'var(--shadow-sm)',
    '--personality-surface-texture': 'var(--surface-texture, none)',
  },
  borderless: {
    '--personality-surface-bg': 'var(--surface)',
    '--personality-surface-border': '1px solid transparent',
    '--personality-surface-shadow': 'none',
    '--personality-surface-texture': 'none',
  },
};

const TABS: Record<PersonalityComposition['tabs'], Record<string, string>> = {
  underline: {
    '--personality-tabs-track-bg': 'transparent',
    '--personality-tabs-track-border': '0 solid transparent',
    '--personality-tabs-track-underline': '1px solid var(--border)',
    '--personality-tabs-track-padding': '0px',
    '--personality-tabs-track-width': 'auto',
    '--personality-tab-active-bg': 'transparent',
    '--personality-tab-active-fg': 'var(--primary)',
    '--personality-tab-active-shadow': 'none',
    '--personality-tab-indicator': '2px',
    '--personality-tab-radius': '0px',
  },
  segment: {
    '--personality-tabs-track-bg':
      'color-mix(in srgb, var(--foreground) 6%, var(--surface))',
    '--personality-tabs-track-border': '1px solid var(--border)',
    '--personality-tabs-track-underline': '1px solid var(--border)',
    '--personality-tabs-track-padding': '3px',
    '--personality-tabs-track-width': 'fit-content',
    '--personality-tab-active-bg': 'var(--background)',
    '--personality-tab-active-fg': 'var(--foreground)',
    '--personality-tab-active-shadow': 'var(--shadow-sm)',
    '--personality-tab-indicator': '0px',
    '--personality-tab-radius': 'var(--personality-primitive-radius)',
  },
  pill: {
    '--personality-tabs-track-bg': 'transparent',
    '--personality-tabs-track-border': '0 solid transparent',
    '--personality-tabs-track-underline': '0 solid transparent',
    '--personality-tabs-track-padding': '0px',
    '--personality-tabs-track-width': 'auto',
    '--personality-tab-active-bg': 'var(--primary)',
    '--personality-tab-active-fg': 'var(--on-primary)',
    '--personality-tab-active-shadow': 'none',
    '--personality-tab-indicator': '0px',
    '--personality-tab-radius': '999px',
  },
};

const FEEDBACK: Record<
  PersonalityComposition['feedback'],
  Record<string, string>
> = {
  stripe: {
    '--personality-feedback-stripe': '4px',
    '--personality-feedback-tint': '0%',
    '--personality-feedback-outline': '0%',
  },
  tint: {
    '--personality-feedback-stripe': '0px',
    '--personality-feedback-tint': '12%',
    '--personality-feedback-outline': '0%',
  },
  outline: {
    '--personality-feedback-stripe': '0px',
    '--personality-feedback-tint': '0%',
    '--personality-feedback-outline': '55%',
  },
};

const FILL: Record<PersonalityComposition['fill'], string> = {
  flat: 'var(--primary)',
  gradient: 'var(--gradient-primary, var(--primary))',
  // Cleared: the button keeps the personality's own textured fill.
  texture: '',
};

/** The composition for a personality id, falling back to classic. */
export function getPersonalityComposition(id: string): PersonalityComposition {
  return COMPOSITION_BY_ID[id] ?? COMPOSITION_BY_ID['classic'];
}

/**
 * CSS custom properties for a composition. Every key is always present so a
 * personality switch fully replaces the previous personality's values; an
 * empty string clears the property and lets the component fallback apply.
 */
export function resolveCompositionVariables(
  composition: PersonalityComposition
): Record<string, string> {
  const [primitiveRadius, checkRadius] = SHAPE[composition.shape];
  const uppercase = composition.labelCase === 'uppercase';
  return {
    ...DENSITY[composition.density],
    '--personality-primitive-radius': primitiveRadius,
    '--personality-check-radius': checkRadius,
    ...HEADER[composition.header],
    '--personality-header-transform': composition.labelCase,
    '--personality-header-tracking': uppercase ? '0.06em' : 'normal',
    ...SURFACE[composition.surface],
    ...TABS[composition.tabs],
    ...FEEDBACK[composition.feedback],
    '--personality-fill-primary': FILL[composition.fill],
  };
}

/** Root data attributes mirroring the composition, for debugging and tests. */
export function compositionDataAttributes(
  composition: PersonalityComposition
): Record<string, string> {
  return {
    'data-density': composition.density,
    'data-shape': composition.shape,
    'data-header': composition.header,
    'data-surface': composition.surface,
    'data-fill': composition.fill,
    'data-tabs': composition.tabs,
    'data-feedback': composition.feedback,
  };
}
