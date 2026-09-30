/**
 * resolveExtensionVariables — the proposed theme-lib addition.
 *
 * Upstream this runs inside ThemeService right after
 * `generatePersonalityCSSVariables()`, receiving the variables it just built
 * and returning additions/overrides to merge on top:
 *
 *   Object.assign(vars, resolveExtensionVariables(personality, primary, mode, vars));
 *
 * Contract:
 *  - Always emits every key in EXTENSION_VARIABLE_KEYS ('' = cleared).
 *  - Emits NOTHING (every key '') until the personality has at least one
 *    extension block. Then it also emits the wiring variables for data
 *    personalities already author but ThemeService never output
 *    (`--line-height`, `--letter-spacing`, `--touch-target`,
 *    `--layout-max-width`, `--stagger-delay`).
 *  - With no `expression`, overrides nothing ThemeService emitted.
 *  - Every override is contrast-checked with theme-models' own utilities
 *    (body text against the personality's `contrast.minimumRatio`, muted
 *    >= 4.5, secondary >= 7, on-accent >= 4.5).
 *  - Colour still derives only from the user's primary.
 */
import {
  chroma,
  ensureContrast,
  getContrastRatio,
  getSuggestedTextColor,
  hexToHsl,
  hslToHex,
  isHex,
  mix,
  type Hsl,
  type Personality,
  type PersonalityExtensions,
} from '@optimistic-tanuki/theme-models';
import {
  generatePersonalityColors,
  harmonyHueOptions,
  generatePerceptualShades,
} from './color-harmony';
import {
  createGradientVariablesFromTheme,
  resolvePersonalityGradientTheme,
} from './gradient-factory';
import {
  ATMOSPHERE_VARIABLE_KEYS,
  resolveAtmosphere,
  type ContrastCheck,
} from './personality-atmosphere';
import { MOTION_VARIABLE_KEYS, resolveMotion } from './personality-motion';

type Mode = 'light' | 'dark';
type Vars = Record<string, string>;

/**
 * Variables only this layer introduces. Always emitted — as '' when not
 * applicable — following the repo's composition contract ("every key is
 * always present so a personality switch fully replaces the previous
 * personality's values"; ThemeService's setProperty(k, '') removes the
 * property, so component fallbacks apply).
 */
export const EXTENSION_VARIABLE_KEYS = [
  '--line-height',
  '--letter-spacing',
  '--touch-target',
  '--stagger-delay',
  '--layout-max-width',
  '--type-ratio',
  '--type-small',
  '--type-body',
  '--type-h4',
  '--type-h3',
  '--type-h2',
  '--type-h1',
  '--type-display',
  '--heading-family',
  '--heading-weight',
  '--heading-transform',
  '--heading-tracking',
  '--heading-line-height',
  '--accent-ground',
  '--on-accent-ground',
  ...ATMOSPHERE_VARIABLE_KEYS,
  ...MOTION_VARIABLE_KEYS,
] as const;

/** Below this sRGB chroma a base colour is treated as a neutral (grey/black/white). */
const NEUTRAL_CHROMA = 0.12;

const LIGHT_GROUNDS = {
  // Warm uncoated stock: fixed warm hue, independent of the primary.
  paper: (_hue: number): Hsl => ({ h: 40, s: 36, l: 95 }),
  tinted: (hue: number): Hsl => ({ h: hue, s: 30, l: 96 }),
  toned: (hue: number): Hsl => ({ h: hue, s: 10, l: 90 }),
};
const DARK_GROUNDS = {
  ink: (hue: number): Hsl => ({ h: hue, s: 50, l: 9 }),
  tinted: (hue: number): Hsl => ({ h: hue, s: 24, l: 12 }),
  dim: (hue: number): Hsl => ({ h: hue, s: 9, l: 17 }),
};

/** Walks `color` toward `anchor` until it clears `ratio` against every background. */
function liftToContrast(
  color: string,
  anchor: string,
  backgrounds: string[],
  ratio: number
): string {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const candidate = mix(anchor, color, t);
    if (backgrounds.every((bg) => getContrastRatio(candidate, bg) >= ratio))
      return candidate;
  }
  return anchor;
}

function round(n: number, digits = 3): string {
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}

