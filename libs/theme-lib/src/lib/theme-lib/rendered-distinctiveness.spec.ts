import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import {
  PREDEFINED_PERSONALITIES,
  averagedRenderedDistance,
} from '@optimistic-tanuki/theme-models';
import { ThemeService } from './theme.service';
import { FontLoadingService } from './font-loading.service';

type Vars = Record<string, string>;
type Mode = 'light' | 'dark';

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

const PRIMARIES = ['#3f51b5', '#d97706', '#0d9488'];
const MODES: Mode[] = ['light', 'dark'];

/**
 * Rendered-distinctiveness floor. Unlike personality-distinctiveness.spec.ts
 * (which scores declared fields), this compares the CSS variables ThemeService
 * actually emits, averaged over 3 primaries x light/dark.
 *
 * Measured minimum at introduction: classic vs foundation = 0.136.
 * After D1 (classic, foundation, professional, minimal opted in): soft vs
 * soft-touch = 0.324.
 * After D2 (soft, soft-touch, elegant, control-center): bold vs electric =
 * 0.327.
 * After D3 (bold, playful, electric, architect): minimal vs foundation =
 * 0.339, the rollout target (>= 0.33). Floor sits just below.
 */
const RENDERED_FLOOR = 0.335;

describe('Rendered personality distinctiveness', () => {
  it('keeps the closest rendered pair above the floor', async () => {
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: FontLoadingService,
          useValue: {
            loadPersonalityFonts: jest.fn().mockResolvedValue([]),
            applyFontVariables: jest.fn(),
          },
        },
      ],
    });
    const service = TestBed.inject(ThemeService);
    const svc = service as unknown as ThemeServiceInternals;
    const root = document.documentElement;
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);

    const samples = new Map<string, Vars[]>();
    for (const p of PREDEFINED_PERSONALITIES) {
      const list: Vars[] = [];
      for (const primary of PRIMARIES) {
        for (const mode of MODES) {
          root.removeAttribute('style');
          svc.currentPersonality = p;
          svc.personalityConfig = {
            personalityId: p.id,
            primaryColor: primary,
            mode,
            version: '1.0.0',
          };
          svc._theme = mode;
          await svc.generateAndApplyPersonalityTheme();
          const vars: Vars = {};
          for (let i = 0; i < root.style.length; i++) {
            const name = root.style.item(i);
            if (name.startsWith('--')) {
              vars[name] = root.style.getPropertyValue(name).trim();
            }
          }
          list.push(vars);
        }
      }
      samples.set(p.id, list);
    }
    logSpy.mockRestore();

    const ids = PREDEFINED_PERSONALITIES.map((p) => p.id);
    let min = { a: '', b: '', d: Infinity };
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const d = averagedRenderedDistance(
          samples.get(ids[i]) as Vars[],
          samples.get(ids[j]) as Vars[]
        );
        if (d < min.d) min = { a: ids[i], b: ids[j], d };
      }
    }
    console.info(
      `closest rendered pair: ${min.a} vs ${min.b} = ${min.d.toFixed(3)}`
    );
    expect(min.d).toBeGreaterThanOrEqual(RENDERED_FLOOR);
  }, 60000);
});
