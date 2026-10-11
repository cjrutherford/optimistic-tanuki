import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findStyleLiterals } from './style-literals';

/**
 * Every HAI style reads the theme and personality system (S020, D008, D012),
 * so a visitor's personality, mode, and palette change every page. See
 * `style-literals.ts` for what counts as a literal and how to exempt one.
 */
const SOURCE_ROOT = join(__dirname, '..');
const TOKEN_LAYER = 'app/app.component.scss';

function filesUnder(dir: string, suffix: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(full, suffix);
    return name.endsWith(suffix) ? [full] : [];
  });
}

describe('HAI style tokens', () => {
  const stylesheets = filesUnder(SOURCE_ROOT, '.scss');

  it('finds the stylesheets', () => {
    expect(stylesheets.length).toBeGreaterThan(20);
  });

  it('has no hard-coded values outside the allowed exceptions', () => {
    const report = stylesheets.flatMap((file) => {
      const path = relative(SOURCE_ROOT, file);
      return findStyleLiterals(readFileSync(file, 'utf8'), {
        allowCustomProperties: path === TOKEN_LAYER,
      }).map(
        ({ line, declaration, literal }) =>
          `${path}:${line} ${literal} in "${declaration}"`
      );
    });

    expect(report).toEqual([]);
  });

  it('keeps component styles in stylesheets, not inline', () => {
    const inline = filesUnder(SOURCE_ROOT, '.ts')
      .filter((file) => !file.endsWith('.spec.ts'))
      .filter((file) => /\bstyles\s*:\s*[[`]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SOURCE_ROOT, file));

    expect(inline).toEqual([]);
  });

  describe('the literal finder', () => {
    const literals = (scss: string) =>
      findStyleLiterals(scss).map(({ literal }) => literal);

    it('flags a newly introduced literal', () => {
      expect(literals('.card {\n  padding: 1.25rem;\n}')).toEqual(['1.25rem']);
      expect(literals('.a {\n  font-size: 0.9rem;\n}')).toEqual(['0.9rem']);
      expect(literals('.a {\n  transition: color 0.2s ease;\n}')).toEqual([
        '0.2s',
      ]);
      expect(
        literals('.a {\n  box-shadow: 0 4px 12px\n    var(--shadow-color);\n}')
      ).toEqual(['4px']);
      expect(literals('.a {\n  font-weight: 700;\n}')).toEqual(['700']);
      expect(literals('.a {\n  line-height: 1.4;\n}')).toEqual(['1.4']);
      expect(literals('.a {\n  border: 2px solid var(--border);\n}')).toEqual([
        '2px',
      ]);
    });

    it('accepts tokens, helpers, and fallbacks', () => {
      expect(
        literals(
          [
            '.a {',
            '  padding: section.space(1.25) section.space(0.5);',
            '  font-size: var(--type-small, 0.8rem);',
            '  box-shadow: var(--shadow-md, 0 4px 12px black);',
            '  line-height: section.leading(copy);',
            '  border: 1px solid var(--border);',
            '  margin: 0 auto;',
            '  max-width: 60ch;',
            '  z-index: 1;',
            '  &:hover {',
            '    opacity: 1;',
            '  }',
            '}',
          ].join('\n')
        )
      ).toEqual([]);
    });

    it('accepts a literal with a stated reason on the line above', () => {
      expect(
        literals(
          '.a {\n  // token-exempt: standard visually-hidden pattern\n  width: 1px;\n  height: 2px;\n}'
        )
      ).toEqual(['2px']);
      expect(literals('.a {\n  // token-exempt:\n  width: 2px;\n}')).toEqual([
        '2px',
      ]);
    });
  });
});
