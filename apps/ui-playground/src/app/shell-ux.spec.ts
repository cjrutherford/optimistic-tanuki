import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ui-playground shell ux assets', () => {
  it('includes browser theme metadata in index.html', () => {
    const indexHtml = readFileSync(join(__dirname, '../index.html'), 'utf8');

    expect(indexHtml).toContain('name="theme-color"');
  });

  it('defines global focus-visible styling and anchored scroll offsets', () => {
    const styles = readFileSync(join(__dirname, '../styles.scss'), 'utf8');

    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('scroll-margin-top');
  });
});
