import { readFileSync } from 'fs';
import { join } from 'path';

const appRoot = join(__dirname, '..');

function readAppFile(relativePath: string): string {
  return readFileSync(join(appRoot, relativePath), 'utf8');
}

describe('leads-app theme sweep', () => {
  it('defines dark-aware app token aliases', () => {
    const styles = readAppFile('styles.scss');

    expect(styles).toContain(
      '--app-surface: var(--background-elevated, var(--surface, #ffffff));'
    );
    expect(styles).toContain(
      '--app-surface-muted: var(--surface-muted, color-mix(in srgb, var(--app-surface) 72%, var(--app-background) 28%));'
    );
    expect(styles).toContain(
      '--app-foreground-secondary: var(--foreground-secondary, #64748b);'
    );
    expect(styles).toContain(
      '--app-foreground-muted: var(--foreground-muted, #94a3b8);'
    );
  });

  it('does not use the ambiguous app-muted token in routed screen styles', () => {
    const themeAwareSources = [
      'app/app.component.scss',
      'app/dashboard.component.scss',
      'app/leads.component.scss',
      'app/topics.component.scss',
      'app/onboarding-page.component.scss',
      'app/interview-wizard.component.scss',
      'app/analytics.component.ts',
      'app/flag-lead-modal.component.ts',
    ];

    themeAwareSources.forEach((path) => {
      expect(readAppFile(path)).not.toContain('var(--app-muted)');
    });
  });
});
