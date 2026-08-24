import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { OfferingComponent } from './offering.component';

describe('OfferingComponent', () => {
  const detail = (overrides: Record<string, unknown> = {}) => ({
    offering: {
      id: 'go-100',
      displayName: 'Go Foundations',
      description: 'From hello world to concurrency.',
      subjectId: 'programming',
      level: 100,
      credits: 3,
      status: 'published',
      modules: [
        {
          id: 'basics',
          title: 'Basics',
          lessons: [{ id: 'l1' }, { id: 'l2' }],
        },
      ],
    },
    trackId: 'go-foundations',
    trackDisplayName: 'Go',
    lessonCount: 2,
    prerequisites: [],
    author: { profileId: 'p1', displayName: 'Ada' },
    isEnrolled: false,
    ...overrides,
  });

  async function render(response: unknown) {
    TestBed.configureTestingModule({
      imports: [OfferingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ offeringId: 'go-100' })),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(OfferingComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/learning/offerings/go-100').flush(response);
    // The layout asks for the dashboard to build its sidebar.
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, http };
  }

  it('says what the course is, who wrote it, and what it costs', async () => {
    const { element } = await render(detail());

    expect(element.textContent).toContain('Go Foundations');
    expect(element.textContent).toContain('From hello world to concurrency');
    expect(element.textContent).toContain('Ada');
    expect(element.textContent).toContain('3');
  });

  it('lists what is in the course before it is opened', async () => {
    const { element } = await render(detail());

    expect(element.textContent).toContain('What is in it');
    expect(element.textContent).toContain('Basics');
  });

  it('links a module straight into the reading', async () => {
    const { element } = await render(detail());
    const link = element.querySelector('.outline a');

    expect(link?.getAttribute('href')).toBe('/module/go-foundations/basics');
  });

  it('offers enrolment before any work is attempted', async () => {
    const { element } = await render(detail());

    expect(element.textContent).toContain('Enrol');
  });

  it('sends the enrolment and then says so', async () => {
    const { fixture, element, http } = await render(detail());

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.trim().startsWith('Enrol'))
      ?.click();
    const request = http.expectOne('/api/learning/enrolments');
    expect(request.request.body).toEqual({ offeringId: 'go-100' });
    request.flush({ offeringId: 'go-100' });
    fixture.detectChanges();

    expect(element.textContent).toContain('You are enrolled');
  });

  // Not "something went wrong": signing in is the actual next step.
  it('asks an anonymous visitor to sign in rather than reporting a failure', async () => {
    const { fixture, element, http } = await render(detail());

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.trim().startsWith('Enrol'))
      ?.click();
    http
      .expectOne('/api/learning/enrolments')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(element.textContent).toContain('Sign in to enrol');
  });

  it('recognises somebody already enrolled', async () => {
    const { element } = await render(detail({ isEnrolled: true }));

    expect(element.textContent).toContain('You are enrolled');
  });

  it('opens the first module when asked to start reading', async () => {
    const { fixture, element } = await render(detail());
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate');

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Start reading'))
      ?.click();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith([
      '/module',
      'go-foundations',
      'basics',
    ]);
  });

  // A draft course opened by its author has no modules yet, and offering to
  // open it would go nowhere.
  it('does not offer to open a course with nothing in it', async () => {
    const empty = detail();
    empty.offering.modules = [];
    empty.lessonCount = 0;
    const { element } = await render(empty);

    expect(element.textContent).not.toContain('Start reading');
    expect(element.textContent).not.toContain('What is in it');
  });
});
