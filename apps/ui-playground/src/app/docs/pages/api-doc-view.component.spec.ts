import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ApiDocViewComponent } from './api-doc-view.component';
import { ApiDocsIndexService } from '../services/api-docs-index.service';
import { DocsIndexService } from '../services/docs-index.service';

describe('ApiDocViewComponent', () => {
  async function createComponent(available = true) {
    await TestBed.configureTestingModule({
      imports: [ApiDocViewComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ library: 'common-ui' })),
          },
        },
        {
          provide: ApiDocsIndexService,
          useValue: {
            getBySlug: jest.fn(() =>
              of({
                slug: 'common-ui',
                name: 'Common UI',
                packageName: '@optimistic-tanuki/common-ui',
                summary: 'Shared Angular primitives.',
                sourceRoot: 'libs/common-ui/src/lib/common-ui',
                readmePath: 'libs/common-ui/README.md',
                outputPath:
                  'apps/ui-playground/public/generated/compodoc/common-ui',
                url: '/generated/compodoc/common-ui/index.html',
                available,
                generatedAt: '2026-05-25T12:00:00.000Z',
              })
            ),
          },
        },
        {
          provide: DocsIndexService,
          useValue: {
            getDocBySourcePath: jest.fn(() =>
              of({
                slug: 'libs/common-ui/readme',
                title: 'Common UI Guide',
                summary: 'Library guide.',
                sourcePath: 'libs/common-ui/README.md',
                category: 'reference',
                tags: ['ui'],
                kind: 'doc',
                headings: [],
                body: '',
                relatedPackages: ['common-ui'],
                lastUpdated: '2026-05-24T12:00:00.000Z',
              })
            ),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ApiDocViewComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders an embedded compodoc frame when docs are available', async () => {
    const fixture = await createComponent(true);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Common UI');
    expect(root.textContent).toContain('Read library guide');
    expect(root.textContent).toContain('Updated');
    expect(root.querySelector('iframe')?.getAttribute('src')).toContain(
      '/generated/compodoc/common-ui/index.html'
    );
  });

  it('renders a fallback state when compodoc output is unavailable', async () => {
    const fixture = await createComponent(false);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('API docs are not generated yet');
  });
});
