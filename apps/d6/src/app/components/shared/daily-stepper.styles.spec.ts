import { DAILY_STEPPER_SHARED_STYLES } from './daily-stepper.styles';

describe('DAILY_STEPPER_SHARED_STYLES', () => {
  it('exports a non-empty CSS string', () => {
    expect(typeof DAILY_STEPPER_SHARED_STYLES).toBe('string');
    expect(DAILY_STEPPER_SHARED_STYLES.trim().length).toBeGreaterThan(0);
  });

  it('declares the canonical shell selectors both daily modules consume', () => {
    // These selectors are referenced by both daily-four and daily-six
    // templates. Removing any of them from the shared sheet would silently
    // break one (or both) of the consuming components — guard against drift.
    const requiredSelectors = [
      ':host',
      '.container',
      '.page-title',
      '.stepper-card',
      '.modal-overlay',
      '.modal-content',
      '.modal-question',
      '.modal-actions',
      '.loading-content',
      '.loading-spinner',
      '.entries-card',
      '.entries-list',
      '.entry-item',
      '.entry-date',
      '.entry-preview',
      '.empty-state',
    ];

    for (const selector of requiredSelectors) {
      expect(DAILY_STEPPER_SHARED_STYLES).toContain(selector);
    }
  });

  it('uses ThemeService-driven tokens (with legacy fallbacks)', () => {
    // Spot-check that the canonical workspace tokens are referenced — the
    // whole point of cross-A/B/C/D was to route everything through
    // ThemeService, and a future refactor that drops `var(--foreground)`
    // back to a literal hex should fail this guard.
    expect(DAILY_STEPPER_SHARED_STYLES).toContain('var(--foreground');
    expect(DAILY_STEPPER_SHARED_STYLES).toContain('var(--surface');
    expect(DAILY_STEPPER_SHARED_STYLES).toContain('var(--border');
    expect(DAILY_STEPPER_SHARED_STYLES).toContain('var(--muted');
    expect(DAILY_STEPPER_SHARED_STYLES).toContain('var(--spacing-');
  });
});
