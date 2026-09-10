import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PublishedAppConfiguration } from '@optimistic-tanuki/app-config-models';

import {
  PublishedAppShellComponent,
  type PublishedFeatureRegistryEntry,
} from './published-app-shell.component';

@Component({
  standalone: true,
  template: '<p>Blog fixture</p>',
})
class TestPublishedFeatureComponent {
  static receivedContext: unknown;

  @Input()
  set publishedContext(value: unknown) {
    TestPublishedFeatureComponent.receivedContext = value;
  }
}

const publishedConfig: PublishedAppConfiguration = {
  id: 'published-1',
  name: 'North Star Journal',
  description: 'A published client app',
  landingPage: { layout: 'single-column', sections: [] },
  routes: [
    {
      id: 'home',
      path: '/',
      name: 'Home',
      componentType: 'landing',
      order: 0,
      showInNav: true,
    },
    {
      id: 'blog',
      path: '/blog',
      name: 'Blog',
      componentType: 'feature',
      featureName: 'blogging',
      order: 1,
      showInNav: true,
    },
    {
      id: 'hidden',
      path: '/hidden',
      name: 'Hidden',
      componentType: 'feature',
      featureName: 'blogging',
      order: 2,
      showInNav: false,
    },
  ],
  features: {
    blogging: { enabled: true, allowComments: false, moderateComments: false },
  },
  theme: { mode: 'light', personalityId: 'foundation' },
  active: true,
  publishedVersion: 1,
};

describe('PublishedAppShellComponent', () => {
  let fixture: ComponentFixture<PublishedAppShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublishedAppShellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PublishedAppShellComponent);
    fixture.componentRef.setInput('config', publishedConfig);
    fixture.detectChanges();
  });

  it('renders identity, skip navigation, and semantic landmarks', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(
      host.querySelector('a[href="#published-main"]')?.textContent
    ).toContain('Skip to main content');
    expect(
      host.querySelector('[data-published-app-identity]')?.textContent
    ).toContain('North Star Journal');
    expect(
      host.querySelector('nav[aria-label="Published app navigation"]')
    ).not.toBeNull();
    expect(host.querySelector('main#published-main')).not.toBeNull();
  });

  it('orders only enabled show-in-nav routes and keeps the drawer keyboard operable', () => {
    const host = fixture.nativeElement as HTMLElement;
    const links = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('[data-published-nav-link]')
    );

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Home',
      'Blog',
    ]);
    expect(host.querySelector('[data-nav-link="Hidden"]')).toBeNull();

    const menuButton =
      host.querySelector<HTMLButtonElement>('[data-nav-toggle]');
    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
    menuButton?.click();
    fixture.detectChanges();
    expect(menuButton?.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-published-nav-drawer]')).not.toBeNull();
  });

  it('closes the responsive navigation drawer when Escape is pressed', () => {
    const host = fixture.nativeElement as HTMLElement;
    const menuButton =
      host.querySelector<HTMLButtonElement>('[data-nav-toggle]');

    menuButton?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.navOpen).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.navOpen).toBe(false);
    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the shell visible when an allowlisted feature rejects loading', async () => {
    const rejectedFeature: PublishedFeatureRegistryEntry = {
      capabilityId: 'blogging.posts',
      featureName: 'blogging',
      load: () => Promise.reject(new Error('feature unavailable')),
    };
    fixture.componentRef.setInput('featureRegistry', [rejectedFeature]);
    fixture.componentRef.setInput('activePath', '/blog');
    fixture.detectChanges();

    await fixture.componentInstance.loadActiveFeature();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-published-app-identity]')).not.toBeNull();
    expect(
      host.querySelector('nav[aria-label="Published app navigation"]')
    ).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'This feature is temporarily unavailable'
    );
  });

  it('keeps Blogging public when its manifest has read permission but a public placement', async () => {
    const configWithManifest = {
      ...publishedConfig,
      manifest: {
        schemaVersion: 1 as const,
        surfaceType: 'generic' as const,
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'public-content' as const,
            permissions: ['blog.post.read'],
            resourceRef: { type: 'blog-catalog', id: 'catalog-north' },
          },
        },
      },
    };
    fixture.componentRef.setInput('config', configWithManifest);
    fixture.componentRef.setInput('featureRegistry', [
      {
        capabilityId: 'blogging.posts',
        featureName: 'blogging',
        load: () => Promise.resolve(TestPublishedFeatureComponent),
      },
    ]);
    fixture.componentRef.setInput('activePath', '/blog');
    fixture.detectChanges();

    await fixture.componentInstance.loadActiveFeature();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-feature-access-required]')).toBeNull();
    expect(TestPublishedFeatureComponent.receivedContext).toEqual(
      expect.objectContaining({
        access: 'public',
        permissions: ['blog.post.read'],
      })
    );
  });

  it('rejects Blogging owner placement from public navigation and direct rendering', async () => {
    const configWithOwnerPlacement = {
      ...publishedConfig,
      manifest: {
        schemaVersion: 1 as const,
        surfaceType: 'generic' as const,
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'owner-navigation',
            resourceRef: { type: 'blog-catalog', id: 'catalog-north' },
          },
        },
      },
    };
    fixture.componentRef.setInput('config', configWithOwnerPlacement);
    fixture.componentRef.setInput('activePath', '/blog');
    fixture.detectChanges();
    await fixture.componentInstance.loadActiveFeature();
    fixture.detectChanges();

    expect(
      fixture.componentInstance.navigationRoutes.some(
        (route) => route.name === 'Blog'
      )
    ).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-feature-failure]')
    ).not.toBeNull();
  });

  it('gates a published capability marked authenticated even when the route has no permissions', async () => {
    const configWithAuthenticatedSocial = {
      ...publishedConfig,
      routes: [
        {
          ...publishedConfig.routes[0],
          path: '/feed',
          name: 'Feed',
          featureName: 'social',
          componentType: 'feature' as const,
        },
      ],
      features: { social: { enabled: true } },
      manifest: {
        schemaVersion: 1 as const,
        surfaceType: 'generic' as const,
        capabilities: {
          'social.feed': { enabled: true, placement: 'client-navigation' },
        },
      },
    };
    fixture.componentRef.setInput('config', configWithAuthenticatedSocial);
    fixture.componentRef.setInput('activePath', '/feed');
    fixture.componentRef.setInput('signedIn', true);
    fixture.detectChanges();
    await fixture.componentInstance.loadActiveFeature();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-feature-access-required]')
    ).not.toBeNull();
  });
});
