import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GradingService } from './grading.service';

/**
 * A grader that marks nothing. Marking is covered in learning-domain, where
 * it is pure; nothing here should reach for a model.
 */
const gradingStub = () => ({ gradeWriting: jest.fn(async () => undefined) });
import { LearningRepository, LEARNING_REPOSITORY } from './learning.repository';
import {
  Attempt,
  buildDraftProgramTrack,
  DraftOfferingInput,
  Enrolment,
  Evaluation,
  LessonProgress,
  OfferingOwnership,
  ProgramTrack,
  sampleProgramTracks,
} from '@optimistic-tanuki/learning-domain';
import { OfferingContentPatch } from './learning.repository';
import { randomUUID } from 'crypto';

@Injectable()
class InMemoryLearningRepository implements LearningRepository {
  private readonly programs: ProgramTrack[] = sampleProgramTracks;
  private readonly attempts = new Map<string, Attempt>();
  private readonly evaluations = new Map<string, Evaluation>();
  private readonly progress = new Map<
    string,
    LessonProgress & { userId: string; profileId: string }
  >();
  private readonly enrolments = new Map<string, Enrolment>();
  private readonly ownerships = new Map<string, OfferingOwnership>();

  listPrograms() {
    return this.programs;
  }
  createAttempt(input: Attempt) {
    this.attempts.set(input.id, input);
    return input;
  }
  getAttempt(attemptId: string) {
    return this.attempts.get(attemptId);
  }
  saveAttempt(attempt: Attempt) {
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }
  recordEvaluation(input: Evaluation) {
    this.evaluations.set(input.id, input);
    return input;
  }
  getProgress(profileId: string) {
    return [...this.progress.values()].filter(
      (item) => item.profileId === profileId
    );
  }
  saveProgress(
    profileId: string,
    userId: string,
    enrolmentId: string,
    input: Omit<LessonProgress, 'updatedAt'>
  ) {
    const value = {
      ...input,
      userId,
      profileId,
      updatedAt: new Date().toISOString(),
    } as LessonProgress & { userId: string; profileId: string };
    this.progress.set(`${profileId}:${input.lessonId}`, value);
    return value;
  }
  /**
   * The same merge the SQL does, so the tests exercise the real semantics:
   * union the exercise, add its points only the first time.
   */
  recordSolvedExercise(
    profileId: string,
    userId: string,
    enrolmentId: string,
    lessonId: string,
    exercise: { id: string; points: number }
  ) {
    const key = `${profileId}:${lessonId}`;
    const existing = this.progress.get(key);
    const already =
      existing?.completedExerciseIds.includes(exercise.id) ?? false;
    const value = {
      lessonId,
      completed: existing?.completed ?? false,
      completedExerciseIds: already
        ? existing?.completedExerciseIds ?? []
        : [...(existing?.completedExerciseIds ?? []), exercise.id],
      points: (existing?.points ?? 0) + (already ? 0 : exercise.points),
      userId,
      profileId,
      updatedAt: new Date().toISOString(),
    } as LessonProgress & { userId: string; profileId: string };
    this.progress.set(key, value);
    return value;
  }
  enrol(profileId: string, offeringId: string) {
    const key = `${profileId}:${offeringId}`;
    const enrolment: Enrolment = {
      id: randomUUID(),
      profileId,
      offeringId,
      status: 'active',
      enrolledAt: new Date().toISOString(),
    };
    this.enrolments.set(key, enrolment);
    return enrolment;
  }
  withdraw(profileId: string, offeringId: string) {
    const key = `${profileId}:${offeringId}`;
    const existing = this.enrolments.get(key);
    if (!existing) {
      throw new Error(
        `Profile ${profileId} is not enrolled in offering ${offeringId}`
      );
    }
    const withdrawn: Enrolment = {
      ...existing,
      status: 'withdrawn',
      withdrawnAt: new Date().toISOString(),
    };
    this.enrolments.set(key, withdrawn);
    return withdrawn;
  }
  listEnrolments(profileId: string) {
    return [...this.enrolments.values()].filter(
      (item) => item.profileId === profileId
    );
  }
  getEnrolment(profileId: string, offeringId: string) {
    return this.enrolments.get(`${profileId}:${offeringId}`);
  }
  createOffering(
    ownerProfileId: string,
    offeringId: string,
    input: DraftOfferingInput
  ) {
    const track = buildDraftProgramTrack(offeringId, input);
    this.programs.push(track);
    const ownership: OfferingOwnership = {
      offeringId,
      ownerProfileId,
      coEditorProfileIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.ownerships.set(offeringId, ownership);
    return { track, ownership };
  }
  updateOfferingContent(offeringId: string, patch: OfferingContentPatch) {
    const index = this.programs.findIndex((track) => track.id === offeringId);
    if (index === -1) throw new Error(`Unknown offering: ${offeringId}`);
    const track = this.programs[index];
    const updated: ProgramTrack = {
      ...track,
      ...(patch.displayName !== undefined
        ? { displayName: patch.displayName }
        : {}),
      offerings: track.offerings.map((offering) =>
        offering.id === offeringId
          ? {
              ...offering,
              ...(patch.displayName !== undefined
                ? { displayName: patch.displayName }
                : {}),
              ...(patch.description !== undefined
                ? { description: patch.description }
                : {}),
            }
          : offering
      ),
    };
    this.programs[index] = updated;
    return updated;
  }
  deleteOffering(offeringId: string) {
    const index = this.programs.findIndex((track) => track.id === offeringId);
    if (index !== -1) this.programs.splice(index, 1);
    this.ownerships.delete(offeringId);
  }
  getOwnership(offeringId: string) {
    return this.ownerships.get(offeringId);
  }
  listOwnerships(profileId: string) {
    return [...this.ownerships.values()].filter(
      (ownership) =>
        ownership.ownerProfileId === profileId ||
        ownership.coEditorProfileIds.includes(profileId)
    );
  }
  setCoEditors(offeringId: string, coEditorProfileIds: string[]) {
    const existing = this.ownerships.get(offeringId);
    if (!existing) throw new Error(`No ownership for offering: ${offeringId}`);
    const updated = { ...existing, coEditorProfileIds };
    this.ownerships.set(offeringId, updated);
    return updated;
  }
}

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: GradingService, useValue: gradingStub() },
        { provide: GradingService, useValue: gradingStub() },
        InMemoryLearningRepository,
        {
          provide: LEARNING_REPOSITORY,
          useExisting: InMemoryLearningRepository,
        },
      ],
    }).compile();

    appController = moduleRef.get(AppController);
  });

  it('lists programs with requirement graphs', async () => {
    const programs = await appController.listPrograms();
    expect(programs.length).toBeGreaterThan(0);
    expect(programs[0].requirements.children.length).toBeGreaterThan(0);
  });

  it('submits an async attempt', async () => {
    const attempt = await appController.submitAttempt({
      userId: 'user-1',
      offeringId: 'systems-200-elective-testing',
      activityId: 'systems-200-writing',
      activityType: 'writing.response',
      submission: { response: 'My answer' },
    });

    expect(attempt.state).toBe('submitted');
    expect(attempt.isAsync).toBe(true);
  });

  it('records an evaluation result', async () => {
    const attempt = await appController.submitAttempt({
      userId: 'user-1',
      offeringId: 'systems-200-elective-testing',
      activityId: 'systems-200-writing',
      activityType: 'writing.response',
      submission: { response: 'My answer' },
    });

    const evaluation = await appController.recordEvaluation({
      attemptId: attempt.id,
      mode: 'async',
      grader: 'llm',
      score: 8,
      maxScore: 10,
      feedback: 'Solid rationale',
      humanOverride: false,
    });

    expect(evaluation.attemptId).toBe(attempt.id);
    expect(evaluation.mode).toBe('async');
  });
});
