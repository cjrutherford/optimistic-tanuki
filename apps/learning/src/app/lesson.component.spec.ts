import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LessonComponent } from './lesson.component';
import {
  Exercise,
  LearningDataService,
  LessonProgress,
  NotSignedInError,
  SubmitResult,
} from './learning-data.service';

const exercise: Exercise = {
  id: 'go-b-01',
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
    ...overrides,
  };

  TestBed.configureTestingModule({
    imports: [LessonComponent],
    providers: [
      { provide: LearningDataService, useValue: data },
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
  results: Record<
    string,
    {
      output: string;
      errors: string[];
      passed?: boolean;
      awardedPoints?: number;
      needsSignIn?: boolean;
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
    expect(page.results['go-b-01'].errors).toEqual([]);
    expect(page.busy['go-b-01']).toBe(false);
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
});
