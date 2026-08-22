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

export const publicExercise = ({
  verifier: _verifier,
  ...exercise
}: CodeExercise) => exercise;
