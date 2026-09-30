import { getContrastRatio } from '@optimistic-tanuki/theme-models';
import { READABLE_TEXT_RATIO, TEXT_TONES, readableOn } from './readable-text';
import {
  ALL_PERSONALITIES,
  MODES,
  PROBE_PRIMARIES,
  captureThemeVariables,
  createThemeService,
} from './personality-extension-assignments.fixture';

describe('readable text', () => {
  it('readableOn leaves passing colours alone and fixes failing ones', () => {
    expect(readableOn('#000000', ['#ffffff'])).toBe('#000000');
    const fixed = readableOn('#3f51b5', ['#1e1f24', '#26272d']);
    expect(getContrastRatio(fixed, '#1e1f24')).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(fixed, '#26272d')).toBeGreaterThanOrEqual(4.5);
  });

  // Every personality as shipped, and with the playground's full extension
  // settings (what D2-D4 turn on), x 17 probe primaries x both modes.
  for (const extensions of [false, true]) {
    it(`tone text and muted text reach ${READABLE_TEXT_RATIO}:1 on page and surface (extensions: ${extensions})`, async () => {
      const svc = createThemeService();
      const failures: string[] = [];
      for (const p of ALL_PERSONALITIES) {
        for (const primary of PROBE_PRIMARIES) {
          for (const mode of MODES) {
            const v = await captureThemeVariables(svc, p, primary, mode, {
              extensions,
            });
            const checks: [string, string][] = [
              ['--muted-foreground', v['--muted-foreground']],
              ...TEXT_TONES.filter((t) => v[`--${t}`]).map(
                (t): [string, string] => [`--${t}-text`, v[`--${t}-text`]]
              ),
            ];
            for (const [name, fg] of checks) {
              for (const bg of ['--background', '--surface']) {
                const r = getContrastRatio(fg, v[bg]);
                if (!(r >= READABLE_TEXT_RATIO))
                  failures.push(
                    `${p.id} ${mode} ${primary}: ${name} ${fg} on ${bg} ${
                      v[bg]
                    } = ${r.toFixed(2)}`
                  );
              }
            }
          }
        }
      }
      expect(failures).toEqual([]);
    }, 240000);
  }
});
