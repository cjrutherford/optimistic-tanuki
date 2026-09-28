import { civicClearTheme } from './civic-clear-theme';

describe('civicClearTheme', () => {
  it('is a light high-contrast public theme', () => {
    expect(civicClearTheme.id).toBe('civic-clear');
    expect(civicClearTheme.baseColor).toBe('#ffffff');
    expect(civicClearTheme.primaryColor).toBe('#1d4ed8');
    expect(civicClearTheme.mode).toBe('light');
    expect(civicClearTheme.highContrast).toBe(true);
  });

  it('exposes the tokens the civic shell needs', () => {
    for (const token of [
      '--background',
      '--foreground',
      '--foreground-muted',
      '--primary',
      '--accent',
      '--border-color',
      '--input-bg',
      '--focus-ring',
      '--danger',
      '--success',
    ]) {
      expect(civicClearTheme.cssVariables[token]).toBeDefined();
    }
  });
});
