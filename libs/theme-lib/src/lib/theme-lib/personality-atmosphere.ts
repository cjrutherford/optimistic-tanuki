/**
 * Atmosphere: gradient backdrops, surface finishes, accent fills, button fills
 * and CSS-gradient patterns — derived from the theme's own colours.
 *
 * Every layer is emitted as concrete colours (hex/rgba), computed from the
 * colours ThemeService (and the expression layer) just produced, so it is
 * exactly as theme-responsive as the rest of the palette. Every alpha is
 * capped against the WORST-CASE composite under text: the resolver lowers a
 * layer's alpha (or mix amount) until body text, muted text, on-accent and
 * on-primary text all keep their floors. The checks it ends on are returned
 * so validation can assert them independently.
 */
import {
  getContrastRatio,
  mix,
  personalityHexToRgb as hexToRgb,
} from '@optimistic-tanuki/theme-models';
import type {
  AtmospherePattern,
  PersonalityAtmosphere,
} from '@optimistic-tanuki/theme-models';

type Mode = 'light' | 'dark';
type Vars = Record<string, string>;

export interface ContrastCheck {
  label: string;
  text: string;
  background: string;
  min: number;
}

export interface AtmosphereInput {
  atmosphere: PersonalityAtmosphere;
  mode: Mode;
  ratio: number;
  primary: string;
  secondary: string;
  tertiary: string;
  onPrimary: string;
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  textSecondary: string;
  accentGround?: string;
  onAccentGround?: string;
}

export const ATMOSPHERE_VARIABLE_KEYS = [
  '--atmosphere-backdrop',
  '--surface-fill',
  '--surface-backdrop-filter',
  '--accent-fill',
  '--primary-fill',
  '--pattern-page',
  '--pattern-page-size',
  '--pattern-accent',
  '--pattern-accent-size',
] as const;

