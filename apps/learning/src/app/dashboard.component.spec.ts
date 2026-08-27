import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard.component';

/**
 * The server counted completed lessons all along and the dashboard never
 * showed them, so finishing a course with no exercises in it looked exactly
 * like never having opened it. Found by reading an authored course through in
 * a browser.
 */
describe('DashboardComponent', () => {
  const entry = (
    displayName: string,
    totals: { lessons: number; exercises: number; points: number },
    progress: Partial<{
      completedLessons: number;
      completedExercises: number;
      points: number;
      nextLessonId: string | null;
    }> = {}
  ) => ({
    program: {
      id: displayName,
      displayName,
      offerings: [{ id: `${displayName}-100`, displayName, modules: [] }],
    },
    totals,
    progress: {
      completedLessons: 0,
      completedExercises: 0,
      points: 0,
      nextLessonId: null,
      ...progress,
    },
  });

  async function render(entries: unknown[]) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    for (const pending of http.match('/api/learning/me')) pending.flush(null);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush(entries);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('reports lessons read', async () => {
    const element = await render([
      entry(
        'Reading Tide Tables',
        { lessons: 2, exercises: 0, points: 0 },
        { completedLessons: 2 }
      ),
    ]);

    expect(element.textContent).toContain('2 read');
  });

  // "0 practice exercises" on every course about anything other than code is
  // noise, and reads as though something is missing.
  it('says nothing about exercises for a course that has none', async () => {
    const element = await render([
      entry('Reading Tide Tables', { lessons: 2, exercises: 0, points: 0 }),
    ]);

    expect(element.textContent).toContain('2 lessons');
    expect(element.textContent).not.toContain('practice exercises');
  });

  it('still reports exercises for a course that has them', async () => {
    const element = await render([
      entry(
        'Go',
        { lessons: 47, exercises: 63, points: 630 },
        { completedExercises: 1, points: 10 }
      ),
    ]);

    expect(element.textContent).toContain('63 practice exercises');
    expect(element.textContent).toContain('1 solved');
  });

  it('invites somebody who has not started to open a course', async () => {
    const element = await render([
      entry(
        'Go',
        { lessons: 47, exercises: 63, points: 630 },
        {
          nextLessonId: 'l1',
        }
      ),
    ]);

    expect(element.textContent).toContain('Open');
    expect(element.textContent).not.toContain('Continue');
  });

  it('invites somebody part way through to continue', async () => {
    const element = await render([
      entry(
        'Go',
        { lessons: 47, exercises: 63, points: 630 },
        {
          completedLessons: 3,
          nextLessonId: 'l4',
        }
      ),
    ]);

    expect(element.textContent).toContain('Continue');
  });

  // A finished course should say so rather than inviting somebody back in as
  // though they had never been.
  it('marks a course that has been read to the end', async () => {
    const element = await render([
      entry(
        'Reading Tide Tables',
        { lessons: 2, exercises: 0, points: 0 },
        { completedLessons: 2, nextLessonId: null }
      ),
    ]);

    expect(element.textContent).toContain('Read again');
  });

  it('does not claim an empty course has been read', async () => {
    const element = await render([
      entry('Empty', { lessons: 0, exercises: 0, points: 0 }),
    ]);

    expect(element.textContent).toContain('Open');
    expect(element.textContent).not.toContain('Read again');
  });
});
