/**
 * Test fixture (specs only, excluded from the library build).
 *
 * The playground's extension-block assignments for the 12 predefined
 * personalities, plus a helper that captures the CSS variables ThemeService
 * really emits. The assignments are NOT applied in personalities.ts; opting a
 * personality in is a separate, visible change. Specs apply them to exercise
 * the resolver against every personality.
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  PREDEFINED_PERSONALITIES,
  type Personality,
  type PersonalityExtensions,
} from '@optimistic-tanuki/theme-models';
import { ThemeService } from './theme.service';
import { FontLoadingService } from './font-loading.service';
import { PERSONALITY_EXTENSIONS_ENABLED } from './personality-extensions.token';

export type Vars = Record<string, string>;
export type Mode = 'light' | 'dark';

/** Seventeen probe primaries: grey, near-black, pastel and near-white included. */
export const PROBE_PRIMARIES = [
  '#3f51b5',
  '#d97706',
  '#2dd4bf',
  '#c2185b',
  '#0d5f73',
  '#dc2626',
  '#f97316',
  '#facc15',
  '#16a34a',
  '#0d9488',
  '#0ea5e9',
  '#7c3aed',
  '#db2777',
  '#64748b',
  '#111827',
  '#fbcfb5',
  '#f5f5f4',
];
export const MODES: Mode[] = ['light', 'dark'];
export const ALL_PERSONALITIES: readonly Personality[] =
  PREDEFINED_PERSONALITIES;

