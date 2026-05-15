import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocsSearchComponent } from './docs-search.component';

describe('DocsSearchComponent', () => {
  let fixture: ComponentFixture<DocsSearchComponent>;
  let component: DocsSearchComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocsSearchComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocsSearchComponent);
    component = fixture.componentInstance;
    component.documents = [
      {
        slug: 'docs/architecture/workspace-map',
        title: 'Workspace Map',
        summary: 'Repo layout and navigation',
        category: 'architecture',
        headings: [{ depth: 1, text: 'Workspace Map', id: 'workspace-map' }],
        tags: ['nx'],
      },
      {
        slug: 'docs/getting-started/readme',
        title: 'Getting Started',
        summary: 'Contributor setup guide',
        category: 'getting-started',
        headings: [
          { depth: 1, text: 'Getting Started', id: 'getting-started' },
        ],
        tags: ['setup'],
      },
    ];
    fixture.detectChanges();
  });

  it('filters docs by title, summary, headings, and tags', () => {
    component.setQuery('setup');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Getting Started');
    expect(root.textContent).not.toContain('Workspace Map');
  });
});
