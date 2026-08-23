import { Injectable } from '@nestjs/common';
import { AppService } from './app.service';
import { LEARNING_REPOSITORY, LearningRepository } from './learning.repository';
import { Test } from '@nestjs/testing';
import {
  Attempt,
  Enrolment,
  Evaluation,
  LessonProgress,
  ProgramTrack,
  sampleProgramTracks,
  tutorialExercises,
} from '@optimistic-tanuki/learning-domain';
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
  enrol(profileId: string, offeringId: string) {
    const key = `${profileId}:${offeringId}`;
    const existing = this.enrolments.get(key);
    if (existing) {
      const reactivated: Enrolment = { ...existing, status: 'active' };
      delete reactivated.withdrawnAt;
      this.enrolments.set(key, reactivated);
      return reactivated;
    }
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
}

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        InMemoryLearningRepository,
        {
          provide: LEARNING_REPOSITORY,
          useExisting: InMemoryLearningRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(AppService);
  });

  it('returns seeded programs', async () => {
    const programs = await service.listPrograms();
    expect(programs.map((program) => program.supportedLanguageIds[0])).toEqual(
      expect.arrayContaining(['go', 'typescript', 'cpp', 'rust'])
    );
  });

  it('records evaluation results for submitted attempts', async () => {
    const attempt = await service.submitAttempt({
      userId: 'user-2',
      offeringId: 'systems-100-core',
      activityId: 'systems-100-code-activity',
      activityType: 'code.run',
      submission: { stdout: 'ok' },
      isAsync: false,
    });

    const evaluation = await service.recordEvaluation({
      attemptId: attempt.id,
      mode: 'sync',
      grader: 'auto',
      score: 7,
      maxScore: 10,
      feedback: 'Passed',
      humanOverride: false,
    });

    expect(evaluation.attemptId).toBe(attempt.id);
    expect(evaluation.grader).toBe('auto');
  });

  // Go's basics split four topics into an overview plus three detail lessons.
  // Working through the parts should close the overview too, rather than
  // leaving the learner to tick the same material twice.
  describe('sub-lesson roll-up', () => {
    const parts = [
      'go-foundations-basics-basic-types',
      'go-foundations-basics-type-conversion',
      'go-foundations-basics-custom-types',
    ];
    const overview = 'go-foundations-basics-variables-types';

    const profileId = 'profile-learner';

    async function completed(lessonIds: string[]) {
      await service.enrol(profileId, 'go-foundations-100-core');
      for (const lessonId of lessonIds) {
        await service.saveProgress(profileId, 'learner', {
          lessonId,
          completed: true,
          completedExerciseIds: [],
          points: 0,
        });
      }
      const dashboard = await service.getDashboard(profileId);
      return dashboard.find((entry) => entry.program.id === 'go-foundations')!;
    }

    it('does not close the overview while a part is outstanding', async () => {
      const go = await completed(parts.slice(0, 2));
      expect(go.progress.completedLessons).toBe(2);
    });

    it('closes the overview once every part is done', async () => {
      const go = await completed(parts);
      // Three parts plus the overview they add up to.
      expect(go.progress.completedLessons).toBe(4);
    });

    it('does not offer the overview as the next lesson once it is covered', async () => {
      const go = await completed(parts);
      expect(go.progress.nextLessonId).not.toBe(overview);
    });
  });

  // A learner must never be able to grade themselves. Knowing who wrote a
  // score is what makes that checkable after the fact, so the gateway sends
  // the acting user and it has to survive the trip.
  describe('evaluation audit trail', () => {
    it('keeps the user who recorded the score', async () => {
      const attempt = await service.submitAttempt({
        userId: 'learner-1',
        offeringId: 'systems-100-core',
        activityId: 'systems-100-code-activity',
        activityType: 'code.run',
        submission: { stdout: 'ok' },
        isAsync: false,
      });

      const evaluation = await service.recordEvaluation({
        attemptId: attempt.id,
        mode: 'sync',
        grader: 'human',
        score: 9,
        maxScore: 10,
        feedback: 'Close enough',
        humanOverride: true,
        recordedByUserId: 'grader-7',
      });

      expect(evaluation.recordedByUserId).toBe('grader-7');
    });

    it('accepts an evaluation with no recorded user, for rows that predate it', async () => {
      const attempt = await service.submitAttempt({
        userId: 'learner-2',
        offeringId: 'systems-100-core',
        activityId: 'systems-100-code-activity',
        activityType: 'code.run',
        submission: { stdout: 'ok' },
        isAsync: false,
      });

      const evaluation = await service.recordEvaluation({
        attemptId: attempt.id,
        mode: 'sync',
        grader: 'auto',
        score: 10,
        maxScore: 10,
        feedback: 'Passed',
        humanOverride: false,
      });

      expect(evaluation.recordedByUserId).toBeUndefined();
    });
  });

  // Enrolment is the fact that someone is taking an offering. Progress must
  // not be recordable without it, or a lessonId is all it takes to forge
  // completion for a course nobody signed up for.
  describe('enrolment gates progress', () => {
    it('refuses to save progress for a profile with no enrolment', async () => {
      await expect(
        service.saveProgress('profile-unenrolled', 'user-1', {
          lessonId: 'go-foundations-basics-variables-types',
          completed: true,
          completedExerciseIds: [],
          points: 0,
        })
      ).rejects.toThrow(/enrolled/);
    });

    it('saves progress once the profile is enrolled in the owning offering', async () => {
      await service.enrol('profile-enrolled', 'go-foundations-100-core');

      const progress = await service.saveProgress(
        'profile-enrolled',
        'user-1',
        {
          lessonId: 'go-foundations-basics-variables-types',
          completed: true,
          completedExerciseIds: [],
          points: 0,
        }
      );

      expect(progress.lessonId).toBe('go-foundations-basics-variables-types');
    });

    it('stops progress after withdrawal', async () => {
      await service.enrol('profile-withdrawn', 'go-foundations-100-core');
      await service.withdraw('profile-withdrawn', 'go-foundations-100-core');

      await expect(
        service.saveProgress('profile-withdrawn', 'user-1', {
          lessonId: 'go-foundations-basics-variables-types',
          completed: true,
          completedExerciseIds: [],
          points: 0,
        })
      ).rejects.toThrow(/enrolled/);
    });

    it("lists only a profile's own enrolments", async () => {
      await service.enrol('profile-a', 'go-foundations-100-core');
      await service.enrol('profile-b', 'go-foundations-100-core');

      const enrolments = await service.listEnrolments('profile-a');
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0].profileId).toBe('profile-a');
    });
  });

  // Submitting an exercise is how someone starts a course. If that required
  // an enrol call first, the Submit button would simply fail for every new
  // learner, which is exactly what happened when enrolment landed.
  describe('enrolling by starting work', () => {
    // The runner is a separate service over HTTP. What is under test here is
    // the enrolment side effect, not the sandbox, so the run is stubbed.
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          output: '',
          errors: [],
          timedOut: false,
          testsPassed: true,
        }),
      }) as unknown as typeof fetch;
    });

    afterEach(() => {
      (global.fetch as unknown as jest.Mock | undefined)?.mockRestore?.();
    });

    it('enrols a learner on their first submission', async () => {
      const exercise = tutorialExercises.find(
        (candidate) => candidate.languageId === 'go'
      )!;

      const before = await service.listEnrolments('profile-new');
      expect(before).toEqual([]);

      await service.submitExercise(
        'profile-new',
        'user-new',
        exercise.id,
        exercise.starterCode
      );

      const after = await service.listEnrolments('profile-new');
      expect(after).toHaveLength(1);
      expect(after[0].status).toBe('active');
    });

    it('does not enrol a second time on a later submission', async () => {
      const exercise = tutorialExercises.find(
        (candidate) => candidate.languageId === 'go'
      )!;

      await service.submitExercise(
        'profile-twice',
        'user-twice',
        exercise.id,
        ''
      );
      await service.submitExercise(
        'profile-twice',
        'user-twice',
        exercise.id,
        ''
      );

      expect(await service.listEnrolments('profile-twice')).toHaveLength(1);
    });
  });
});
