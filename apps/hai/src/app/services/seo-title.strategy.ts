import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import {
  ORGANIZATION_SCHEMA,
  PAGE_SEO,
  PRIVATE_CLOUD_SERVICE_SCHEMA,
  PageSeo,
  SITE_NAME,
  SITE_ORIGIN,
  SOCIAL_IMAGE,
} from '../content/seo';

const SCHEMA_ID = 'hai-structured-data';

/**
 * Sets each page's title, description, canonical URL, OpenGraph and Twitter
 * tags, and structured data on every navigation, including the server render
 * that crawlers and link previews read.
 */
@Injectable()
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const path = snapshot.url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
    const seo: PageSeo = PAGE_SEO[path] ?? PAGE_SEO[''];
    const canonical = `${SITE_ORIGIN}/${path}`;
    const image = `${SITE_ORIGIN}${SOCIAL_IMAGE.path}`;

    this.title.setTitle(seo.title);
    for (const [key, content] of [
      ['description', seo.description],
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', seo.title],
      ['twitter:description', seo.description],
      ['twitter:image', image],
      ['twitter:image:alt', SOCIAL_IMAGE.alt],
    ]) {
      this.meta.updateTag({ name: key, content });
    }
    for (const [key, content] of [
      ['og:type', 'website'],
      ['og:site_name', SITE_NAME],
      ['og:locale', 'en_US'],
      ['og:title', seo.title],
      ['og:description', seo.description],
      ['og:url', canonical],
      ['og:image', image],
      ['og:image:width', String(SOCIAL_IMAGE.width)],
      ['og:image:height', String(SOCIAL_IMAGE.height)],
      ['og:image:alt', SOCIAL_IMAGE.alt],
    ]) {
      this.meta.updateTag({ property: key, content });
    }
    this.setCanonical(canonical);
    this.setSchema(
      path.startsWith('private-cloud')
        ? [ORGANIZATION_SCHEMA, PRIVATE_CLOUD_SERVICE_SCHEMA]
        : [ORGANIZATION_SCHEMA]
    );
  }

  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private setSchema(schemas: object[]): void {
    let script = this.document.getElementById(SCHEMA_ID);
    if (!script) {
      script = this.document.createElement('script');
      script.id = SCHEMA_ID;
      script.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(
      schemas.length === 1 ? schemas[0] : schemas
    );
  }
}
