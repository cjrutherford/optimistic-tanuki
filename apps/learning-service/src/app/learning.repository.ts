import {
  Activity,
  Attempt,
  DraftOfferingInput,
  Enrolment,
  Evaluation,
  LessonProgress,
  ModuleMetadata,
  OfferingOwnership,
  ProgramTrack,
  PublicationStatus,
} from '@optimistic-tanuki/learning-domain';

export const LEARNING_REPOSITORY = Symbol('LEARNING_REPOSITORY');

export interface OfferingContentPatch {
  displayName?: string;
  description?: string;
  /**
   * The course's structure, replaced wholesale rather than patched lesson by
   * lesson. An author works on an outline as a whole, and a whole-document
   * write has no ordering or partial-failure questions to answer.
   */
  modules?: ModuleMetadata[];
  activities?: Activity[];
  status?: PublicationStatus;
}

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
  createOffering(
    ownerProfileId: string,
    offeringId: string,
    input: DraftOfferingInput
  ):
    | Promise<{ track: ProgramTrack; ownership: OfferingOwnership }>
    | { track: ProgramTrack; ownership: OfferingOwnership };
  updateOfferingContent(
    offeringId: string,
    patch: OfferingContentPatch
  ): Promise<ProgramTrack> | ProgramTrack;
  deleteOffering(offeringId: string): Promise<void> | void;
  getOwnership(
    offeringId: string
  ): Promise<OfferingOwnership | undefined> | OfferingOwnership | undefined;
  /** Every offering this profile owns or co-edits. */
  listOwnerships(
    profileId: string
  ): Promise<OfferingOwnership[]> | OfferingOwnership[];
  setCoEditors(
    offeringId: string,
    coEditorProfileIds: string[]
  ): Promise<OfferingOwnership> | OfferingOwnership;
}
