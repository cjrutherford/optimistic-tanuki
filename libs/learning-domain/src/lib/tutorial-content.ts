import { CodeExercise, CodeExerciseSchema } from './learning-domain';
import { challenges as typescriptChallenges } from '../content/letsgots/challenges.source';
import { challenges as goChallenges } from '../content/letsgogo/challenges.source';
import { challenges as cppChallenges } from '../content/letsgocpp/challenges.source';
import { challenges as rustChallenges } from '../content/letsgorust/challenges.source';

type ImportedChallenge = {
  id: string;
  lessonSlug: string;
  title: string;
  description: string;
  starterCode: string;
  hints: string[];
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  testCode?: string;
  expectedOutput?: string;
  validationPattern?: string;
  supportingFiles?: Record<string, string>;
};

const normalize = (
  languageId: CodeExercise['languageId'],
  challenges: ImportedChallenge[]
): CodeExercise[] =>
  challenges.map((challenge) =>
    CodeExerciseSchema.parse({
      ...challenge,
      id: `${languageId}-${challenge.id}`,
      languageId,
      verifier: {
        testCode: challenge.testCode,
        validationPattern: challenge.validationPattern,
      },
    })
  );

export const tutorialExercises: CodeExercise[] = [
  ...normalize('typescript', typescriptChallenges),
  ...normalize('go', goChallenges),
  ...normalize('cpp', cppChallenges),
  ...normalize('rust', rustChallenges),
];

/**
 * An exercise as a learner may see it.
 *
 * `verifier` was already withheld. `expectedOutput` sat one field above it and
 * was not, so the answer travelled to the browser with the question: an
 * exercise asking you to declare a struct and print its title also told you
 * the title was "Dune", and printing that string passed it. Both are grading
 * criteria and neither is sent.
 *
 * Marking is unaffected. Every read of `expectedOutput` on the grading path
 * goes through the full record on the server, never through this projection.
 */
export const publicExercise = ({
  verifier: _verifier,
  expectedOutput: _expectedOutput,
  ...exercise
}: CodeExercise) => exercise;
