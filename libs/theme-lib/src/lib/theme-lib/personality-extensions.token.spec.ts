import { PERSONALITY_EXTENSIONS_ENABLED } from './personality-extensions.token';
import { TestBed } from '@angular/core/testing';
import {
  ALL_PERSONALITIES,
  EXISTING_EXTENSIONS,
  MODES,
  captureThemeVariables,
  withoutExtensions,
  createThemeService,
} from './personality-extension-assignments.fixture';

describe('PERSONALITY_EXTENSIONS_ENABLED kill switch', () => {
  it('defaults to true', () => {
    TestBed.resetTestingModule();
    expect(TestBed.inject(PERSONALITY_EXTENSIONS_ENABLED)).toBe(true);
  });

  it('false yields exactly the pre-extension variables, even for opted-in personalities', async () => {
    const off = createThemeService(false);
    const on = createThemeService(true);
    for (const p of ALL_PERSONALITIES) {
      for (const mode of MODES) {
        const plain = await captureThemeVariables(
          on,
          withoutExtensions(p),
          '#3f51b5',
          mode
        );
        const opted = await captureThemeVariables(off, p, '#3f51b5', mode, {
          extensions: true,
        });
        expect(opted).toEqual(plain);
      }
    }
  }, 120000);

  it('true applies the extension layer once a personality opts in', async () => {
    const on = createThemeService(true);
    const p = ALL_PERSONALITIES.find((x) => EXISTING_EXTENSIONS[x.id]);
    expect(p).toBeDefined();
    const v = await captureThemeVariables(on, p!, '#3f51b5', 'light', {
      extensions: true,
    });
    expect(v['--touch-target']).toBeDefined();
  }, 60000);
});
