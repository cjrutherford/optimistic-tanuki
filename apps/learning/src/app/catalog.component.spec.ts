import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CatalogComponent } from './catalog.component';

/**
 * The entrance is the whole point of this slice: a visitor should meet
 * subjects and courses, not a list of programming languages leading straight
 * into a module sidebar.
 */
describe('CatalogComponent', () => {
  const track = (
    id: string,
    subjectId: string,
    overrides: Record<string, unknown> = {}
  ) => ({
    id,
    displayName: id,
    subjectIds: [subjectId],
    focuses: [],
    offerings: [
      {
        id: `${id}-100`,
        displayName: `${id} Foundations`,
        description: `All about ${id}.`,
        subjectId,
        level: 100,
        credits: 3,
        status: 'published',
        modules: [
          { id: 'm', title: 'M', lessons: [{ id: 'l' }, { id: 'l2' }] },
        ],
      },
    ],
    ...overrides,
  });

  async function render(
    tracks: unknown[],
    subjects: unknown[] = [
      {
        subjectId: 'programming',
        displayName: 'Programming',
        focusNames: [],
        courseCount: 1,
      },
    ]
  ) {
    TestBed.configureTestingModule({
      imports: [CatalogComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(CatalogComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/learning/programs').flush(tracks);
    http.expectOne('/api/learning/subjects').flush(subjects);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, http };
  }

  it('shows the courses it was given', async () => {
    const { element } = await render([track('go', 'programming')]);

    expect(element.textContent).toContain('go Foundations');
    expect(element.textContent).toContain('All about go.');
  });

  it('says nothing about programming in its own copy', async () => {
    const { element } = await render([track('go', 'programming')]);
    const header = element.querySelector('header')?.textContent ?? '';

    expect(header).not.toMatch(/language|programming|typescript|rust/i);
  });

  it('counts what is actually there', async () => {
    const { element } = await render([
      track('go', 'programming'),
      track('watercolour', 'art'),
    ]);

    expect(element.textContent).toContain('2 courses');
  });

  it('offers the subjects the server named', async () => {
    const { element } = await render(
      [track('watercolour', 'art')],
      [
        {
          subjectId: 'art',
          displayName: 'Art',
          focusNames: [],
          courseCount: 1,
        },
      ]
    );

    expect(element.textContent).toContain('Art');
  });

  it('narrows to one subject when a visitor picks one', async () => {
    const { fixture, element } = await render([
      track('go', 'programming'),
      track('watercolour', 'art'),
    ]);

    fixture.componentInstance.selectedSubject.set('art');
    fixture.detectChanges();

    expect(element.textContent).toContain('watercolour Foundations');
    expect(element.textContent).not.toContain('go Foundations');
  });

  it('says a subject is empty rather than showing nothing at all', async () => {
    const { fixture, element } = await render([track('go', 'programming')]);

    fixture.componentInstance.selectedSubject.set('art');
    fixture.detectChanges();

    expect(element.textContent).toContain('No courses in this subject yet');
  });

  it('links a course to its own page, not into a module', async () => {
    const { element } = await render([track('go', 'programming')]);
    const link = element.querySelector('a.course');

    expect(link?.getAttribute('href')).toBe('/course/go-100');
  });

  it('marks a draft so an author can tell theirs apart', async () => {
    const draft = track('mine', 'art');
    draft.offerings[0].status = 'draft';
    const { element } = await render([draft]);

    expect(element.querySelector('.draft')?.textContent).toContain('Draft');
  });

  it('handles an empty catalog without pretending it has courses', async () => {
    const { element } = await render([], []);

    expect(element.textContent).toContain(
      'Nothing has been published here yet'
    );
  });
});
