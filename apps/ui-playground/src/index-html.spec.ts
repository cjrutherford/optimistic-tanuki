import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('index.html shell assets', () => {
  it('declares a favicon asset that exists in the public bundle', () => {
    const sourceRoot = __dirname;
    const indexHtml = readFileSync(resolve(sourceRoot, 'index.html'), 'utf8');
    const faviconHref = '/favicon.svg';

    expect(indexHtml).toContain(`rel="icon"`);
    expect(indexHtml).toContain(`href="${faviconHref}"`);
    expect(existsSync(resolve(sourceRoot, '../public/favicon.svg'))).toBe(true);
  });
});
