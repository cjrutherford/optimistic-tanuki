import { Activity, publicActivity } from './learning-domain';
import { publicExercise, tutorialExercises } from './tutorial-content';

/**
 * These lock shut a leak that reached production: the catalog needs no
 * sign-in, and it was shipping every quiz's correct answers along with the
 * questions. The lesson endpoint was doing the same for exercises.
 *
 * The assertions are deliberately about absence rather than about a fixed
 * shape, so adding a harmless field to an activity does not fail them, and
 * adding a mark scheme does.
 */
describe('what a learner is allowed to see', () => {
  const lessonId = 'lesson-1';

  it('never sends the expected output of a code activity', () => {
    const activity: Activity = {
      id: 'a1',
      type: 'code.run',
      prompt: 'Print the title',
      lessonId,
      starterCode: 'package main',
      expectedOutput: 'Dune',
    };

    const seen = publicActivity(activity);

    expect(seen).not.toHaveProperty('expectedOutput');
    expect(JSON.stringify(seen)).not.toContain('Dune');
    // The question itself still has to arrive.
    expect(seen).toMatchObject({ id: 'a1', starterCode: 'package main' });
  });

  it('never sends which quiz option is correct', () => {
    const activity: Activity = {
      id: 'a2',
      type: 'quiz.mcq',
      prompt: 'Which receiver can modify the struct?',
      lessonId,
      options: [
        { id: 'value', text: 'A value receiver' },
        { id: 'pointer', text: 'A pointer receiver' },
      ],
      correctOptionIds: ['pointer'],
    };

    const seen = publicActivity(activity);

    expect(seen).not.toHaveProperty('correctOptionIds');
    // Both options still reach the learner, or there is nothing to answer.
    expect(seen).toMatchObject({ options: activity.options });
  });

  it('never sends the rubric or the sample answer of a written activity', () => {
    const activity: Activity = {
      id: 'a3',
      type: 'writing.response',
      prompt: 'Explain why a value receiver cannot mutate.',
      lessonId,
      maxWords: 200,
      sampleResponse: 'Because the receiver is a copy.',
      rubric: {
        id: 'r1',
        title: 'Receivers',
        criteria: [
          { id: 'c1', description: 'Mentions copying', maxPoints: 10 },
        ],
      },
    };

    const seen = publicActivity(activity);

    expect(seen).not.toHaveProperty('sampleResponse');
    expect(seen).not.toHaveProperty('rubric');
    expect(JSON.stringify(seen)).not.toContain(
      'Because the receiver is a copy'
    );
    expect(seen).toMatchObject({ maxWords: 200 });
  });

  it('leaves a project submission alone, because it names no answer', () => {
    const activity: Activity = {
      id: 'a4',
      type: 'project.submission',
      prompt: 'Hand in your service.',
      lessonId,
      artifactTypes: ['repo'],
    };

    expect(publicActivity(activity)).toEqual(activity);
  });

  it('never sends an exercise verifier or its expected output', () => {
    const exercise = tutorialExercises.find(
      (candidate) => candidate.id === 'go-b-21'
    );
    // If this exercise is renamed the test should be repointed, not deleted.
    expect(exercise).toBeDefined();
    expect(exercise?.expectedOutput).toBe('Dune');

    const seen = publicExercise(exercise!);

    expect(seen).not.toHaveProperty('expectedOutput');
    expect(seen).not.toHaveProperty('verifier');
    expect(seen).toMatchObject({ title: 'Declare a Struct' });
  });

  it('withholds the answer from every exercise in every course', () => {
    const leaked = tutorialExercises
      .map(publicExercise)
      .filter(
        (exercise) => 'expectedOutput' in exercise || 'verifier' in exercise
      );

    expect(leaked).toEqual([]);
  });
});
