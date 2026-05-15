import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { DocsIndexService } from './docs-index.service';
import { DocsManifest } from '../models/docs.models';

describe('DocsIndexService', () => {
  let service: DocsIndexService;
  let httpMock: HttpTestingController;

  const manifest: DocsManifest = {
    version: 1,
    generatedAt: '2026-05-14T00:00:00.000Z',
    items: [
      {
        slug: 'docs/architecture/workspace-map',
        title: 'Workspace Map',
        summary: 'High-level repo topology and navigation.',
        sourcePath: 'docs/architecture/workspace-map.md',
        category: 'architecture',
        tags: ['nx'],
        kind: 'doc',
        headings: [{ depth: 1, text: 'Workspace Map', id: 'workspace-map' }],
        body: '# Workspace Map\n\nRepo layout.',
        order: 20,
      },
      {
        slug: 'docs/getting-started/readme',
        title: 'Getting Started',
        summary: 'Contributor workflow.',
        sourcePath: 'docs/getting-started/README.md',
        category: 'getting-started',
        tags: ['setup'],
        kind: 'doc',
        headings: [
          { depth: 1, text: 'Getting Started', id: 'getting-started' },
        ],
        body: '# Getting Started\n\nBring the stack up.',
        order: 10,
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(DocsIndexService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads and caches the generated docs manifest', async () => {
    const firstLoad = firstValueFrom(service.getManifest());
    const secondLoad = firstValueFrom(service.getManifest());

    const request = httpMock.expectOne('/generated/docs-manifest.json');
    expect(request.request.method).toBe('GET');
    request.flush(manifest);

    await expect(firstLoad).resolves.toEqual(manifest);
    await expect(secondLoad).resolves.toEqual(manifest);
  });

  it('resolves a document by slug and sorts categories by configured order', async () => {
    const docsPromise = firstValueFrom(service.getDocs());
    const categoriesPromise = firstValueFrom(service.getCategories());

    httpMock.expectOne('/generated/docs-manifest.json').flush(manifest);

    await expect(docsPromise).resolves.toHaveLength(2);
    await expect(
      firstValueFrom(service.getDocBySlug('docs/architecture/workspace-map'))
    ).resolves.toEqual(expect.objectContaining({ title: 'Workspace Map' }));
    await expect(categoriesPromise).resolves.toEqual([
      expect.objectContaining({ id: 'getting-started' }),
      expect.objectContaining({ id: 'architecture' }),
    ]);
  });
});