const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(
    0,
    Math.round(alpha * 1000) / 1000
  )})`;
};
const WHITE = '#ffffff';
const BLACK = '#000000';
const cr = getContrastRatio;

/**
 * Largest alpha <= `start` (stepping down by 20%) for which every
 * `test(alpha)` passes; 0 if none do.
 */
function capAlpha(start: number, test: (alpha: number) => boolean): number {
  let a = start;
  for (let i = 0; i < 24 && a > 0.004; i++) {
    if (test(a)) return a;
    a *= 0.8;
  }
  return 0;
}

/** Effective alpha where `layers` translucent layers of the same alpha overlap. */
const stacked = (alpha: number, layers: number) => 1 - (1 - alpha) ** layers;

/** Pattern tiles: `ink` is an rgba() colour. Returns image + matching size list. */
function pattern(
  kind: AtmospherePattern,
  ink: string
): { image: string; size: string; coverage: number } | undefined {
  switch (kind) {
    case 'dots':
      return {
        image: `radial-gradient(circle, ${ink} 1.2px, transparent 1.7px)`,
        size: '18px 18px',
        coverage: 1,
      };
    case 'grid':
      return {
        image: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
        size: '24px 24px, 24px 24px',
        coverage: 2,
      };
    case 'diagonal':
      return {
        image: `repeating-linear-gradient(135deg, ${ink} 0 1px, transparent 1px 11px)`,
        size: 'auto',
        coverage: 1,
      };
    case 'stripes':
      return {
        image: `repeating-linear-gradient(-45deg, ${ink} 0 10px, transparent 10px 22px)`,
        size: 'auto',
        coverage: 1,
      };
    case 'checker':
      return {
        image: `conic-gradient(${ink} 25%, transparent 0 50%, ${ink} 0 75%, transparent 0)`,
        size: '28px 28px',
        coverage: 1,
      };
    case 'halftone':
      return {
        image: `radial-gradient(circle, ${ink} 1.6px, transparent 2.1px), radial-gradient(circle, ${ink} 0.9px, transparent 1.3px)`,
        size: '10px 10px, 7px 7px',
        coverage: 2,
      };
    case 'rings':
      return {
        image: `repeating-radial-gradient(circle at 100% 0%, ${ink} 0 1px, transparent 1px 16px)`,
        size: 'auto',
        coverage: 1,
      };
    case 'waves':
      return {
        image: `radial-gradient(circle at 50% 0%, transparent 9px, ${ink} 9.5px 10.5px, transparent 11px)`,
        size: '22px 12px',
        coverage: 1,
      };
    case 'scanline':
      return {
        image: `repeating-linear-gradient(0deg, ${ink} 0 1px, transparent 1px 4px)`,
        size: 'auto',
        coverage: 1,
      };
    case 'ledger':
      return {
        image: `repeating-linear-gradient(0deg, ${ink} 0 1px, transparent 1px 24px), linear-gradient(90deg, transparent 36px, ${ink} 36px 37px, transparent 37px 40px, ${ink} 40px 41px, transparent 41px)`,
        size: 'auto, auto',
        coverage: 2,
      };
    default:
      return undefined;
  }
}

export function resolveAtmosphere(input: AtmosphereInput): {
  vars: Vars;
  checks: ContrastCheck[];
} {
  const { atmosphere: at, mode, ratio } = input;
  const k = at.intensity ?? 1;
  const vars: Vars = {};
  const checks: ContrastCheck[] = [];
  const {
    background: bg,
    surface,
    foreground: fg,
    muted,
    primary: P,
    secondary: S,
    tertiary: T,
  } = input;

  /**
   * Body text must survive a composite of `color` over the background at
   * `alpha`. Muted/secondary text is NOT a reason to drop the atmosphere:
   * after the page layers are settled, those tones are lifted toward the body
   * text just enough to clear their floors over the most tinted point.
   */
  // Body text keeps >= 7:1 over page atmosphere (even for 4.5 personalities)
  // so secondary text — whose floor is 7 — can always be lifted to clear it.
  const pageFloor = Math.max(ratio, 7);
  const pageOk = (color: string, alpha: number) =>
    cr(fg, mix(color, bg, alpha)) >= pageFloor;
  const pagePoints: string[] = [bg];
  const pageCheck = (label: string, color: string, alpha: number) => {
    const comp = mix(color, bg, alpha);
    pagePoints.push(comp);
    checks.push({
      label: `${label}: text`,
      text: fg,
      background: comp,
      min: pageFloor,
    });
  };

  // ---- Backdrop -----------------------------------------------------------
  let worstPage = bg;
  if (at.backdrop && at.backdrop !== 'none') {
    const spec: Record<
      string,
      {
        base: number;
        colors: string[];
        layers: number;
        build: (a: number) => string;
      }
    > = {
      glow: {
        base: 0.32,
        colors: [P],
        layers: 1,
        build: (a) =>
          `radial-gradient(70% 60% at 88% -10%, ${rgba(
            P,
            a
          )}, transparent 70%)`,
      },
      spotlight: {
        base: 0.3,
        colors: [P],
        layers: 1,
        build: (a) =>
          `radial-gradient(circle at 50% -25%, ${rgba(P, a)}, transparent 62%)`,
      },
      sweep: {
        base: 0.26,
        colors: [P, T],
        layers: 1,
        build: (a) =>
          `linear-gradient(135deg, ${rgba(
            P,
            a
          )} 0%, transparent 42%, transparent 58%, ${rgba(T, a * 0.85)} 100%)`,
      },
      horizon: {
        base: 0.32,
        colors: [P, T],
        layers: 2,
        build: (a) =>
          `linear-gradient(180deg, transparent 40%, ${rgba(
            P,
            a * 0.6
          )} 100%), radial-gradient(90% 50% at 50% 108%, ${rgba(
            T,
            a
          )}, transparent 72%)`,
      },
      aurora: {
        base: 0.32,
        colors: [P, T, S],
        layers: 2,
        build: (a) =>
          `radial-gradient(55% 60% at 6% 0%, ${rgba(
            P,
            a
          )}, transparent 70%), radial-gradient(45% 55% at 94% 10%, ${rgba(
            T,
            a
          )}, transparent 70%), radial-gradient(60% 45% at 55% 108%, ${rgba(
            S,
            a * 0.8
          )}, transparent 70%)`,
      },
      mesh: {
        base: 0.28,
        colors: [P, S, T],
        layers: 2,
        build: (a) =>
          `radial-gradient(50% 50% at 0% 0%, ${rgba(
            P,
            a
          )}, transparent 70%), radial-gradient(50% 50% at 100% 0%, ${rgba(
            T,
            a
          )}, transparent 70%), radial-gradient(55% 50% at 100% 100%, ${rgba(
            S,
            a
          )}, transparent 70%), radial-gradient(50% 50% at 0% 100%, ${rgba(
            T,
            a * 0.8
          )}, transparent 70%)`,
      },
    };
    const s = spec[at.backdrop];
    const a = capAlpha(s.base * k, (x) =>
      s.colors.every((c) => pageOk(c, stacked(x, s.layers)))
    );
    vars['--atmosphere-backdrop'] = a > 0 ? s.build(a) : '';
    for (const c of s.colors)
      pageCheck(`backdrop ${at.backdrop}`, c, stacked(a, s.layers));
    // The darkest/most tinted point anything on the page can sit on.
    worstPage = s.colors
      .map((c) => mix(c, bg, stacked(a, s.layers)))
      .reduce((w, c) => (cr(fg, c) < cr(fg, w) ? c : w), bg);
  }

  // ---- Page pattern (ink = body text colour) -----------------------------
  if (at.pagePattern && at.pagePattern !== 'none') {
    const probe = pattern(at.pagePattern, 'x')!;
    const a = capAlpha(
      0.07 * k,
      (x) =>
        pageOk(fg, stacked(x, probe.coverage)) &&
        cr(fg, mix(fg, worstPage, x)) >= pageFloor
    );
    const p = pattern(at.pagePattern, rgba(fg, a))!;
    vars['--pattern-page'] = a > 0 ? p.image : '';
    vars['--pattern-page-size'] = a > 0 ? p.size : '';
    pageCheck(`page pattern ${at.pagePattern}`, fg, stacked(a, p.coverage));
  }

  // ---- Muted / secondary text over the settled page layers -----------------
  if (pagePoints.length > 1) {
    const lift = (color: string, min: number) => {
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const c = mix(fg, color, t);
        if (pagePoints.every((p) => cr(c, p) >= min)) return c;
      }
      return fg;
    };
    const liftedMuted = lift(muted, 4.5);
    const liftedSecondary = lift(input.textSecondary, 7);
    if (liftedMuted !== muted) {
      vars['--muted'] = liftedMuted;
      vars['--muted-foreground'] = liftedMuted;
      vars['--foreground-muted'] = liftedMuted;
    }
    if (liftedSecondary !== input.textSecondary)
      vars['--foreground-secondary'] = liftedSecondary;
    for (const p of pagePoints) {
      checks.push({
        label: 'page muted text over atmosphere',
        text: liftedMuted,
        background: p,
        min: 4.5,
      });
      checks.push({
        label: 'page secondary text over atmosphere',
        text: liftedSecondary,
        background: p,
        min: 7,
      });
    }
  }

  // ---- Surface finish ------------------------------------------------------
  const surfaceOk = (comp: string) => cr(fg, comp) >= ratio;
  if (at.surface && at.surface !== 'flat') {
    const highlight = mode === 'light' ? 0.55 : 0.06;
    switch (at.surface) {
      case 'sheen': {
        const h = capAlpha(highlight * k, (x) =>
          surfaceOk(mix(WHITE, surface, x))
        );
        vars['--surface-fill'] = `linear-gradient(180deg, ${rgba(
          WHITE,
          h
        )} 0%, transparent 55%)`;
        checks.push({
          label: 'surface sheen',
          text: fg,
          background: mix(WHITE, surface, h),
          min: ratio,
        });
        break;
      }
      case 'gradient': {
        const a = capAlpha(
          0.16 * k,
          (x) => surfaceOk(mix(P, surface, x)) && surfaceOk(mix(T, surface, x))
        );
        vars['--surface-fill'] = `linear-gradient(160deg, ${rgba(
          P,
          a
        )} 0%, transparent 55%, ${rgba(T, a * 0.7)} 100%)`;
        checks.push({
          label: 'surface gradient (primary)',
          text: fg,
          background: mix(P, surface, a),
          min: ratio,
        });
        checks.push({
          label: 'surface gradient (tertiary)',
          text: fg,
          background: mix(T, surface, a),
          min: ratio,
        });
        break;
      }
      case 'raised': {
        const h = capAlpha(highlight * 1.2 * k, (x) =>
          surfaceOk(mix(WHITE, surface, x))
        );
        const d = capAlpha(0.1 * k, (x) => surfaceOk(mix(BLACK, surface, x)));
        vars['--surface-fill'] = `linear-gradient(180deg, ${rgba(
          WHITE,
          h
        )} 0%, transparent 38%), linear-gradient(0deg, ${rgba(
          BLACK,
          d
        )} 0%, transparent 32%)`;
        checks.push({
          label: 'surface raised (top)',
          text: fg,
          background: mix(WHITE, surface, h),
          min: ratio,
        });
        checks.push({
          label: 'surface raised (bottom)',
          text: fg,
          background: mix(BLACK, surface, d),
          min: ratio,
        });
        break;
      }
      case 'glass': {
        // Translucent surface over the page: the worst case is the surface
        // blended with the most tinted point of the backdrop.
        const opacity =
          [0.72, 0.8, 0.88, 1].find((o) =>
            surfaceOk(mix(surface, worstPage, o))
          ) ?? 1;
        vars[
          '--personality-surface-bg'
        ] = `color-mix(in srgb, var(--surface) ${Math.round(
          opacity * 100
        )}%, transparent)`;
        vars['--surface-backdrop-filter'] = 'blur(14px) saturate(1.4)';
        const h = capAlpha((mode === 'light' ? 0.35 : 0.05) * k, (x) =>
          surfaceOk(mix(WHITE, mix(surface, worstPage, opacity), x))
        );
        vars['--surface-fill'] = `linear-gradient(180deg, ${rgba(
          WHITE,
          h
        )} 0%, transparent 45%)`;
        checks.push({
          label: 'glass surface over backdrop',
          text: fg,
          background: mix(surface, worstPage, opacity),
          min: ratio,
        });
        break;
      }
    }
  }

  // ---- Accent fill + accent pattern ---------------------------------------
  const AG = input.accentGround;
  const onAG = input.onAccentGround;
  if (AG && onAG && at.accentFill && at.accentFill !== 'flat') {
    const accentOk = (c: string) => cr(onAG, c) >= 4.5;
    switch (at.accentFill) {
      case 'linear': {
        const m = capAlpha(0.5 * k, (x) => accentOk(mix(T, AG, x)));
        vars['--accent-fill'] = `linear-gradient(120deg, ${AG} 0%, ${mix(
          T,
          AG,
          m
        )} 100%)`;
        checks.push({
          label: 'accent linear end',
          text: onAG,
          background: mix(T, AG, m),
          min: 4.5,
        });
        break;
      }
      case 'radial': {
        const toward = cr(onAG, WHITE) > cr(onAG, BLACK) ? WHITE : BLACK; // highlight moves AWAY from the text colour
        const m = capAlpha(0.35 * k, (x) => accentOk(mix(toward, AG, x)));
        vars['--accent-fill'] = `radial-gradient(120% 140% at 0% 0%, ${mix(
          toward,
          AG,
          m
        )} 0%, ${AG} 60%)`;
        checks.push({
          label: 'accent radial spot',
          text: onAG,
          background: mix(toward, AG, m),
          min: 4.5,
        });
        break;
      }
      case 'mesh': {
        const m = capAlpha(
          0.55 * k,
          (x) => accentOk(mix(T, AG, x)) && accentOk(mix(S, AG, x))
        );
        vars['--accent-fill'] = `radial-gradient(60% 90% at 100% 0%, ${mix(
          T,
          AG,
          m
        )}, transparent 70%), radial-gradient(55% 80% at 0% 100%, ${mix(
          S,
          AG,
          m
        )}, transparent 70%)`;
        checks.push({
          label: 'accent mesh (tertiary)',
          text: onAG,
          background: mix(T, AG, m),
          min: 4.5,
        });
        checks.push({
          label: 'accent mesh (secondary)',
          text: onAG,
          background: mix(S, AG, m),
          min: 4.5,
        });
        break;
      }
      case 'split': {
        const m = capAlpha(0.65 * k, (x) => accentOk(mix(T, AG, x)));
        vars[
          '--accent-fill'
        ] = `linear-gradient(100deg, transparent 0 62%, ${mix(
          T,
          AG,
          m
        )} 62% 100%)`;
        checks.push({
          label: 'accent split block',
          text: onAG,
          background: mix(T, AG, m),
          min: 4.5,
        });
        break;
      }
      case 'shine': {
        const toward = cr(onAG, WHITE) > cr(onAG, BLACK) ? WHITE : BLACK;
        const h = capAlpha(0.3 * k, (x) => accentOk(mix(toward, AG, x)));
        vars[
          '--accent-fill'
        ] = `linear-gradient(115deg, transparent 22%, ${rgba(
          toward,
          h
        )} 42%, transparent 60%)`;
        checks.push({
          label: 'accent shine',
          text: onAG,
          background: mix(toward, AG, h),
          min: 4.5,
        });
        break;
      }
    }
  }
  if (AG && onAG && at.accentPattern && at.accentPattern !== 'none') {
    const probe = pattern(at.accentPattern, 'x')!;
    const a = capAlpha(
      0.16 * k,
      (x) => cr(onAG, mix(onAG, AG, stacked(x, probe.coverage))) >= 4.5
    );
    const p = pattern(at.accentPattern, rgba(onAG, a))!;
    vars['--pattern-accent'] = a > 0 ? p.image : '';
    vars['--pattern-accent-size'] = a > 0 ? p.size : '';
    checks.push({
      label: `accent pattern ${at.accentPattern}`,
      text: onAG,
      background: mix(onAG, AG, stacked(a, p.coverage)),
      min: 4.5,
    });
  }

  // ---- Primary button fill -------------------------------------------------
  if (at.buttonFill && at.buttonFill !== 'inherit') {
    const on = input.onPrimary;
    const ok = (c: string) => cr(on, c) >= 4.5;
    if (at.buttonFill === 'gradient' || at.buttonFill === 'split') {
      const m = capAlpha(0.55 * k, (x) => ok(mix(T, P, x)));
      const end = mix(T, P, m);
      vars['--primary-fill'] =
        at.buttonFill === 'gradient'
          ? `linear-gradient(135deg, ${P} 0%, ${end} 100%)`
          : `linear-gradient(100deg, ${P} 0 58%, ${end} 58% 100%)`;
      checks.push({
        label: `button ${at.buttonFill} end`,
        text: on,
        background: end,
        min: 4.5,
      });
    } else {
      const toward = cr(on, WHITE) > cr(on, BLACK) ? WHITE : BLACK;
      const h = capAlpha(0.35 * k, (x) => ok(mix(toward, P, x)));
      vars['--primary-fill'] = `linear-gradient(115deg, transparent 25%, ${rgba(
        toward,
        h
      )} 45%, transparent 65%), ${P}`;
      checks.push({
        label: 'button shine',
        text: on,
        background: mix(toward, P, h),
        min: 4.5,
      });
    }
  }

  return { vars, checks };
}
