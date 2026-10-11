import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { SeoTitleStrategy } from './seo-title.strategy';
import { PAGE_SEO } from '../content/seo';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('SeoTitleStrategy', () => {
  let router: Router;
  let document: Document;

  const meta = (attr: 'name' | 'property', key: string) =>
    document.head
      .querySelector(`meta[${attr}="${key}"]`)
      ?.getAttribute('content');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: BlankComponent }]),
        { provide: TitleStrategy, useClass: SeoTitleStrategy },
      ],
    });
    router = TestBed.inject(Router);
    document = TestBed.inject(DOCUMENT);
  });

  it('sets title, description, canonical, OpenGraph, and Twitter tags', async () => {
    await router.navigateByUrl(
      '/private-cloud/organizations?utm_source=print#top'
    );
    const seo = PAGE_SEO['private-cloud/organizations'];

    expect(document.title).toBe(seo.title);
    expect(meta('name', 'description')).toBe(seo.description);
    expect(
      document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe(
      'https://hopefulaspirationsindustries.com/private-cloud/organizations'
    );
    expect(meta('property', 'og:title')).toBe(seo.title);
    expect(meta('property', 'og:url')).toBe(
      'https://hopefulaspirationsindustries.com/private-cloud/organizations'
    );
    expect(meta('property', 'og:image')).toBe(
      'https://hopefulaspirationsindustries.com/assets/social-card.jpg'
    );
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('updates tags in place on navigation instead of duplicating them', async () => {
    await router.navigateByUrl('/private-cloud');
    await router.navigateByUrl('/contact');

    expect(document.title).toBe(PAGE_SEO['contact'].title);
    expect(
      document.head.querySelectorAll('link[rel="canonical"]')
    ).toHaveLength(1);
    expect(
      document.head.querySelectorAll('meta[property="og:title"]')
    ).toHaveLength(1);
    expect(
      document.head.querySelectorAll('script[type="application/ld+json"]')
    ).toHaveLength(1);
  });

  it('describes the business everywhere and the private-cloud service on its pages', async () => {
    const schema = () =>
      JSON.parse(
        document.getElementById('hai-structured-data')?.textContent ?? 'null'
      );

    await router.navigateByUrl('/how-we-work');
    expect(schema()).toMatchObject({
      '@type': 'ProfessionalService',
      telephone: '+1-912-521-7314',
      email: 'chris@hopefulaspirationsindustries.com',
    });

    await router.navigateByUrl('/private-cloud/home');
    expect(
      schema().map((entry: { '@type': string }) => entry['@type'])
    ).toEqual(['ProfessionalService', 'Service']);
  });

  it('falls back to the homepage metadata for unknown paths', async () => {
    await router.navigateByUrl('/not-a-page');

    expect(document.title).toBe(PAGE_SEO[''].title);
  });
});
