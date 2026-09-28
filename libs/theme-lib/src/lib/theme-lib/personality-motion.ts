/**
 * Motion: entrances, interaction feedback (glow + focus ring) and ambient
 * motion. Mostly WIRING of fields personalities already author but nothing
 * reads — `presentation.animation.style`, `tokens.shadowProfile`,
 * `animations.duration/easing/speed/prefersReducedMotion` — with an optional
 * `motion` block to override.
 *
 * Emits parameters, not keyframes: the keyframes live once in theme-styles
 * (`_motion.scss`) and read these variables, so a personality switch changes
 * the motion without new CSS.
 *
 * Hard limits, applied here and asserted by validation:
 *   entrance travel <= 8px, scale >= 0.97, duration <= 700ms
 *   glow alpha <= 0.35
 *   ambient period >= 4s
 *   prefersReducedMotion personalities: fade-only entrance, no ambient
 */
import {
  getContrastRatio,
  personalityHexToRgb as hexToRgb,
  type Personality,
  type MotionAmbient,
  type MotionEnter,
  type MotionGlow,
  type PersonalityMotion,
} from '@optimistic-tanuki/theme-models';

type Vars = Record<string, string>;

export const MOTION_VARIABLE_KEYS = [
  '--motion-enter-transform',
  '--motion-enter-opacity',
  '--motion-enter-filter',
  '--motion-enter-duration',
  '--motion-enter-easing',
  '--glow-hover',
  '--glow-focus',
  '--focus-ring-color',
  '--ambient-glow',
  '--ambient-pulse-color',
  '--ambient-sheen',
  '--ambient-primary-animation',
  '--ambient-pulse-animation',
  '--ambient-sheen-animation',
  '--ambient-band-animation',
  '--ambient-drift-to',
  '--scene-tempo',
  '--scene-energy',
] as const;

export const MOTION_LIMITS = {
  maxTravelPx: 8,
  minScale: 0.97,
  maxEnterMs: 700,
  maxGlowAlpha: 0.35,
  minAmbientSeconds: 4,
} as const;