export const EXISTING_EXTENSIONS: Record<string, PersonalityExtensions> = {
  // The friendly default: plain white page, but surfaces and dark mode carry
  // a soft wash of the brand colour (what separates it from foundation's
  // strictly neutral infrastructure look).
  classic: {
    expression: {
      ground: { light: 'white', dark: 'tinted' },
      accent: 'tinted-surfaces',
    },
    typeScale: {
      ratio: 1.25,
      headingWeight: 600,
      headingCase: 'none',
      headingTracking: '-0.01em',
      headingLineHeight: 1.2,
    },
    atmosphere: {
      backdrop: 'glow',
      surface: 'sheen',
      accentFill: 'linear',
      buttonFill: 'gradient',
      intensity: 0.8,
    },
    motion: { ambient: 'breathe', scenes: ['aurora-ribbon', 'glass-fog'] },
  },
  // Whitespace and type do the work: hairline-light headings on a big scale,
  // neutral brand colours respected.
  minimal: {
    expression: {
      ground: { light: 'white', dark: 'dim' },
      accent: 'restrained',
      neutralBase: 'respect',
    },
    typeScale: {
      ratio: 1.333,
      headingWeight: 300,
      headingCase: 'none',
      headingTracking: '-0.025em',
      headingLineHeight: 1.1,
    },
    atmosphere: {
      backdrop: 'none',
      surface: 'flat',
      pagePattern: 'dots',
      intensity: 0.7,
    },
    motion: { glow: 'soft', scenes: ['glass-fog'] },
  },
  // A statement: tinted canvas, solid brand bands, heavy tight headlines.
  bold: {
    expression: {
      ground: { light: 'tinted', dark: 'ink' },
      accent: 'primary-ground',
    },
    typeScale: {
      ratio: 1.414,
      headingWeight: 800,
      headingCase: 'none',
      headingTracking: '-0.03em',
      headingLineHeight: 1.05,
    },
    atmosphere: {
      backdrop: 'sweep',
      surface: 'gradient',
      accentFill: 'linear',
      accentPattern: 'stripes',
      buttonFill: 'gradient',
      intensity: 1.3,
    },
    motion: { scenes: ['halftone-tide', 'shimmer-beam'] },
  },
  // Pastel air: primary-washed canvas and surfaces, gentle scale.
  soft: {
    expression: {
      ground: { light: 'tinted', dark: 'tinted' },
      accent: 'tinted-surfaces',
    },
    typeScale: {
      ratio: 1.2,
      headingWeight: 600,
      headingCase: 'none',
      headingTracking: '0em',
      headingLineHeight: 1.25,
    },
    atmosphere: {
      backdrop: 'aurora',
      surface: 'glass',
      accentFill: 'mesh',
      buttonFill: 'gradient',
      intensity: 1,
    },
    motion: { scenes: ['canopy-dapple', 'glass-fog'] },
  },
  // Enterprise: grey app canvas with white cards, dense scale, dim dark mode.
  professional: {
    expression: {
      ground: { light: 'toned', dark: 'dim' },
      accent: 'restrained',
      neutralBase: 'respect',
    },
    typeScale: {
      ratio: 1.2,
      headingWeight: 600,
      headingCase: 'none',
      headingTracking: '-0.005em',
      headingLineHeight: 1.25,
    },
    atmosphere: {
      backdrop: 'none',
      surface: 'sheen',
      pagePattern: 'grid',
      intensity: 0.6,
    },
    motion: { scenes: ['ledger-ticker', 'parallax-grid-warp'] },
  },
  // Two inks and colour everywhere.
  playful: {
    expression: {
      ground: { light: 'tinted', dark: 'tinted' },
      accent: 'duotone',
    },
    typeScale: {
      ratio: 1.333,
      headingWeight: 700,
      headingCase: 'none',
      headingTracking: '0em',
      headingLineHeight: 1.15,
    },
    atmosphere: {
      backdrop: 'mesh',
      surface: 'gradient',
      accentFill: 'mesh',
      accentPattern: 'dots',
      buttonFill: 'shine',
      intensity: 1.3,
    },
    motion: { ambient: 'shimmer', scenes: ['clay-blobs', 'halftone-tide'] },
  },
  // Editorial paper, display-led serif scale, restrained accent.
  elegant: {
    expression: {
      ground: { light: 'paper', dark: 'black' },
      accent: 'restrained',
      neutralBase: 'respect',
    },
    typeScale: {
      ratio: 1.5,
      headingWeight: 400,
      headingCase: 'none',
      headingTracking: '0.005em',
      headingLineHeight: 1.1,
    },
    atmosphere: {
      backdrop: 'spotlight',
      surface: 'sheen',
      accentFill: 'radial',
      accentPattern: 'rings',
      intensity: 0.9,
    },
    motion: {
      enter: 'drift',
      ambient: 'shimmer',
      scenes: ['star-atlas', 'shimmer-beam'],
    },
  },
  // Raw concrete canvas, solid brand slabs, uppercase headings.
  architect: {
    expression: {
      ground: { light: 'toned', dark: 'black' },
      accent: 'primary-ground',
    },
    typeScale: {
      ratio: 1.333,
      headingWeight: 700,
      headingCase: 'uppercase',
      headingTracking: '0.02em',
      headingLineHeight: 1.05,
    },
    atmosphere: {
      backdrop: 'none',
      surface: 'flat',
      accentFill: 'split',
      accentPattern: 'diagonal',
      buttonFill: 'split',
      intensity: 1.1,
    },
    motion: {
      enter: 'snap',
      ambient: 'drift',
      scenes: ['blueprint-scan', 'grid-shift'],
    },
  },
  // Warm paper by day, tinted night, primary-washed surfaces.
  'soft-touch': {
    expression: {
      ground: { light: 'paper', dark: 'tinted' },
      accent: 'tinted-surfaces',
    },
    typeScale: {
      ratio: 1.25,
      headingWeight: 500,
      headingCase: 'none',
      headingTracking: '-0.01em',
      headingLineHeight: 1.15,
    },
    atmosphere: {
      backdrop: 'glow',
      surface: 'raised',
      accentFill: 'radial',
      buttonFill: 'gradient',
      intensity: 1,
    },
    motion: { scenes: ['canopy-dapple', 'clay-blobs'] },
  },
  // Kinetic: deep ink nights, duotone bands, heavy tight display type.
  electric: {
    expression: { ground: { light: 'tinted', dark: 'ink' }, accent: 'duotone' },
    typeScale: {
      ratio: 1.414,
      headingWeight: 800,
      headingCase: 'none',
      headingTracking: '-0.025em',
      headingLineHeight: 1.05,
    },
    atmosphere: {
      backdrop: 'aurora',
      surface: 'glass',
      accentFill: 'mesh',
      accentPattern: 'diagonal',
      buttonFill: 'shine',
      intensity: 1.5,
    },
    motion: { scenes: ['neon-circuit', 'aurora-ribbon'] },
  },
  // Instrument panel: toned console by day, ink by night, dense uppercase scale.
  'control-center': {
    expression: {
      ground: { light: 'toned', dark: 'ink' },
      accent: 'restrained',
      neutralBase: 'respect',
    },
    typeScale: {
      ratio: 1.125,
      headingWeight: 600,
      headingCase: 'uppercase',
      headingTracking: '0.04em',
      headingLineHeight: 1.2,
    },
    atmosphere: {
      backdrop: 'horizon',
      surface: 'sheen',
      pagePattern: 'scanline',
      accentPattern: 'grid',
      intensity: 0.9,
    },
    motion: { scenes: ['signal-mesh', 'blueprint-scan'] },
  },
  // Neutral infrastructure: white by day, dim by night, compact and plain.
  foundation: {
    expression: {
      ground: { light: 'white', dark: 'dim' },
      accent: 'restrained',
      neutralBase: 'respect',
    },
    typeScale: {
      ratio: 1.2,
      headingWeight: 500,
      headingCase: 'none',
      headingTracking: '-0.01em',
      headingLineHeight: 1.25,
    },
    atmosphere: { backdrop: 'none', surface: 'flat' },
    motion: { scenes: [] },
  },
};

