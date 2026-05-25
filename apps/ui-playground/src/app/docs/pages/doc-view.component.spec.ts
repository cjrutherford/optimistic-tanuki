import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { of } from 'rxjs';
import { DocViewComponent } from './doc-view.component';
import { DocsIndexService } from '../services/docs-index.service';
import { MarkdownRendererService } from '../services/markdown-renderer.service';
import { ApiDocsIndexService } from '../services/api-docs-index.service';

describe('DocViewComponent', () => {
  async function createComponent(
    slug: string,
    doc = true
  ): Promise<ComponentFixture<DocViewComponent>> {
    await TestBed.configureTestingModule({
      imports: [DocViewComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ slug })),
          },
        },
        {
          provide: DocsIndexService,
          useValue: {
            getDocBySlug: jest.fn((requestedSlug: string) => {
              if (!doc) {
                return of(null);
              }

              if (requestedSlug === 'docs/operators/overview') {
                return of({
                  slug: 'docs/operators/overview',
                  title: 'Operator Handbook',
                  summary: 'Formal operational documentation hub.',
                  sourcePath: 'docs/operators/overview.md',
                  category: 'operators',
                  section: 'operators',
                  tags: ['operations'],
                  kind: 'doc',
                  headings: [],
                  body: '# Operator Handbook',
                  order: 1,
                  docRole: 'landing',
                  lastUpdated: '2026-05-24T12:00:00.000Z',
                });
              }

              return of({
                slug,
                title: 'Workspace Map',
                summary: 'High-level repo topology and navigation.',
                sourcePath: 'docs/architecture/workspace-map.md',
                category: 'architecture',
                section: 'operators',
                parent: 'docs/operators/overview',
                tags: ['nx'],
                kind: 'doc',
                headings: [
                  {
                    depth: 1,
                    text: 'Workspace Map',
                    id: 'workspace-map',
                  },
                ],
                body: '# Workspace Map\n\nSee [Getting Started](../getting-started/README.md).',
                order: 20,
                docRole: 'guide',
                relatedPackages: ['common-ui'],
                lastUpdated: '2026-05-25T12:00:00.000Z',
              });
            }),
            getAdjacentDocs: jest.fn(() =>
              of({
                previous: null,
                next: {
                  slug: 'docs/getting-started/readme',
                  title: 'Getting Started',
                  category: 'operators',
                },
              })
            ),
            getSectionDocs: jest.fn(() =>
              of([
                {
                  slug: 'docs/operators/runbooks',
                  title: 'Runbooks',
                  summary: 'Operational procedures.',
                  sourcePath: 'docs/operators/runbooks.md',
                  category: 'operators',
                  section: 'operators',
                  tags: ['runbooks'],
                  kind: 'doc',
                  headings: [],
                  body: '# Runbooks',
                  order: 4,
                  docRole: 'runbook',
                  lastUpdated: '2026-05-24T12:00:00.000Z',
                },
              ])
            ),
            getManifest: jest.fn(() =>
              of({
                version: 1,
                generatedAt: '2026-05-25T13:00:00.000Z',
                items: [],
              })
            ),
          },
        },
        {
          provide: MarkdownRendererService,
          useValue: {
            render: jest.fn(() => ({
              html: TestBed.inject(DomSanitizer).bypassSecurityTrustHtml(
                '<h1 id="workspace-map">Workspace Map</h1><p>Rendered body.</p>'
              ),
              toc: [{ depth: 1, text: 'Workspace Map', id: 'workspace-map' }],
              outboundLinks: [],
              embeddedBlocks: [],
            })),
          },
        },
        {
          provide: ApiDocsIndexService,
          useValue: {
            getIndex: jest.fn(() =>
              of([
                {
                  slug: 'common-ui',
                  name: 'Common UI',
                  packageName: '@optimistic-tanuki/common-ui',
                  summary: 'Shared Angular primitives.',
                  sourceRoot: 'libs/common-ui/src/lib/common-ui',
                  readmePath: 'libs/common-ui/README.md',
                  outputPath:
                    'apps/ui-playground/public/generated/compodoc/common-ui',
                  url: '/generated/compodoc/common-ui/index.html',
                  available: true,
                  generatedAt: '2026-05-25T12:00:00.000Z',
                },
              ])
            ),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DocViewComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a document title and source path', async () => {
    const fixture = await createComponent('docs/architecture/workspace-map');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Workspace Map');
    expect(root.textContent).toContain('docs/architecture/workspace-map.md');
    expect(root.textContent).toContain('Rendered body.');
    expect(root.textContent).toContain('operators');
    expect(root.textContent).toContain('Operator Handbook');
    expect(root.textContent).toContain('Runbooks');
    expect(root.textContent).toContain('Updated');
    expect(root.textContent).toContain('Common UI API');
  });

  it('builds section links without duplicating the docs path segment', async () => {
    const fixture = await createComponent('docs/architecture/workspace-map');
    const root = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(root.querySelectorAll('a'))
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => Boolean(href));

    expect(hrefs).toContain('/docs/operators/overview');
    expect(hrefs).toContain('/docs/operators/runbooks');
    expect(hrefs).toContain('/docs/getting-started/readme');
    expect(hrefs).not.toContain('/docs/docs/operators/overview');
  });

  it('renders a not-found state for a missing document', async () => {
    const fixture = await createComponent('docs/missing', false);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Document not found');
  });
});
