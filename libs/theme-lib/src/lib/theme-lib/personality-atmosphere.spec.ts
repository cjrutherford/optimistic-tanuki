import { getContrastRatio } from '@optimistic-tanuki/theme-models';
import { resolveExtensionVariables } from './personality-extensions';
import type { ContrastCheck } from './personality-atmosphere';
import {
  ALL_PERSONALITIES,
  EXISTING_EXTENSIONS,
  MODES,
  PROBE_PRIMARIES,
  captureThemeVariables,
  createThemeService,
} from './personality-extension-assignments.fixture';

describe('personality atmosphere', () => {
  it('passes every worst-case composite check it settled on', async () => {
    const svc = createThemeService();
    const failures: string[] = [];
    let total = 0;
    for (const p of ALL_PERSONALITIES) {
      for (const primary of PROBE_PRIMARIES) {
        for (const mode of MODES) {
          const base = await captureThemeVariables(svc, p, primary, mode);
          const checks: ContrastCheck[] = [];
          resolveExtensionVariables(
            p,
            EXISTING_EXTENSIONS[p.id],
            primary,
            mode,
            base,
            checks
          );
          total += checks.length;
          for (const c of checks) {
            const got = getContrastRatio(c.text, c.background);
            if (got < c.min - 0.005) {
              failures.push(
                `${p.id} ${mode} ${primary}: ${c.label} ${got.toFixed(2)} < ${
                  c.min
                }`
              );
            }
          }
        }
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  }, 180000);

  it('covers body, muted, on-accent/on-primary and glass guarantees', async () => {
    const svc = createThemeService();
    const labels = new Set<string>();
    for (const p of ALL_PERSONALITIES) {
      for (const mode of MODES) {
        const base = await captureThemeVariables(svc, p, '#3f51b5', mode);
        const checks: ContrastCheck[] = [];
        resolveExtensionVariables(
          p,
          EXISTING_EXTENSIONS[p.id],
          '#3f51b5',
          mode,
          base,
          checks
        );
        checks.forEach((c) => {
          labels.add(c.label);
          // Body text over any page atmosphere holds 7:1.
          if (/: text$/.test(c.label)) expect(c.min).toBeGreaterThanOrEqual(7);
          // Muted/secondary are lifted toward body text, never below their floors.
          if (/^page muted/.test(c.label))
            expect(c.min).toBeGreaterThanOrEqual(4.5);
          if (/^page secondary/.test(c.label))
            expect(c.min).toBeGreaterThanOrEqual(7);
          // On-accent / on-primary text over gradient stops and pattern ink.
          if (/^(accent|button)/.test(c.label))
            expect(c.min).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    const has = (re: RegExp) => [...labels].some((l) => re.test(l));
    expect(has(/: text$/)).toBe(true);
    expect(has(/^page muted/)).toBe(true);
    expect(has(/^page secondary/)).toBe(true);
    expect(has(/^accent/)).toBe(true);
    expect(has(/^button/)).toBe(true);
    expect(has(/^glass surface/)).toBe(true);
  }, 120000);
});