interface ThemeServiceInternals {
  currentPersonality: unknown;
  personalityConfig: {
    personalityId: string;
    primaryColor: string;
    mode: Mode;
    version: string;
  };
  _theme: Mode;
  generateAndApplyPersonalityTheme(): Promise<void>;
}

export interface CaptureOptions {
  /** Apply EXISTING_EXTENSIONS to the personality before generating. */
  extensions?: boolean;
}

/** Configures TestBed with a ThemeService (extension kill switch optional). */
export function createThemeService(extensionsEnabled?: boolean): ThemeService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ThemeService,
      { provide: PLATFORM_ID, useValue: 'browser' },
      ...(extensionsEnabled === undefined
        ? []
        : [
            {
              provide: PERSONALITY_EXTENSIONS_ENABLED,
              useValue: extensionsEnabled,
            },
          ]),
      {
        provide: FontLoadingService,
        useValue: {
          loadPersonalityFonts: jest.fn().mockResolvedValue([]),
          applyFontVariables: jest.fn(),
        },
      },
    ],
  });
  return TestBed.inject(ThemeService);
}

/** Variables ThemeService writes to :root for one personality/primary/mode. */
export async function captureThemeVariables(
  service: ThemeService,
  personality: Personality,
  primary: string,
  mode: Mode,
  options: CaptureOptions = {}
): Promise<Vars> {
  const svc = service as unknown as ThemeServiceInternals;
  const root = document.documentElement;
  root.removeAttribute('style');
  svc.currentPersonality = options.extensions
    ? { ...personality, ...(EXISTING_EXTENSIONS[personality.id] ?? {}) }
    : personality;
  svc.personalityConfig = {
    personalityId: personality.id,
    primaryColor: primary,
    mode,
    version: '1.0.0',
  };
  svc._theme = mode;
  // ThemeService logs contrast warnings for awkward probe primaries; not signal here.
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    await svc.generateAndApplyPersonalityTheme();
  } finally {
    warn.mockRestore();
    log.mockRestore();
  }
  const vars: Vars = {};
  for (let i = 0; i < root.style.length; i++) {
    const name = root.style.item(i);
    if (name.startsWith('--'))
      vars[name] = root.style.getPropertyValue(name).trim();
  }
  return vars;
}
