import { Attempt, Evaluation, ProgramTrack } from '@optimistic-tanuki/learning-domain';

export const LEARNING_REPOSITORY = Symbol('LEARNING_REPOSITORY');

export type CreateAttemptInput = Omit<Attempt, 'id' | 'state' | 'submittedAt' | 'isAsync'> & {
  isAsync?: boolean;
};

export type RecordEvaluationInput = Omit<Evaluation, 'id' | 'evaluatedAt'>;

export interface LearningRepository {
  listPrograms(): Promise<ProgramTrack[]> | ProgramTrack[];
  createAttempt(input: Attempt): Promise<Attempt> | Attempt;
  getAttempt(attemptId: string): Promise<Attempt | undefined> | Attempt | undefined;
  saveAttempt(attempt: Attempt): Promise<Attempt> | Attempt;
  recordEvaluation(input: Evaluation): Promise<Evaluation> | Evaluation;
}