export function resolveExtensionVariables(
  personality: Personality,
  extensions: PersonalityExtensions | undefined,
  primaryColor: string,
  mode: Mode,
  base: Vars,
  /** Optional sink for the atmosphere layer's final contrast checks (used by validation). */
  report?: ContrastCheck[]
): Vars {
  const out: Vars = Object.fromEntries(
    EXTENSION_VARIABLE_KEYS.map((k) => [k, ''])
  );
  const ratio = personality.contrast.minimumRatio;

  // Nothing at all until the personality opts in (any extension block).
  // Components adopt the mixins before personalities opt in, and those mixins
  // read only these variables, so "no pixels change until opt-in" holds.
  const optedIn = !!(
    extensions?.expression ||
    extensions?.typeScale ||
    extensions?.atmosphere ||
    extensions?.motion
  );
  if (!optedIn) return out;

  // 1. Wiring: fields personalities already author that were never emitted.
  out['--line-height'] = String(personality.tokens.lineHeight);
  out['--letter-spacing'] = personality.tokens.letterSpacing;
  out['--touch-target'] = personality.mobile.touchTargetSize;
  out['--stagger-delay'] = personality.animations.staggerDelay;
  if (personality.presentation?.layout.maxWidth) {
    out['--layout-max-width'] = personality.presentation.layout.maxWidth;
  }

  // 2. Type scale.
  const type = extensions?.typeScale;
  if (type) {
    const r = type.ratio;
    out['--type-ratio'] = String(r);
    out['--type-small'] = `${round(1 / r)}rem`;
    out['--type-body'] = '1rem';
    out['--type-h4'] = `${round(r)}rem`;
    out['--type-h3'] = `${round(r ** 2)}rem`;
    out['--type-h2'] = `${round(r ** 3)}rem`;
    out['--type-h1'] = `${round(r ** 4)}rem`;
    out['--type-display'] = `${round(r ** 5)}rem`;
    out['--heading-family'] =
      personality.fonts.heading?.family ?? personality.fonts.body.family;
    out['--heading-weight'] = String(type.headingWeight);
    out['--heading-transform'] = type.headingCase;
    out['--heading-tracking'] = type.headingTracking;
    out['--heading-line-height'] = String(type.headingLineHeight);
  }

  const expression = extensions?.expression;
  if (!expression) return withAtmosphere();

  const baseHsl = hexToHsl(primaryColor);
  const neutralBase =
    expression.neutralBase === 'respect' &&
    chroma(primaryColor) < NEUTRAL_CHROMA;
  let primary = base['--primary'];
  let secondary = base['--secondary'];
  let tertiary = base['--tertiary'];

  // 3. Neutral base: keep grey/black/white brand colours neutral instead of
  // re-saturating their (meaningless) hue at the personality's pinned S/L.
  if (neutralBase) {
    const accentL = personality.colorHarmony.accentLightness;
    const lightness =
      mode === 'light'
        ? baseHsl.l < 50
          ? Math.max(baseHsl.l, 14)
          : Math.min(accentL, 42)
        : 88;
    const colors = generatePersonalityColors(
      primaryColor,
      personality.colorHarmony.type,
      personality.colorHarmony.saturationBoost,
      personality.colorHarmony.lightnessShift,
      Math.min(baseHsl.s, 8),
      lightness,
      harmonyHueOptions(personality.colorHarmony)
    );
    primary = colors.primary;
    secondary = colors.secondary;
    tertiary = colors.tertiary;
    const curve =
      personality.tokens.spacingScale === 'compact'
        ? 'ease-out'
        : personality.tokens.spacingScale === 'spacious'
        ? 'ease-in'
        : 'ease-in-out';
    const tones: [string, string][] = [
      ['primary', primary],
      ['secondary', secondary],
      ['tertiary', tertiary],
    ];
    for (const [name, value] of tones) {
      out[`--${name}`] = value;
      const fg = getSuggestedTextColor(value).color;
      out[`--${name}-foreground`] = fg;
      out[`--on-${name}`] = fg;
      generatePerceptualShades(value, 10, curve).forEach((shade, i) => {
        out[`--${name}-${i}`] = shade;
      });
    }
    const gradients = resolvePersonalityGradientTheme(personality.id, {
      accent: primary,
      complementary: secondary,
      tertiary,
      background: base['--background'],
      foreground: base['--foreground'],
    });
    Object.assign(out, createGradientVariablesFromTheme(gradients));
    out['--gradient-primary'] = gradients.primary;
    out['--gradient-secondary'] = gradients.secondary;
  }

  // 4. Ground.
  let background = base['--background'];
  let surface = base['--surface'];
  let border = base['--border'];
  const hue = baseHsl.h;
  const groundSat = (s: number) => (neutralBase ? 0 : s);
  const groundLight = expression.ground?.light;
  const groundDark = expression.ground?.dark;
  let groundChanged = false;
  if (mode === 'light' && groundLight && groundLight !== 'white') {
    const g = LIGHT_GROUNDS[groundLight](hue);
    const bg = { ...g, s: groundLight === 'paper' ? g.s : groundSat(g.s) };
    background = hslToHex(bg);
    surface =
      groundLight === 'toned'
        ? hslToHex({ ...bg, s: bg.s * 0.6, l: 98.5 })
        : hslToHex({
            ...bg,
            l: bg.l + personality.colorGeneration.surfaceLuminosityOffset,
          });
    border = hslToHex({ ...bg, s: Math.min(40, bg.s * 1.4), l: bg.l - 16 });
    groundChanged = true;
  } else if (mode === 'dark' && groundDark && groundDark !== 'black') {
    const g = DARK_GROUNDS[groundDark](hue);
    const bg = { ...g, s: groundSat(g.s) };
    background = hslToHex(bg);
    surface = hslToHex({ ...bg, l: bg.l + (groundDark === 'dim' ? 5 : 4) });
    border = hslToHex({ ...bg, s: bg.s * 0.9, l: bg.l + 14 });
    groundChanged = true;
  }

  // 5. Accent strategy (may re-tint surfaces).
  const accent = expression.accent;
  if (accent === 'tinted-surfaces') {
    // Strongest wash that still keeps body text at the personality's ratio.
    const amounts = mode === 'light' ? [0.07, 0.05, 0.03] : [0.1, 0.07, 0.04];
    surface =
      amounts
        .map((amount) => mix(primary, surface, amount))
        .find(
          (candidate) =>
            getContrastRatio(base['--foreground'], candidate) >= ratio
        ) ?? mix(primary, surface, amounts[amounts.length - 1]);
    groundChanged = true;
  } else if (accent === 'duotone') {
    border = mix(secondary, border, 0.35);
    groundChanged = true;
  }

  if (groundChanged) {
    const anchor = mode === 'light' ? '#000000' : '#ffffff';
    let foreground = ensureContrast(
      base['--foreground'],
      background,
      ratio,
      'auto'
    );
    if (getContrastRatio(foreground, surface) < ratio) {
      foreground = ensureContrast(foreground, surface, ratio, 'auto');
    }
    if (
      getContrastRatio(foreground, background) < ratio ||
      getContrastRatio(foreground, surface) < ratio
    ) {
      foreground = liftToContrast(
        foreground,
        anchor,
        [background, surface],
        ratio
      );
    }
    const secondaryText = liftToContrast(
      base['--foreground-secondary'] ?? base['--muted'],
      foreground,
      [background],
      7
    );
    const muted = liftToContrast(
      base['--muted'],
      foreground,
      [background, surface],
      4.5
    );
    Object.assign(out, {
      '--background': background,
      '--background-base': background,
      '--surface': surface,
      '--surface-variant': surface,
      '--background-elevated': surface,
      '--border': border,
      '--foreground': foreground,
      '--foreground-primary': foreground,
      '--foreground-secondary': secondaryText,
      '--muted': muted,
      '--muted-foreground': muted,
      '--foreground-muted': muted,
    });
  }

  // Accent ground: the band that carries brand colour.
  if (accent) {
    const fg = out['--foreground'] ?? base['--foreground'];
    let ground: string;
    switch (accent) {
      case 'primary-ground':
        ground = primary;
        break;
      case 'duotone':
        ground = tertiary;
        break;
      case 'tinted-surfaces':
        ground = mix(primary, background, mode === 'light' ? 0.16 : 0.24);
        break;
      default:
        ground = surface;
    }
    if (!isHex(ground)) ground = surface;
    const onGround =
      getContrastRatio(fg, ground) >= 4.5
        ? fg
        : getSuggestedTextColor(ground).color;
    out['--accent-ground'] = ground;
    out['--on-accent-ground'] = onGround;
  }

  return withAtmosphere();

  /** 6. Atmosphere, computed from the final colours of every step above. 7. Motion. */
  function withAtmosphere(): Vars {
    const atmosphere = extensions?.atmosphere;
    if (!atmosphere) return withMotion();
    const pick = (k: string) => out[k] || base[k];
    const result = resolveAtmosphere({
      atmosphere,
      mode,
      ratio,
      primary: pick('--primary'),
      secondary: pick('--secondary'),
      tertiary: pick('--tertiary'),
      onPrimary: pick('--on-primary'),
      background: pick('--background'),
      surface: pick('--surface'),
      foreground: pick('--foreground'),
      muted: pick('--muted'),
      textSecondary: pick('--foreground-secondary'),
      accentGround: out['--accent-ground'] || undefined,
      onAccentGround: out['--on-accent-ground'] || undefined,
    });
    Object.assign(out, result.vars);
    report?.push(...result.checks);
    return withMotion();
  }

  function withMotion(): Vars {
    const motion = extensions?.motion;
    if (!motion) return out;
    const pick = (k: string) => out[k] || base[k];
    Object.assign(
      out,
      resolveMotion({
        personality,
        motion,
        atmosphereIntensity: extensions?.atmosphere?.intensity,
        primary: pick('--primary'),
        background: pick('--background'),
        surface: pick('--surface'),
        foreground: pick('--foreground'),
        accentPatternLayers: out['--pattern-accent']
          ? (out['--pattern-accent-size'] || 'auto').split(',').length
          : 0,
      }).vars
    );
    return out;
  }
}
