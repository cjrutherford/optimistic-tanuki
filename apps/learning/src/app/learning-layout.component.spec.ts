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

  async function render(trackId = '', person: unknown = null) {
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
    for (const pending of http.match('/api/learning/me')) pending.flush(person);
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

  it('offers the shared appearance controls from the menu', async () => {
    const element = await render();
    const trigger = element.querySelector(
      'lib-theme-toggle .appearance-trigger'
    ) as HTMLButtonElement | null;

    expect(trigger).toBeTruthy();
    expect(trigger?.textContent).toContain('Appearance');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });

  // Nowhere told a visitor what enrolling, marking or authoring meant, so
  // these have to be reachable from every page, not just linked from one.
  it('links to the about and docs pages from every page', async () => {
    const element = await render();
    const topbar = element.querySelector('.topbar');
    const links = Array.from(topbar?.querySelectorAll('a') ?? []).map((a) =>
      a.getAttribute('href')
    );

    expect(links).toContain('/about');
    expect(links).toContain('/docs');
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

/**
 * The header is the only place the app says who you are, and the only way in
 * for somebody who is not signed in. It told people to sign in from three
 * other screens while offering no route to it.
 */
describe('LearningLayoutComponent session', () => {
  async function render(person: unknown) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LearningLayoutComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(LearningLayoutComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    for (const pending of http.match('/api/learning/me')) pending.flush(person);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers a way in to somebody who is not signed in', async () => {
    const element = await render(null);
    const link = Array.from(element.querySelectorAll('a')).find(
      (candidate) => candidate.textContent?.trim() === 'Sign in'
    );

    // Carries where they are, so signing in does not cost them their place.
    // Reading is open to anyone, so this is most often clicked from the
    // middle of a lesson.
    expect(link?.getAttribute('href')).toMatch(/^\/sign-in\?returnTo=/);
  });

  it('names whoever is signed in', async () => {
    const element = await render({ name: 'Ada Lovelace' });

    expect(element.querySelector('.who')?.textContent).toContain(
      'Ada Lovelace'
    );
  });

  // A course has to be attributable to somebody, so writing is offered only
  // to a person the app can name.
  it('does not offer writing to an anonymous visitor', async () => {
    const element = await render(null);

    expect(element.textContent).not.toContain('Write');
  });

  it('offers writing once somebody is signed in', async () => {
    const element = await render({ name: 'Ada Lovelace' });

    expect(element.textContent).toContain('Write');
  });

  it('offers a way out', async () => {
    const element = await render({ name: 'Ada Lovelace' });

    expect(element.textContent).toContain('Sign out');
  });
});

describe('LearningLayoutComponent menu', () => {
  async function render() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LearningLayoutComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(LearningLayoutComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    for (const pending of http.match('/api/learning/me')) pending.flush(null);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('keeps the closed drawer inert and opens it for the menu toggle', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector('.menu-toggle') as HTMLButtonElement;
    const sheet = element.querySelector('.topbar-sheet') as HTMLElement;

    expect(sheet.getAttribute('aria-hidden')).toBe('true');
    expect(sheet.hasAttribute('inert')).toBe(true);

    toggle.click();
    fixture.detectChanges();

    expect(sheet.getAttribute('aria-hidden')).toBe('false');
    expect(sheet.hasAttribute('inert')).toBe(false);
  });

  it('restores focus to the toggle when the drawer Close button closes it', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector('.menu-toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    const close = element.querySelector('.sheet-dismiss') as HTMLButtonElement;
    close.focus();
    close.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('restores focus to the toggle when Escape closes the drawer', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector('.menu-toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    const link = element.querySelector('.sheet-nav a') as HTMLAnchorElement;
    link.focus();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('does not steal focus when a navigation link closes the drawer', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector('.menu-toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    const link = element.querySelector('.sheet-nav a') as HTMLAnchorElement;
    link.focus();
    link.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(link);
  });

  it('keeps the navigation and challenges drawers mutually exclusive', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const menuToggle = element.querySelector(
      '.menu-toggle'
    ) as HTMLButtonElement;
    const challengeToggle = element.querySelector(
      '.challenge-toggle'
    ) as HTMLButtonElement;

    menuToggle.click();
    fixture.detectChanges();
    expect(menuToggle.getAttribute('aria-expanded')).toBe('true');

    challengeToggle.click();
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/learning/challenges')
      .flush({
        challenges: [],
        enrolledCount: 0,
        trackDisplayName: '',
      });
    fixture.detectChanges();

    expect(menuToggle.getAttribute('aria-expanded')).toBe('false');
    expect(challengeToggle.getAttribute('aria-expanded')).toBe('true');
  });
});
