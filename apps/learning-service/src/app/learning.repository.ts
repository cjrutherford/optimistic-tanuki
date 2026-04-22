import { Attempt, Evaluation, ProgramTrack } from '@optimistic-tanuki/learning-domain';

export const LEARNING_REPOSITORY = Symbol('LEARNING_REPOSITORY');

export type CreateAttemptInput = Omit<Attempt, 'id' | 'state' | 'submittedAt' | 'isAsync'> & {
  isAsync?: boolean;
};

export type RecordEvaluationInput = Omit<Evaluation, 'id' | 'evaluatedAt'>;

export interface LearningRepository {
  listPrograms(): ProgramTrack[];
  createAttempt(input: Attempt): Attempt;
  getAttempt(attemptId: string): Attempt | undefined;
  saveAttempt(attempt: Attempt): Attempt;
  recordEvaluation(input: Evaluation): Evaluation;
}
