import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DocsHomeComponent } from './docs-home.component';
import { DocsIndexService } from '../services/docs-index.service';
import { ApiDocsIndexService } from '../services/api-docs-index.service';

describe('DocsHomeComponent', () => {
  let fixture: ComponentFixture<DocsHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocsHomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: DocsIndexService,
          useValue: {
            getCategories: jest.fn(() =>
              of([
                {
                  id: 'operators',
                  title: 'Operators',
                  documents: [
                    {
                      slug: 'docs/operators/overview',
                      title: 'Operator Handbook',
                      summary: 'Formal operational documentation hub.',
                      sourcePath: 'docs/operators/overview.md',
                      lastUpdated: '2026-05-24T12:00:00.000Z',
                    },
                  ],
                },
              ])
            ),
            getSearchDocuments: jest.fn(() => of([])),
            getDocs: jest.fn(() =>
              of([
                {
                  slug: 'docs/operators/overview',
                  title: 'Operator Handbook',
                  summary: 'Formal operational documentation hub.',
                  sourcePath: 'docs/operators/overview.md',
                  category: 'operators',
                  tags: ['operations'],
                  kind: 'doc',
                  headings: [],
                  body: '',
                  order: 1,
                  lastUpdated: '2026-05-24T12:00:00.000Z',
                },
              ])
            ),
            getOperatorHubDocs: jest.fn(() =>
              of([
                {
                  slug: 'docs/operators/local-stack',
                  title: 'Local Stack Operations',
                  summary: 'Run the shared local environment.',
                  sourcePath: 'docs/operators/local-stack.md',
                  category: 'operators',
                  tags: ['docker'],
                  kind: 'doc',
                  headings: [],
                  body: '',
                  order: 2,
                  lastUpdated: '2026-05-24T12:00:00.000Z',
                },
              ])
            ),
            getDocBySourcePath: jest.fn(() =>
              of({
                slug: 'libs/common-ui/readme',
                title: 'Common UI',
                summary: 'Shared component library guide.',
                sourcePath: 'libs/common-ui/README.md',
                category: 'reference',
                tags: ['ui'],
                kind: 'doc',
                headings: [],
                body: '',
                order: 30,
                lastUpdated: '2026-05-24T12:00:00.000Z',
              })
            ),
            getLibraryGuideDocs: jest.fn(() =>
              of([
                {
                  slug: 'libs/common-ui/readme',
                  title: 'Common UI',
                  summary: 'Shared component library guide.',
                  sourcePath: 'libs/common-ui/README.md',
                  category: 'reference',
                  tags: ['ui'],
                  kind: 'doc',
                  headings: [],
                  body: '',
                  order: 30,
                  lastUpdated: '2026-05-24T12:00:00.000Z',
                },
              ])
            ),
            getManifest: jest.fn(() =>
              of({
                version: 1,
                generatedAt: '2026-05-25T12:00:00.000Z',
                items: [],
              })
            ),
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

    fixture = TestBed.createComponent(DocsHomeComponent);
    fixture.detectChanges();
  });

  it('renders split lanes for operators and developers', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Operator Command Deck');
    expect(root.textContent).toContain('Operate the platform');
    expect(root.textContent).toContain('Explore libraries and APIs');
    expect(root.textContent).toContain('Local Stack Operations');
    expect(root.textContent).toContain('Common UI');
    expect(root.textContent).toContain('Compodoc ready');
    expect(root.textContent).toContain('Formal operational documentation hub.');
    expect(root.textContent).toContain('Updated');
  });

  it('builds docs links without duplicating the docs path segment', () => {
    const root = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(root.querySelectorAll('a'))
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => Boolean(href));

    expect(hrefs).toContain('/docs/operators/local-stack');
    expect(hrefs).toContain('/docs/libs/common-ui/readme');
    expect(hrefs).not.toContain('/docs/docs/operators/local-stack');
  });
});
