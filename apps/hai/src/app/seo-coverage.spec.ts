import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appRoutes } from './app.routes';
import { PAGE_SEO } from './content/seo';

/** Every page route has metadata and a sitemap entry; nothing extra. */
describe('SEO coverage', () => {
  const pages = appRoutes
    .filter((route) => route.loadComponent)
    .map((route) => route.path ?? '');
  const sitemap = readFileSync(
    join(__dirname, '../../public/sitemap.xml'),
    'utf8'
  );
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1]
  );

  it('has metadata for every page route and none for routes that do not exist', () => {
    expect(Object.keys(PAGE_SEO).sort()).toEqual([...pages].sort());
  });

  it('gives every page a unique title and description of sensible length', () => {
    const titles = pages.map((page) => PAGE_SEO[page].title);
    const descriptions = pages.map((page) => PAGE_SEO[page].description);

    expect(new Set(titles).size).toBe(pages.length);
    expect(new Set(descriptions).size).toBe(pages.length);
    for (const description of descriptions) {
      expect(description.length).toBeGreaterThanOrEqual(70);
      expect(description.length).toBeLessThanOrEqual(170);
    }
  });

  it('lists exactly the page routes in the sitemap, on the canonical host', () => {
    expect(locations.sort()).toEqual(
      pages
        .map((page) => `https://hopefulaspirationsindustries.com/${page}`)
        .sort()
    );
  });

  it('points robots.txt at the sitemap and keeps crawlers out of the API', () => {
    const robots = readFileSync(
      join(__dirname, '../../public/robots.txt'),
      'utf8'
    );

    expect(robots).toContain(
      'Sitemap: https://hopefulaspirationsindustries.com/sitemap.xml'
    );
    expect(robots).toContain('Disallow: /api/');
  });
});
