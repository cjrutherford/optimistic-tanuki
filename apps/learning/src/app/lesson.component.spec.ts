import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LessonComponent } from './lesson.component';
import {
  Exercise,
  LearningDataService,
  LessonProgress,
  NotEnrolledError,
  NotSignedInError,
  SubmitResult,
} from './learning-data.service';
import { LearningAuthService } from './learning-auth.service';

const exercise: Exercise = {
  id: 'go-b-01',
  languageId: 'go',
  title: 'Hello, Go',
  description: 'Print a greeting.',
  starterCode: 'package main',
  hints: ['Use fmt.Println'],
  points: 10,
  difficulty: 'easy',
};

const submitResult: SubmitResult = {
  output: 'Hello, Go!',
  errors: [],
  passed: true,
  awardedPoints: 10,
  progress: {
    lessonId: 'b-01',
    completed: false,
    completedExerciseIds: ['go-b-01'],
    points: 10,
  },
};

function setup(
  overrides: Partial<Record<keyof LearningDataService, unknown>> = {}
) {
  const progress: LessonProgress[] = [];
  const data = {
    lesson: jest.fn(() =>
      of({
        lesson: { id: 'b-01', title: 'Hello', slug: 'hello-world' },
        content: '# Hello',
        exercises: [exercise],
      })
    ),
    myProgress: jest.fn(() => of(progress)),
    run: jest.fn(() => of({ output: 'ran', errors: [] })),
    submit: jest.fn(() => of(submitResult)),
    // The nested layout renders its own nav from this.
    dashboard: jest.fn(() => of([])),
    enrol: jest.fn(() => of({ offeringId: 'go-foundations-100-core' })),
    ...overrides,
  };

  TestBed.configureTestingModule({
    imports: [LessonComponent],
    providers: [
      { provide: LearningDataService, useValue: data },
      // The layout asks who is signed in so it can render the header. Stubbed
      // rather than given an HttpClient, because none of these tests are
      // about the session.
      {
        provide: LearningAuthService,
        useValue: { me: () => of(null), logout: () => of(null) },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({
              trackId: 'go-foundations',
              moduleId: 'basics',
              lessonId: 'b-01',
            }),
          },
          paramMap: of(
            convertToParamMap({
              trackId: 'go-foundations',
              moduleId: 'basics',
              lessonId: 'b-01',
            })
          ),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(LessonComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance as never, data };
}

/** Reaches the protected handlers the template binds to. */
type Handlers = {
  run(exercise: Exercise): void;
  submit(exercise: Exercise): void;
  revealHint(exercise: Exercise): void;
  enrolThenRetry(exercise: Exercise, offeringId: string): void;
  enrolling: Record<string, boolean>;
  enrolError: Record<string, string>;
  onCodeChange(exercise: Exercise, next: string): void;
  resetCode(exercise: Exercise): void;
  isEdited(exercise: Exercise): boolean;
  code: Record<string, string>;
  diagnostics: Record<
    string,
    { line: number; column: number; message: string }[]
  >;
  revealedHints(exercise: Exercise): string[];
  hasMoreHints(exercise: Exercise): boolean;
  remainingHints(exercise: Exercise): number;
  results: Record<
    string,
    {
      output: string;
      errors: string[];
      passed?: boolean;
      awardedPoints?: number;
      needsSignIn?: boolean;
      needsSignInFor?: 'run' | 'submit';
    }
  >;
  busy: Record<string, boolean>;
};

describe('LessonComponent', () => {
  it('runs code without claiming a verdict', () => {
    const { component, data } = setup();
    const page = component as Handlers;

    page.run(exercise);

    expect(data.run).toHaveBeenCalledWith('go-b-01', 'package main');
    expect(page.results['go-b-01'].output).toBe('ran');
    expect(page.results['go-b-01'].passed).toBeUndefined();
    expect(page.busy['go-b-01']).toBe(false);
  });

  it('records a passing submit with the points it awarded', () => {
    const { component, data } = setup();
    const page = component as Handlers;

    page.submit(exercise);

    expect(data.submit).toHaveBeenCalledWith('go-b-01', 'package main');
    expect(page.results['go-b-01'].passed).toBe(true);
    expect(page.results['go-b-01'].awardedPoints).toBe(10);
  });

  it('re-reads progress after a pass so the solved badge appears', () => {
    const { component, data } = setup();
    const page = component as Handlers;

    const before = data.myProgress.mock.calls.length;
    page.submit(exercise);

    expect(data.myProgress.mock.calls.length).toBeGreaterThan(before);
  });

  it('does not re-read progress when the answer was wrong', () => {
    const { component, data } = setup({
      submit: jest.fn(() =>
        of({ ...submitResult, passed: false, awardedPoints: 0 })
      ),
    });
    const page = component as Handlers;

    const before = data.myProgress.mock.calls.length;
    page.submit(exercise);

    expect(data.myProgress.mock.calls.length).toBe(before);
  });

  it('asks an anonymous visitor to sign in instead of showing an error', () => {
    const { component } = setup({
      submit: jest.fn(() => throwError(() => new NotSignedInError())),
    });
    const page = component as Handlers;

    page.submit(exercise);

    expect(page.results['go-b-01'].needsSignIn).toBe(true);
    expect(page.results['go-b-01'].needsSignInFor).toBe('submit');
    expect(page.results['go-b-01'].errors).toEqual([]);
    expect(page.busy['go-b-01']).toBe(false);
  });

  it('asks an anonymous visitor to sign in to run code, not just to save', () => {
    const { component } = setup({
      run: jest.fn(() => throwError(() => new NotSignedInError())),
    });
    const page = component as Handlers;

    page.run(exercise);

    expect(page.results['go-b-01'].needsSignIn).toBe(true);
    expect(page.results['go-b-01'].needsSignInFor).toBe('run');
    expect(page.results['go-b-01'].errors).toEqual([]);
    expect(page.busy['go-b-01']).toBe(false);
  });

  describe('hints', () => {
    const threeHints: Exercise = {
      ...exercise,
      hints: ['Start with fmt', 'Println adds a newline', 'Check the spelling'],
    };

    it('gives nothing away until the learner asks', () => {
      const { component } = setup();
      const page = component as Handlers;

      expect(page.revealedHints(threeHints)).toEqual([]);
      expect(page.remainingHints(threeHints)).toBe(3);
    });

    it('reveals one hint at a time, in order', () => {
      const { component } = setup();
      const page = component as Handlers;

      page.revealHint(threeHints);
      expect(page.revealedHints(threeHints)).toEqual(['Start with fmt']);

      page.revealHint(threeHints);
      expect(page.revealedHints(threeHints)).toEqual([
        'Start with fmt',
        'Println adds a newline',
      ]);
      expect(page.remainingHints(threeHints)).toBe(1);
    });

    it('stops offering more once every hint is out', () => {
      const { component } = setup();
      const page = component as Handlers;

      page.revealHint(threeHints);
      page.revealHint(threeHints);
      page.revealHint(threeHints);

      expect(page.hasMoreHints(threeHints)).toBe(false);
      expect(page.remainingHints(threeHints)).toBe(0);

      // A further click cannot walk past the end.
      page.revealHint(threeHints);
      expect(page.revealedHints(threeHints)).toHaveLength(3);
    });

    it('tracks each exercise separately', () => {
      const { component } = setup();
      const page = component as Handlers;
      const other: Exercise = { ...threeHints, id: 'go-b-02' };

      page.revealHint(threeHints);

      expect(page.revealedHints(threeHints)).toHaveLength(1);
      expect(page.revealedHints(other)).toHaveLength(0);
    });
  });

  describe('drafts', () => {
    beforeEach(() => localStorage.clear());

    it('starts an untouched exercise from the starter code', () => {
      const { component } = setup();
      const page = component as Handlers;

      expect(page.code['go-b-01']).toBe('package main');
      expect(page.isEdited(exercise)).toBe(false);
    });

    it('keeps an edit so it survives leaving the page', () => {
      const first = setup();
      (first.component as Handlers).onCodeChange(exercise, 'edited code');

      // A fresh mount, as if the learner navigated away and came back.
      TestBed.resetTestingModule();
      const second = setup();

      expect((second.component as Handlers).code['go-b-01']).toBe(
        'edited code'
      );
    });

    it('treats code back at the starter as no draft at all', () => {
      const { component } = setup();
      const page = component as Handlers;

      page.onCodeChange(exercise, 'edited code');
      page.onCodeChange(exercise, exercise.starterCode);

      expect(page.isEdited(exercise)).toBe(false);
      expect(localStorage.length).toBe(0);
    });

    it('puts the starter back on reset and forgets the draft', () => {
      const { component } = setup();
      const page = component as Handlers;

      page.onCodeChange(exercise, 'edited code');
      page.resetCode(exercise);

      expect(page.code['go-b-01']).toBe('package main');
      expect(localStorage.length).toBe(0);
    });
  });

  describe('compiler markers', () => {
    it('positions the errors a run reported', () => {
      const { component } = setup({
        run: jest.fn(() =>
          of({ output: '', errors: ['./main.go:6:2: undefined: foo'] })
        ),
      });
      const page = component as Handlers;

      page.run(exercise);

      expect(page.diagnostics['go-b-01']).toEqual([
        { line: 6, column: 2, message: 'undefined: foo', severity: 'error' },
      ]);
    });

    it('clears markers once the code compiles', () => {
      const { component } = setup();
      const page = component as Handlers;

      page.run(exercise);

      expect(page.diagnostics['go-b-01']).toEqual([]);
    });

    it('clears markers on reset', () => {
      const { component } = setup({
        run: jest.fn(() =>
          of({ output: '', errors: ['./main.go:6:2: undefined: foo'] })
        ),
      });
      const page = component as Handlers;

      page.run(exercise);
      page.resetCode(exercise);

      expect(page.diagnostics['go-b-01']).toEqual([]);
    });
  });

  it('surfaces a real failure as an error message', () => {
    const { component } = setup({
      submit: jest.fn(() => throwError(() => new Error('runner unreachable'))),
    });
    const page = component as Handlers;

    page.submit(exercise);

    expect(page.results['go-b-01'].errors).toEqual(['runner unreachable']);
    expect(page.results['go-b-01'].needsSignIn).toBeUndefined();
  });

  // Enrolment is explicit, so a learner who has not enrolled is asked rather
  // than told it failed. Having asked, they should not have to press Submit a
  // second time for a decision they just made.
  describe('enrolment', () => {
    const refuse = () =>
      jest.fn(() =>
        throwError(() => new NotEnrolledError('go-foundations-100-core'))
      );

    it('asks the learner to enrol instead of reporting a failure', () => {
      const { component } = setup({ submit: refuse() });
      const page = component as Handlers;

      page.submit(exercise);

      expect(page.results['go-b-01'].needsEnrolmentIn).toBe(
        'go-foundations-100-core'
      );
      expect(page.results['go-b-01'].errors).toEqual([]);
    });

    it('enrols and then submits the work they already asked to submit', () => {
      const { component, data } = setup({ submit: refuse() });
      const page = component as Handlers;

      page.submit(exercise);
      page.enrolThenRetry(exercise, 'go-foundations-100-core');

      expect(data.enrol).toHaveBeenCalledWith('go-foundations-100-core');
      expect(data.submit).toHaveBeenCalledTimes(2);
    });

    it('ignores a second click while the first enrolment is in flight', () => {
      const { component, data } = setup({
        submit: refuse(),
        enrol: jest.fn(() => new Subject()),
      });
      const page = component as Handlers;

      page.submit(exercise);
      page.enrolThenRetry(exercise, 'go-foundations-100-core');
      page.enrolThenRetry(exercise, 'go-foundations-100-core');

      expect(data.enrol).toHaveBeenCalledTimes(1);
    });

    it('keeps the invitation on screen when enrolling fails', () => {
      const { component } = setup({
        submit: refuse(),
        enrol: jest.fn(() =>
          throwError(() => new Error('Enrolment is closed'))
        ),
      });
      const page = component as Handlers;

      page.submit(exercise);
      page.enrolThenRetry(exercise, 'go-foundations-100-core');

      expect(page.enrolError['go-foundations-100-core']).toBe(
        'Enrolment is closed'
      );
      expect(page.enrolling['go-foundations-100-core']).toBe(false);
      expect(page.results['go-b-01'].needsEnrolmentIn).toBe(
        'go-foundations-100-core'
      );
    });
  });
});

/**
 * A course with no code in it could be enrolled in and read but never
 * progressed through, because the client never called the save-progress route
 * at all. Found by reading an authored course end to end in a browser.
 */
describe('LessonComponent marking a lesson read', () => {
  it('records the lesson against the learner', async () => {
    const markLesson = jest.fn(() => of({} as LessonProgress));
    const { fixture } = setup({ markLesson });

    fixture.componentInstance['markRead'](
      { lesson: { lesson: { id: 'b-01' } } },
      true
    );

    expect(markLesson).toHaveBeenCalledWith('b-01', true);
  });

  /**
   * A learner says they read it. They do not get to say what that was worth.
   * Points and solved exercises used to be sent from here and written
   * verbatim, so anyone could award themselves any score by editing one
   * request; the server carries forward what it recorded instead.
   */
  it('sends no score, whatever the page happens to be holding', async () => {
    const markLesson = jest.fn(() => of({} as LessonProgress));
    const { fixture } = setup({ markLesson });

    fixture.componentInstance['markRead'](
      {
        lesson: { lesson: { id: 'b-01' } },
        recorded: {
          lessonId: 'b-01',
          completed: false,
          completedExerciseIds: ['ex-1'],
          points: 10,
        },
      },
      true
    );

    expect(markLesson).toHaveBeenCalledWith('b-01', true);
  });

  it('lets a learner take it back', async () => {
    const markLesson = jest.fn(() => of({} as LessonProgress));
    const { fixture } = setup({ markLesson });

    fixture.componentInstance['markRead'](
      { lesson: { lesson: { id: 'b-01' } } },
      false
    );

    expect(markLesson).toHaveBeenCalledWith('b-01', false);
  });

  it('asks an anonymous visitor to sign in', async () => {
    const markLesson = jest.fn(() => throwError(() => new NotSignedInError()));
    const { fixture } = setup({ markLesson });

    fixture.componentInstance['markRead'](
      { lesson: { lesson: { id: 'b-01' } } },
      true
    );

    expect(fixture.componentInstance['markError']).toContain('Sign in');
  });

  it('asks somebody who has not enrolled to enrol', async () => {
    const markLesson = jest.fn(() =>
      throwError(() => new NotEnrolledError('go-foundations-100-core'))
    );
    const { fixture } = setup({ markLesson });

    fixture.componentInstance['markRead'](
      { lesson: { lesson: { id: 'b-01' } } },
      true
    );

    expect(fixture.componentInstance['markError']).toContain('Enrol');
  });
});
