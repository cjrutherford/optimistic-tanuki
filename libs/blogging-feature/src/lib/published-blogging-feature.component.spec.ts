import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import type { PublishedFeatureContext } from '@optimistic-tanuki/configurable-plugin-contracts';

import { PublishedBloggingFeatureComponent } from './published-blogging-feature.component';

describe('PublishedBloggingFeatureComponent', () => {
  let fixture: ComponentFixture<PublishedBloggingFeatureComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublishedBloggingFeatureComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PublishedBloggingFeatureComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders published catalog posts and only its public resource reference', () => {
    const context: PublishedFeatureContext = {
      capabilityId: 'blogging.posts',
      resourceRef: { type: 'blog-catalog', id: 'catalog-north' },
      domain: 'north.example.com',
      permissions: ['blog.post.read'],
      access: 'public',
      settings: {},
    };
    fixture.componentRef.setInput('publishedContext', context);
    fixture.detectChanges();

    const request = http.expectOne(
      '/api/blog/by-domain/north.example.com/posts'
    );
    request.flush([
      {
        id: 'post-1',
        title: 'A published note',
        content: 'Visible to clients.',
        publishedAt: '2026-09-03T00:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host
        .querySelector('[data-blog-catalog]')
        ?.getAttribute('data-blog-catalog')
    ).toBe('catalog-north');
    expect(host.textContent).toContain('A published note');
    expect(host.textContent).not.toContain('ownerUserId');
  });

  it('renders a deterministic empty state when the public adapter has no posts', () => {
    fixture.componentRef.setInput('publishedContext', {
      capabilityId: 'blogging.posts',
      resourceRef: { type: 'blog-catalog', id: 'catalog-empty' },
      domain: 'empty.example.com',
      permissions: ['blog.post.read'],
      access: 'public',
      settings: {},
    });
    fixture.detectChanges();

    const request = http.expectOne(
      '/api/blog/by-domain/empty.example.com/posts'
    );
    request.flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No published posts yet'
    );
  });
});