const rgba = (hex: string, a: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(MOTION_LIMITS.maxGlowAlpha, a)})`;
};

const ms = (v: string) =>
  v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000;

/** `presentation.animation.style` → entrance (the wiring). */
function deriveEnter(p: Personality): Exclude<MotionEnter, 'auto'> {
  switch (p.presentation?.animation.style) {
    case 'none':
      return 'none';
    case 'flowing':
      return 'drift';
    case 'bouncy':
      return 'settle';
    case 'wobbly':
      return 'snap';
    case 'pulsing':
    case 'subtle':
    default:
      return 'rise';
  }
}

/** `tokens.shadowProfile` → glow (the wiring). */
function deriveGlow(p: Personality): Exclude<MotionGlow, 'auto'> {
  switch (p.tokens.shadowProfile) {
    case 'neon':
      return 'neon';
    case 'playful-drop':
      return 'halo';
    case 'diffuse':
    case 'layered':
      return 'soft';
    default:
      return 'none';
  }
}

/** `presentation.animation.style` → ambient (the wiring). */
function deriveAmbient(p: Personality): Exclude<MotionAmbient, 'auto'> {
  switch (p.presentation?.animation.style) {
    case 'pulsing':
    case 'flowing':
      return 'breathe';
    case 'bouncy':
      return 'pulse';
    case 'wobbly':
      return 'drift';
    default:
      return 'none';
  }
}

export interface MotionInput {
  personality: Personality;
  motion: PersonalityMotion;
  /** `atmosphere.intensity` (default 1): how much texture/pop the personality carries. */
  atmosphereIntensity?: number;
  primary: string;
  background: string;
  surface: string;
  foreground: string;
  /** Layers in the accent band's pattern (0 = none; drift needs one). */
  accentPatternLayers: number;
}

export interface ResolvedMotion {
  vars: Vars;
  enter: Exclude<MotionEnter, 'auto'>;
  glow: Exclude<MotionGlow, 'auto'>;
  ambient: Exclude<MotionAmbient, 'auto'>;
}

export function resolveMotion(input: MotionInput): ResolvedMotion {
  const { personality: p, motion: m, primary: P } = input;
  const reduced = p.animations.prefersReducedMotion;
  const vars: Vars = {};

  // ---- Entrance -----------------------------------------------------------
  let enter = !m.enter || m.enter === 'auto' ? deriveEnter(p) : m.enter;
  if (reduced && enter !== 'none') enter = 'fade';
  const T = MOTION_LIMITS.maxTravelPx;
  const from: Record<
    typeof enter,
    { transform: string; opacity: string; filter: string }
  > = {
    none: { transform: 'none', opacity: '1', filter: 'none' },
    fade: { transform: 'none', opacity: '0', filter: 'none' },
    rise: { transform: `translateY(${T}px)`, opacity: '0', filter: 'none' },
    settle: {
      transform: `scale(${MOTION_LIMITS.minScale})`,
      opacity: '0',
      filter: 'none',
    },
    slide: { transform: `translateX(-${T}px)`, opacity: '0', filter: 'none' },
    snap: { transform: `translateY(${T / 2}px)`, opacity: '0', filter: 'none' },
    drift: {
      transform: `translateY(${T / 2}px)`,
      opacity: '0',
      filter: 'blur(3px)',
    },
  };
  const f = from[enter];
  const normal = ms(p.animations.duration.normal);
  // Entrances run a touch longer than hover transitions so they're noticed.
  const duration =
    enter === 'none'
      ? 0
      : Math.round(
          Math.min(MOTION_LIMITS.maxEnterMs, Math.max(220, normal * 1.6))
        );
  vars['--motion-enter-transform'] = f.transform;
  vars['--motion-enter-opacity'] = f.opacity;
  vars['--motion-enter-filter'] = f.filter;
  vars['--motion-enter-duration'] = `${duration}ms`;
  vars['--motion-enter-easing'] =
    enter === 'snap' ? 'steps(3, end)' : p.animations.easing;

  // ---- Glow + focus ring ----------------------------------------------------
  const glow = !m.glow || m.glow === 'auto' ? deriveGlow(p) : m.glow;
  const glowValue: Record<typeof glow, string> = {
    none: '',
    soft: `drop-shadow(0 0 6px ${rgba(P, 0.28)})`,
    halo: `drop-shadow(0 0 10px ${rgba(P, 0.32)})`,
    neon: `drop-shadow(0 0 3px ${rgba(P, 0.35)}) drop-shadow(0 0 12px ${rgba(
      P,
      0.28
    )})`,
  };
  // Hover glow is a filter (it follows the button's shape); focus glow is a
  // box-shadow appended after the personality's own focus style, so input
  // text never blurs.
  const focusGlow: Record<typeof glow, string> = {
    none: '',
    soft: `0 0 10px 1px ${rgba(P, 0.24)}`,
    halo: `0 0 14px 2px ${rgba(P, 0.28)}`,
    neon: `0 0 6px 1px ${rgba(P, 0.35)}, 0 0 18px 2px ${rgba(P, 0.24)}`,
  };
  vars['--glow-hover'] = glowValue[glow];
  vars['--glow-focus'] = focusGlow[glow];
  // Focus ring: the primary when it's visible against both grounds (WCAG
  // non-text contrast, 3:1), otherwise the body text colour.
  const visible = (c: string) =>
    getContrastRatio(c, input.background) >= 3 &&
    getContrastRatio(c, input.surface) >= 3;
  vars['--focus-ring-color'] = visible(P) ? P : input.foreground;

  // ---- Ambient --------------------------------------------------------------
  let ambient =
    !m.ambient || m.ambient === 'auto' ? deriveAmbient(p) : m.ambient;
  if (reduced) ambient = 'none';
  if (ambient === 'drift' && input.accentPatternLayers === 0)
    ambient = 'breathe';
  const pace =
    p.animations.speed === 'slow' || p.animations.speed === 'deliberate'
      ? 1.3
      : p.animations.speed === 'fast' || p.animations.speed === 'instant'
      ? 0.9
      : 1;
  const period = (base: number) =>
    `${Math.max(
      MOTION_LIMITS.minAmbientSeconds,
      Math.round(base * pace * 10) / 10
    )}s`;
  vars['--ambient-glow'] = glowValue[glow === 'none' ? 'soft' : glow];
  vars['--ambient-pulse-color'] = rgba(P, 0.32);
  vars['--ambient-sheen'] =
    ambient === 'shimmer'
      ? 'linear-gradient(110deg, transparent 40%, rgba(255, 255, 255, 0.26) 50%, transparent 60%)'
      : '';
  vars['--ambient-primary-animation'] =
    ambient === 'breathe'
      ? `personality-breathe ${period(5)} ease-in-out infinite alternate`
      : 'none';
  vars['--ambient-pulse-animation'] =
    ambient === 'pulse'
      ? `personality-pulse ${period(4.5)} ease-out infinite`
      : 'none';
  vars['--ambient-sheen-animation'] =
    ambient === 'shimmer'
      ? `personality-shimmer ${period(6)} ease-in-out infinite`
      : 'none';
  // The sheen overlay (::after) runs on both the primary action and the accent band.
  vars['--ambient-band-animation'] =
    ambient === 'drift'
      ? `personality-drift ${period(28)} linear infinite`
      : 'none';
  // Only the pattern layers pan; the gradient fill layers under them stay put.
  vars['--ambient-drift-to'] =
    ambient === 'drift'
      ? Array.from(
          { length: input.accentPatternLayers },
          () => '96px 48px'
        ).join(', ')
      : '';

  // ---- Scene contract (motion-ui) -------------------------------------------
  // Multipliers on a scene's own `speed` / `intensity` inputs, both neutral
  // at 1 so existing scenes are unchanged until a personality opts in.
  const tempoBySpeed: Record<string, number> = {
    instant: 0.8,
    fast: 1.15,
    normal: 1,
    slow: 0.8,
    deliberate: 0.65,
  };
  let tempo = tempoBySpeed[p.animations.speed] ?? 1;
  let energy =
    0.75 +
    0.2 * (input.atmosphereIntensity ?? 1) +
    (ambient !== 'none' ? 0.1 : 0);
  if (reduced) {
    // Calm means slower, not fainter (M1.5 presence pass): tempo takes most
    // of the reduction, energy only a little.
    tempo *= 0.6;
    energy *= 0.85;
  }
  // Floor: calm personalities stay calm, but a scene must still visibly move.
  tempo = Math.max(0.5, tempo);
  vars['--scene-tempo'] = String(Math.round(tempo * 100) / 100);
  vars['--scene-energy'] = String(
    Math.round(Math.min(1.2, Math.max(0.65, energy)) * 100) / 100
  );

  return { vars, enter, glow, ambient };
}
