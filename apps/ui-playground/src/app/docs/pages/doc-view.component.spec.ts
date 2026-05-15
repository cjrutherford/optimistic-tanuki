import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { of } from 'rxjs';
import { DocViewComponent } from './doc-view.component';
import { DocsIndexService } from '../services/docs-index.service';
import { MarkdownRendererService } from '../services/markdown-renderer.service';

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
            getDocBySlug: jest.fn(() =>
              of(
                doc
                  ? {
                      slug,
                      title: 'Workspace Map',
                      summary: 'High-level repo topology and navigation.',
                      sourcePath: 'docs/architecture/workspace-map.md',
                      category: 'architecture',
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
                    }
                  : null
              )
            ),
            getAdjacentDocs: jest.fn(() =>
              of({
                previous: null,
                next: {
                  slug: 'docs/getting-started/readme',
                  title: 'Getting Started',
                },
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
  });

  it('renders a not-found state for a missing document', async () => {
    const fixture = await createComponent('docs/missing', false);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Document not found');
  });
});
