import {
  Attempt,
  Enrolment,
  Evaluation,
  LessonProgress,
  ProgramTrack,
} from '@optimistic-tanuki/learning-domain';

export const LEARNING_REPOSITORY = Symbol('LEARNING_REPOSITORY');

export type CreateAttemptInput = Omit<
  Attempt,
  'id' | 'state' | 'submittedAt' | 'isAsync'
> & {
  isAsync?: boolean;
};

export type RecordEvaluationInput = Omit<Evaluation, 'id' | 'evaluatedAt'>;

export interface LearningRepository {
  listPrograms(): Promise<ProgramTrack[]> | ProgramTrack[];
  createAttempt(input: Attempt): Promise<Attempt> | Attempt;
  getAttempt(
    attemptId: string
  ): Promise<Attempt | undefined> | Attempt | undefined;
  saveAttempt(attempt: Attempt): Promise<Attempt> | Attempt;
  recordEvaluation(input: Evaluation): Promise<Evaluation> | Evaluation;
  getProgress(profileId: string): Promise<LessonProgress[]> | LessonProgress[];
  saveProgress(
    profileId: string,
    userId: string,
    enrolmentId: string,
    progress: Omit<LessonProgress, 'updatedAt'>
  ): Promise<LessonProgress> | LessonProgress;
  enrol(profileId: string, offeringId: string): Promise<Enrolment> | Enrolment;
  withdraw(
    profileId: string,
    offeringId: string
  ): Promise<Enrolment> | Enrolment;
  listEnrolments(profileId: string): Promise<Enrolment[]> | Enrolment[];
  getEnrolment(
    profileId: string,
    offeringId: string
  ): Promise<Enrolment | undefined> | Enrolment | undefined;
}
