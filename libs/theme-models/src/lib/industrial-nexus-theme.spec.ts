import { industrialNexusTheme } from './industrial-nexus-theme';

describe('industrialNexusTheme', () => {
  it('matches the specified industrial slate and construction amber', () => {
    expect(industrialNexusTheme.id).toBe('industrial-nexus');
    expect(industrialNexusTheme.baseColor).toBe('#1e293b');
    expect(industrialNexusTheme.primaryColor).toBe('#d97706');
    expect(industrialNexusTheme.cssVariables['--background']).toBe('#1e293b');
    expect(industrialNexusTheme.cssVariables['--primary']).toBe('#d97706');
    expect(industrialNexusTheme.cssVariables['--accent']).toBe('#fbbf24');
  });

  it('is a dark high-contrast outdoor theme', () => {
    expect(industrialNexusTheme.mode).toBe('dark');
    expect(industrialNexusTheme.highContrast).toBe(true);
    expect(industrialNexusTheme.outdoorOptimized).toBe(true);
  });

  it('exposes the tokens the nexus shell needs', () => {
    for (const token of [
      '--foreground',
      '--foreground-muted',
      '--border-color',
      '--input-bg',
      '--focus-ring',
      '--danger',
      '--success',
    ]) {
      expect(industrialNexusTheme.cssVariables[token]).toBeDefined();
    }
  });
});
