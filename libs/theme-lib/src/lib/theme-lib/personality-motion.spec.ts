import { getContrastRatio } from '@optimistic-tanuki/theme-models';
import { MOTION_LIMITS } from './personality-motion';
import {
  ALL_PERSONALITIES,
  EXISTING_EXTENSIONS,
  MODES,
  PROBE_PRIMARIES,
  captureThemeVariables,
  createThemeService,
} from './personality-extension-assignments.fixture';

const AMBIENT_KEYS = [
  '--ambient-primary-animation',
  '--ambient-pulse-animation',
  '--ambient-sheen-animation',
  '--ambient-band-animation',
];
const GLOW_KEYS = [
  '--glow-hover',
  '--glow-focus',
  '--ambient-glow',
  '--ambient-pulse-color',
];

describe('personality motion limits', () => {
  it('holds every motion limit for every personality, primary and mode', async () => {
    const svc = createThemeService();
    const failures: string[] = [];
    let checked = 0;
    for (const p of ALL_PERSONALITIES) {
      if (!EXISTING_EXTENSIONS[p.id]?.motion) continue;
      for (const primary of PROBE_PRIMARIES) {
        for (const mode of MODES) {
          checked++;
          const v = await captureThemeVariables(svc, p, primary, mode, {
            extensions: true,
          });
          const tag = `${p.id} ${mode} ${primary}`;
          const t = v['--motion-enter-transform'] ?? 'none';
          for (const m of t.matchAll(/translate[XY]?\((-?[\d.]+)px\)/g)) {
            if (Math.abs(parseFloat(m[1])) > MOTION_LIMITS.maxTravelPx)
              failures.push(`${tag}: travel ${m[1]}`);
          }
          for (const m of t.matchAll(/scale\(([\d.]+)\)/g)) {
            if (parseFloat(m[1]) < MOTION_LIMITS.minScale)
              failures.push(`${tag}: scale ${m[1]}`);
          }
          const dur = parseFloat(v['--motion-enter-duration'] ?? '0');
          if (dur > MOTION_LIMITS.maxEnterMs)
            failures.push(`${tag}: entrance ${dur}ms`);
          const ambient = AMBIENT_KEYS.map((k) => v[k] ?? 'none').filter(
            (a) => a !== 'none'
          );
          for (const a of ambient) {
            const secs = parseFloat(/([\d.]+)s\b/.exec(a)?.[1] ?? '0');
            if (secs < MOTION_LIMITS.minAmbientSeconds)
              failures.push(`${tag}: ambient ${secs}s`);
          }
          for (const k of GLOW_KEYS) {
            for (const m of (v[k] ?? '').matchAll(
              /rgba\([^)]*,\s*([\d.]+)\)/g
            )) {
              if (parseFloat(m[1]) > MOTION_LIMITS.maxGlowAlpha)
                failures.push(`${tag}: ${k} alpha ${m[1]}`);
            }
          }
          const ring = v['--focus-ring-color'];
          if (
            !ring ||
            getContrastRatio(ring, v['--background']) < 3 ||
            getContrastRatio(ring, v['--surface']) < 3
          ) {
            failures.push(`${tag}: focus ring ${ring}`);
          }
          if (
            p.animations.prefersReducedMotion &&
            (ambient.length || t !== 'none')
          ) {
            failures.push(`${tag}: reduced-motion personality moves`);
          }
          const tempo = parseFloat(v['--scene-tempo'] ?? '');
          if (!(tempo >= 0.5))
            failures.push(`${tag}: scene tempo ${v['--scene-tempo']}`);
          if (v['--scene-energy'] === undefined)
            failures.push(`${tag}: no --scene-energy`);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  }, 180000);
});
