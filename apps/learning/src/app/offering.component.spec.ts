import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
import { OfferingComponent } from './offering.component';
import { LearningAuthService } from './learning-auth.service';

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

  async function render(response: unknown, signedIn: boolean | null = false) {
    TestBed.configureTestingModule({
      imports: [OfferingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LearningAuthService,
          useValue: {
            me: () => of(signedIn ? { name: 'Ada' } : null),
            logout: () => of(null),
          },
        },
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

  /**
   * A wrong or unpublished id used to sit on "Loading course" forever. The
   * request had already come back 404; nothing was watching for it, so the
   * page could not tell "still asking" from "asked and there is none".
   */
  it('says there is no course rather than loading forever', async () => {
    TestBed.configureTestingModule({
      imports: [OfferingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ offeringId: 'nope' })),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(OfferingComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne('/api/learning/offerings/nope')
      .flush('missing', { status: 404, statusText: 'Not Found' });
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No course here');
    expect(text).not.toContain('Loading course');
  });

  it('explains a course service failure instead of calling it missing', async () => {
    TestBed.configureTestingModule({
      imports: [OfferingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LearningAuthService,
          useValue: { me: () => of(null), logout: () => of(null) },
        },
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
    http
      .expectOne('/api/learning/offerings/go-100')
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Course data could not load'
    );
  });

  it('says what the course is, who wrote it, and what it costs', async () => {
    const { element } = await render(detail());

    expect(element.textContent).toContain('Go Foundations');
    expect(element.textContent).toContain('From hello world to concurrency');
    expect(element.textContent).toContain('Ada');
    expect(element.textContent).toContain('3');
  });

  it('lists what is in the course before it is opened', async () => {
    const { element } = await render(detail());

    expect(element.textContent).toContain('Curriculum');
    expect(element.textContent).toContain('Basics');
  });

  it('links a module straight into the reading', async () => {
    const { element } = await render(detail());
    const link = element.querySelector('.outline a');

    expect(link?.getAttribute('href')).toBe(
      '/module/go-foundations/basics?offeringId=go-100'
    );
  });

  it('offers enrolment before any work is attempted', async () => {
    const { element } = await render(detail());

    expect(element.textContent).toContain('Sign in to enrol');
  });

  it('sends the enrolment for a signed-in learner and then says so', async () => {
    const { fixture, element, http } = await render(detail(), true);

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Enrol now'))
      ?.click();
    const request = http.expectOne('/api/learning/enrolments');
    expect(request.request.body).toEqual({ offeringId: 'go-100' });
    request.flush({ offeringId: 'go-100' });
    fixture.detectChanges();

    expect(element.textContent).toContain('You are enrolled');
  });

  it('sends an anonymous visitor directly to sign-in with this course as returnTo', async () => {
    const { element } = await render(detail());
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate');

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Sign in to enrol'))
      ?.click();

    expect(navigate).toHaveBeenCalledWith(['/sign-in'], {
      queryParams: { returnTo: '/course/go-100' },
    });
  });

  it('redirects to sign-in when a session expires during enrolment', async () => {
    const { element, http } = await render(detail(), true);
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate');

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Enrol now'))
      ?.click();
    http
      .expectOne('/api/learning/enrolments')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).toHaveBeenCalledWith(['/sign-in'], {
      queryParams: { returnTo: '/course/go-100' },
    });
  });

  it('keeps a conflict explicit without retrying enrolment', async () => {
    const { fixture, element, http } = await render(detail(), true);

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Enrol now'))
      ?.click();
    http
      .expectOne('/api/learning/enrolments')
      .flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(element.textContent).toContain('already enrolled');
    expect(element.textContent).toContain('Refresh');
  });

  it('does not let a late enrolment response cross a reused offering route', () => {
    const routeParams = new Subject<ReturnType<typeof convertToParamMap>>();
    const first = detail();
    const second = detail({
      offering: {
        ...first.offering,
        id: 'go-200',
        displayName: 'Go Advanced',
      },
    });

    TestBed.configureTestingModule({
      imports: [OfferingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LearningAuthService,
          useValue: { me: () => of({ name: 'Ada' }), logout: () => of(null) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ offeringId: 'go-100' }) },
            paramMap: routeParams.asObservable(),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(OfferingComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    routeParams.next(convertToParamMap({ offeringId: 'go-100' }));
    http.expectOne('/api/learning/offerings/go-100').flush(first);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();

    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    )
      .find((button) => button.textContent?.includes('Enrol now'))
      ?.click();
    const enrolment = http.expectOne('/api/learning/enrolments');

    routeParams.next(convertToParamMap({ offeringId: 'go-200' }));
    http.expectOne('/api/learning/offerings/go-200').flush(second);
    for (const pending of http.match('/api/learning/dashboard')) {
      pending.flush([]);
    }
    fixture.detectChanges();

    enrolment.flush({ offeringId: 'go-100' });
    fixture.detectChanges();

    expect((fixture.componentInstance as OfferingComponent).enrolled()).toBe(
      false
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'You are enrolled'
    );
  });

  it('surfaces a server enrolment failure next to the action', async () => {
    const { fixture, element, http } = await render(detail(), true);

    Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Enrol now'))
      ?.click();
    http.expectOne('/api/learning/enrolments').flush('Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    fixture.detectChanges();

    expect(element.textContent).toContain('Enrolment failed');
  });

  it('recognises somebody already enrolled', async () => {
    const { element } = await render(detail({ isEnrolled: true }));

    expect(element.textContent).toContain('You are enrolled');
  });

  it('opens the first module when asked to start reading', async () => {
    const { fixture, element } = await render(
      detail({ isEnrolled: true }),
      true
    );
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate');

    Array.from(element.querySelectorAll('button'))
      .find((button) =>
        button.textContent?.includes('Continue to the first lesson')
      )
      ?.click();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(
      ['/module', 'go-foundations', 'basics'],
      {
        queryParams: { offeringId: 'go-100' },
      }
    );
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
    expect(element.textContent).toContain('Curriculum in progress');
  });

  it('numbers modules and links directly to lessons', async () => {
    const { element } = await render(detail());

    expect(element.textContent).toContain('01');
    expect(element.textContent).toContain('02');
    expect(
      element.querySelector(
        'a[href="/module/go-foundations/basics/l1?offeringId=go-100"]'
      )
    ).not.toBeNull();
  });
});
