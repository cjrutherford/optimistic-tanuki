import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthorComponent } from './author.component';

describe('AuthorComponent', () => {
  const course = (
    id: string,
    status: 'draft' | 'published',
    isOwner = true
  ) => ({
    offering: {
      id,
      displayName: id,
      description: '',
      subjectId: 'art',
      level: 100,
      credits: 1,
      status,
      modules: [],
    },
    trackId: id,
    trackDisplayName: id,
    lessonCount: 0,
    isOwner,
  });

  async function render(
    isCourseDesigner: boolean,
    courses: unknown[] = [],
    authorStatusFails = false
  ) {
    TestBed.configureTestingModule({
      imports: [AuthorComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(AuthorComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const status = http.expectOne('/api/learning/me/author');
    if (authorStatusFails) {
      status.flush(null, { status: 401, statusText: 'Unauthorized' });
    } else {
      status.flush({ isCourseDesigner });
    }
    http.expectOne('/api/learning/me/courses').flush(courses);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      element: fixture.nativeElement as HTMLElement,
      http,
      button: (label: string) =>
        Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button')
        ).find((candidate) => candidate.textContent?.trim() === label),
    };
  }

  describe('somebody who has not written before', () => {
    it('is invited rather than shown an empty list', async () => {
      const { element } = await render(false);

      expect(element.textContent).toContain('Anyone can write a course here');
      expect(element.textContent).not.toContain('Open a new course');
    });

    // The promise the invitation makes has to match what the server enforces.
    it('promises only what ownership actually gives', async () => {
      const { element } = await render(false);

      expect(element.textContent).toContain('unless you invite them');
      expect(element.textContent).toContain('until you publish it');
    });

    it('opts in and then offers the form', async () => {
      const { fixture, element, http, button } = await render(false);

      button('Start writing')?.click();
      http.expectOne('/api/learning/me/author/opt-in').flush({
        isCourseDesigner: true,
      });
      fixture.detectChanges();

      expect(element.textContent).toContain('Open a new course');
    });

    it('asks an anonymous visitor to sign in', async () => {
      const { fixture, element, http, button } = await render(false);

      button('Start writing')?.click();
      http
        .expectOne('/api/learning/me/author/opt-in')
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      fixture.detectChanges();

      expect(element.textContent).toContain('Sign in to write a course');
    });

    // A spinner that never resolves is worse than an honest answer.
    it('treats an unreadable status as not being an author', async () => {
      const { element } = await render(false, [], true);

      expect(element.textContent).toContain('Anyone can write a course here');
    });
  });

  describe('an author', () => {
    it('lists their own drafts, which nothing else shows them', async () => {
      const { element } = await render(true, [course('mine', 'draft')]);

      expect(element.textContent).toContain('mine');
      expect(element.querySelector('.draft')?.textContent).toContain('Draft');
    });

    it('says so when they have written nothing yet', async () => {
      const { element } = await render(true, []);

      expect(element.textContent).toContain('have not written anything yet');
    });

    it('marks a course they only co-edit', async () => {
      const { element } = await render(true, [
        course('theirs', 'draft', false),
      ]);

      expect(element.textContent).toContain('You co-edit this one');
    });

    it('does not say that about their own', async () => {
      const { element } = await render(true, [course('mine', 'draft')]);

      expect(element.textContent).not.toContain('You co-edit');
    });

    it('links a course to its editor', async () => {
      const { element } = await render(true, [course('mine', 'draft')]);

      expect(element.querySelector('a.course')?.getAttribute('href')).toBe(
        '/author/mine'
      );
    });

    it('will not open a course with no name or no subject', async () => {
      const { fixture, button } = await render(true);

      expect(button('Open it')?.disabled).toBe(true);

      fixture.componentInstance.newName.set('Intro to Watercolour');
      fixture.detectChanges();
      expect(button('Open it')?.disabled).toBe(true);
    });

    it('opens a course and goes straight to writing it', async () => {
      const { fixture, http, button } = await render(true);
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate');
      fixture.componentInstance.newName.set('Intro to Watercolour');
      fixture.componentInstance.newSubject.set('Art');
      fixture.detectChanges();

      button('Open it')?.click();
      const request = http.expectOne('/api/learning/offerings');
      // Subject ids are lowercase everywhere else, so what is typed is not
      // taken verbatim.
      expect(request.request.body).toEqual({
        displayName: 'Intro to Watercolour',
        subjectId: 'art',
      });
      request.flush({ track: { id: 'art-1' } });
      fixture.detectChanges();

      expect(navigate).toHaveBeenCalledWith(['/author', 'art-1']);
    });
  });
});
