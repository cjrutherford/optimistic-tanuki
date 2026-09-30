import { getContrastRatio } from '@optimistic-tanuki/theme-models';
import {
  EXTENSION_VARIABLE_KEYS,
  resolveExtensionVariables,
} from './personality-extensions';
import {
  ALL_PERSONALITIES,
  EXISTING_EXTENSIONS,
  MODES,
  PROBE_PRIMARIES,
  UNCONFIGURED_PERSONALITIES,
  captureThemeVariables,
  createThemeService,
} from './personality-extension-assignments.fixture';

const WIRING = [
  '--line-height',
  '--letter-spacing',
  '--touch-target',
  '--layout-max-width',
  '--stagger-delay',
];

describe('personality extension resolver', () => {
  it('no-op: no config means zero overrides and an unchanged ThemeService output', async () => {
    const off = createThemeService(false);
    const offVars = new Map<string, Record<string, string>>();
    for (const p of UNCONFIGURED_PERSONALITIES) {
      for (const mode of MODES) {
        offVars.set(
          `${p.id}/${mode}`,
          await captureThemeVariables(off, p, '#3f51b5', mode)
        );
      }
    }
    const on = createThemeService();
    for (const p of UNCONFIGURED_PERSONALITIES) {
      for (const mode of MODES) {
        const base = await captureThemeVariables(on, p, '#3f51b5', mode);
        expect(base).toEqual(offVars.get(`${p.id}/${mode}`));
        const extra = resolveExtensionVariables(
          p,
          undefined,
          '#3f51b5',
          mode,
          base
        );
        expect(Object.entries(extra).filter(([, v]) => v !== '')).toEqual([]);
        // Nothing ThemeService emitted is overridden.
        expect(Object.keys(extra).filter((k) => k in base)).toEqual([]);
        for (const k of WIRING) expect(base[k]).toBeUndefined();
      }
    }
  }, 120000);

  it('always emits the full key set, with empty string meaning cleared', async () => {
    const svc = createThemeService();
    for (const p of ALL_PERSONALITIES) {
      const base = await captureThemeVariables(svc, p, '#3f51b5', 'light');
      const optedIn = resolveExtensionVariables(
        p,
        EXISTING_EXTENSIONS[p.id],
        '#3f51b5',
        'light',
        base
      );
      const none = resolveExtensionVariables(
        p,
        undefined,
        '#3f51b5',
        'light',
        base
      );
      for (const k of EXTENSION_VARIABLE_KEYS) {
        expect(optedIn).toHaveProperty([k]);
        expect(none[k]).toBe('');
      }
      for (const k of WIRING) expect(optedIn[k]).not.toBe('');
    }
  }, 60000);

  it('keeps every override readable across personalities, probe primaries and modes', async () => {
    const svc = createThemeService();
    const failures: string[] = [];
    for (const p of ALL_PERSONALITIES) {
      for (const primary of PROBE_PRIMARIES) {
        for (const mode of MODES) {
          const v = await captureThemeVariables(svc, p, primary, mode, {
            extensions: true,
          });
          const tag = `${p.id} ${mode} ${primary}`;
          const need = p.contrast.minimumRatio;
          const fgBg = getContrastRatio(v['--foreground'], v['--background']);
          const fgSurface = getContrastRatio(v['--foreground'], v['--surface']);
          if (Math.min(fgBg, fgSurface) < need)
            failures.push(`${tag} body ${fgBg}/${fgSurface} < ${need}`);
          if (getContrastRatio(v['--muted'], v['--background']) < 4.5)
            failures.push(`${tag} muted`);
          if (getContrastRatio(v['--on-primary'], v['--primary']) < 4.5)
            failures.push(`${tag} on-primary`);
          if (
            v['--accent-ground'] &&
            getContrastRatio(v['--on-accent-ground'], v['--accent-ground']) <
              4.5
          ) {
            failures.push(`${tag} on-accent-ground`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  }, 180000);
});
