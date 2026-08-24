import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LearningLayoutComponent } from './learning-layout.component';

/**
 * The sidebar used to list every module of every track on every page, which is
 * forty entries in front of a visitor who has not chosen anything yet.
 */
describe('LearningLayoutComponent', () => {
  const dashboard = [
    {
      program: {
        id: 'go-foundations',
        displayName: 'Go',
        offerings: [
          {
            id: 'go-100',
            displayName: 'Go Foundations',
            modules: [
              { id: 'basics', title: 'Go Basics', lessons: [] },
              { id: 'concurrency', title: 'Go Concurrency', lessons: [] },
            ],
          },
        ],
      },
      totals: { lessons: 0, exercises: 0, points: 0 },
      progress: {
        completedLessons: 0,
        completedExercises: 0,
        points: 0,
        nextLessonId: null,
      },
    },
    {
      program: {
        id: 'rust-foundations',
        displayName: 'Rust',
        offerings: [
          {
            id: 'rust-100',
            displayName: 'Rust Foundations',
            modules: [
              { id: 'ownership', title: 'Rust Ownership', lessons: [] },
            ],
          },
        ],
      },
      totals: { lessons: 0, exercises: 0, points: 0 },
      progress: {
        completedLessons: 0,
        completedExercises: 0,
        points: 0,
        nextLessonId: null,
      },
    },
  ];

  async function render(trackId = '') {
    TestBed.configureTestingModule({
      imports: [LearningLayoutComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(LearningLayoutComponent);
    fixture.componentInstance.trackId = trackId;
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush(dashboard);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows no course modules until a course is chosen', async () => {
    const element = await render();

    expect(element.textContent).not.toContain('Go Basics');
    expect(element.textContent).not.toContain('Rust Ownership');
  });

  it('always offers the way back to the catalog', async () => {
    const element = await render();

    expect(element.textContent).toContain('Browse courses');
    expect(element.textContent).toContain('Your progress');
  });

  it('shows the modules of the course being read', async () => {
    const element = await render('go-foundations');

    expect(element.textContent).toContain('Go Basics');
    expect(element.textContent).toContain('Go Concurrency');
  });

  it('does not show another course alongside it', async () => {
    const element = await render('go-foundations');

    expect(element.textContent).not.toContain('Rust Ownership');
  });

  // The header said "TypeScript · Go · C++ · Rust", which announced the
  // platform as being about four programming languages.
  it('does not advertise the platform as being about four languages', async () => {
    const element = await render();
    const topbar = element.querySelector('.topbar')?.textContent ?? '';

    expect(topbar).not.toMatch(/TypeScript|C\+\+|Rust/);
  });
});
