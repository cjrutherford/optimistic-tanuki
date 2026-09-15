import { GoExecutionModeSchema } from './learning-domain';
import { challenges as goChallenges } from '../content/letsgogo/challenges.source';
import { publicExercise, tutorialExercises } from './tutorial-content';

describe('Go exercise execution metadata', () => {
  it('keeps t-01 learner-owned and free of a duplicate verifier test', () => {
    const source = goChallenges.find((challenge) => challenge.id === 't-01');
    const exercise = tutorialExercises.find(
      (candidate) => candidate.id === 'go-t-01'
    );

    expect(source).toBeDefined();
    expect(exercise).toBeDefined();
    expect(source?.executionMode).toBe('test');
    expect(source?.testCode).toBeUndefined();
    expect(source?.starterCode.match(/\bfunc TestAdd\b/g)).toHaveLength(1);
    expect(exercise?.verifier.testCode).toBeUndefined();
    expect(exercise?.verifier.executionMode).toBe('test');
  });

  it('marks no-main table tests as Go tests', () => {
    const source = goChallenges.find((challenge) => challenge.id === 't-02');
    const exercise = tutorialExercises.find(
      (candidate) => candidate.id === 'go-t-02'
    );

    expect(source?.executionMode).toBe('test');
    expect(source?.starterCode).not.toContain('func main');
    expect(exercise?.verifier.executionMode).toBe('test');
  });

  it('marks benchmarks explicitly and leaves ordinary programs on run', () => {
    const benchmark = goChallenges.find((challenge) => challenge.id === 't-03');
    const ordinary = tutorialExercises.find(
      (challenge) => challenge.id === 'go-tsg-02'
    );

    expect(benchmark?.executionMode).toBe('benchmark');
    expect(benchmark?.starterCode).toContain('func BenchmarkAdd');
    expect(ordinary?.verifier.executionMode).toBe('run');
  });

  it('keeps execution metadata server-side with the verifier', () => {
    const exercise = tutorialExercises.find(
      (candidate) => candidate.id === 'go-t-03'
    )!;
    const publicVersion = publicExercise(exercise);

    expect(publicVersion).not.toHaveProperty('verifier');
    expect(JSON.stringify(publicVersion)).not.toContain('"executionMode"');
  });

  it('accepts only the type-safe Go execution modes', () => {
    expect(GoExecutionModeSchema.safeParse('run').success).toBe(true);
    expect(GoExecutionModeSchema.safeParse('test').success).toBe(true);
    expect(GoExecutionModeSchema.safeParse('benchmark').success).toBe(true);
    expect(GoExecutionModeSchema.safeParse('go test').success).toBe(false);
  });
});
