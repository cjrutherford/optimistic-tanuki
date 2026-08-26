import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { LandingComponent } from './landing.component';
import { LearningDataService } from './learning-data.service';
import { LearningAuthService } from './learning-auth.service';

/**
 * The landing page's job is to make an argument and then get out of the way,
 * so these check what it says and where its buttons go, not how it looks.
 */
describe('LandingComponent', () => {
  const track = (overrides: Record<string, unknown> = {}) => ({
    id: 'track-1',
    displayName: 'Go',
    subjectIds: ['programming'],
    focuses: [],
    offerings: [
      {
        id: 'go-100',
        displayName: 'Go Foundations',
        description: 'A description nobody reads on a landing page.',
        audience: 'Developers being asked to work in Go.',
        outcome: 'Write and review idiomatic Go.',
        subjectId: 'programming',
        level: 100,
        credits: 3,
        status: 'published',
        modules: [
          {
            id: 'basics',
            title: 'Basics',
            lessons: [
              { id: 'l1', slug: 'hello', title: 'Hello World', content: [] },
              { id: 'l2', slug: 'vars', title: 'Variables', content: [] },
            ],
          },
        ],
        ...(overrides['offering'] as object),
      },
    ],
    ...overrides,
  });

  function build(options: {
    tracks?: unknown[];
    subjects?: unknown[];
    signedIn?: boolean;
  }) {
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        {
          provide: LearningDataService,
          useValue: {
            catalog: () => of(options.tracks ?? [track()]),
            subjects: () =>
              of(
                options.subjects ?? [
                  {
                    subjectId: 'programming',
                    displayName: 'Programming',
                    courseCount: 1,
                  },
                ]
              ),
          },
        },
        {
          provide: LearningAuthService,
          useValue: {
            me: () => of(options.signedIn ? { name: 'Sam' } : null),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('makes an argument before showing a list', () => {
    const text = build({}).nativeElement.textContent as string;

    expect(text).toContain('Get better at the work you actually do');
    // The promise that matters most to somebody deciding whether to bother.
    expect(text).toContain('readable without an account');
  });

  it('shows a real lesson from the catalog rather than an invented one', () => {
    const text = build({}).nativeElement.textContent as string;

    expect(text).toContain('Go Foundations');
    expect(text).toContain('Hello World');
  });

  it('shows each course by who it is for', () => {
    const text = build({}).nativeElement.textContent as string;

    expect(text).toContain('Developers being asked to work in Go.');
  });

  it('counts only what is published', () => {
    const draft = track({
      offering: { status: 'draft' },
    });
    const text = build({ tracks: [draft] }).nativeElement.textContent as string;

    expect(text).not.toContain('Go Foundations');
  });

  it('says something useful when there is nothing to show', () => {
    const text = build({ tracks: [], subjects: [] }).nativeElement
      .textContent as string;

    expect(text).toContain('No courses have been published yet');
  });

  it('sends a browsing visitor to the catalog, not back to itself', () => {
    const fixture = build({});
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl');

    fixture.componentInstance.browse();

    expect(navigate).toHaveBeenCalledWith('/courses');
  });

  it('sends a signed-out would-be author to sign in first', () => {
    // Sending them to /author would show them a page that refuses them.
    const fixture = build({ signedIn: false });
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl');

    fixture.componentInstance.write();

    expect(navigate).toHaveBeenCalledWith('/sign-in');
  });

  it('sends a signed-in author straight to authoring', () => {
    const fixture = build({ signedIn: true });
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl');

    fixture.componentInstance.write();

    expect(navigate).toHaveBeenCalledWith('/author');
  });

  /**
   * The doubles above stand in for real services, and a double with a method
   * the real service does not have will pass every test above while the
   * production build fails. That happened twice while this page was written:
   * `programs()` and `person$` were both invented here and mocked here, and
   * only `nx build` noticed. These assert the doubles match.
   */
  it('mocks methods the real services actually have', () => {
    expect(typeof LearningDataService.prototype.catalog).toBe('function');
    expect(typeof LearningDataService.prototype.subjects).toBe('function');
    expect(typeof LearningAuthService.prototype.me).toBe('function');
  });
});
