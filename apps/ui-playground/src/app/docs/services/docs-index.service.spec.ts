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
        slug: 'docs/operators/overview',
        title: 'Operator Handbook',
        summary: 'Formal operational documentation hub.',
        sourcePath: 'docs/operators/overview.md',
        category: 'operators',
        audience: 'operator',
        section: 'operators',
        tags: ['operations'],
        kind: 'doc',
        headings: [
          { depth: 1, text: 'Operator Handbook', id: 'operator-handbook' },
        ],
        body: '# Operator Handbook\n\nOverview.',
        order: 1,
        docRole: 'landing',
        landing: true,
        featured: true,
      },
      {
        slug: 'docs/operators/local-stack',
        title: 'Local Stack Operations',
        summary: 'Run the shared local environment.',
        sourcePath: 'docs/operators/local-stack.md',
        category: 'operators',
        audience: 'operator',
        section: 'operators',
        parent: 'docs/operators/overview',
        tags: ['docker'],
        kind: 'doc',
        headings: [
          {
            depth: 1,
            text: 'Local Stack Operations',
            id: 'local-stack-operations',
          },
        ],
        body: '# Local Stack Operations\n\nCommands.',
        order: 2,
        docRole: 'guide',
      },
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

    await expect(docsPromise).resolves.toHaveLength(4);
    await expect(
      firstValueFrom(service.getDocBySlug('docs/architecture/workspace-map'))
    ).resolves.toEqual(expect.objectContaining({ title: 'Workspace Map' }));
    await expect(categoriesPromise).resolves.toEqual([
      expect.objectContaining({ id: 'operators' }),
      expect.objectContaining({ id: 'getting-started' }),
      expect.objectContaining({ id: 'architecture' }),
    ]);
  });

  it('resolves docs slugs with or without the leading docs segment', async () => {
    const workspaceMapPromise = firstValueFrom(
      service.getDocBySlug('architecture/workspace-map')
    );

    httpMock.expectOne('/generated/docs-manifest.json').flush(manifest);

    await expect(workspaceMapPromise).resolves.toEqual(
      expect.objectContaining({ slug: 'docs/architecture/workspace-map' })
    );
  });

  it('returns operator hub documents and section-local adjacency', async () => {
    const operatorHubPromise = firstValueFrom(service.getOperatorHubDocs());
    const adjacentPromise = firstValueFrom(
      service.getAdjacentDocs('docs/operators/local-stack')
    );

    httpMock.expectOne('/generated/docs-manifest.json').flush(manifest);

    await expect(operatorHubPromise).resolves.toEqual([
      expect.objectContaining({ slug: 'docs/operators/overview' }),
      expect.objectContaining({ slug: 'docs/operators/local-stack' }),
    ]);
    await expect(adjacentPromise).resolves.toEqual({
      previous: expect.objectContaining({ slug: 'docs/operators/overview' }),
      next: null,
    });
  });
});
