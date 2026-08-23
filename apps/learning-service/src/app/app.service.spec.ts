import { Injectable } from '@nestjs/common';
import { AppService } from './app.service';
import { LEARNING_REPOSITORY, LearningRepository } from './learning.repository';
import { Test } from '@nestjs/testing';
import {
  Attempt,
  Evaluation,
  LessonProgress,
  ProgramTrack,
  sampleProgramTracks,
} from '@optimistic-tanuki/learning-domain';

@Injectable()
class InMemoryLearningRepository implements LearningRepository {
  private readonly programs: ProgramTrack[] = sampleProgramTracks;
  private readonly attempts = new Map<string, Attempt>();
  private readonly evaluations = new Map<string, Evaluation>();
  private readonly progress = new Map<
    string,
    LessonProgress & { userId: string }
  >();

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
  getProgress(userId: string) {
    return [...this.progress.values()].filter((item) => item.userId === userId);
  }
  saveProgress(userId: string, input: Omit<LessonProgress, 'updatedAt'>) {
    const value = {
      ...input,
      userId,
      updatedAt: new Date().toISOString(),
    } as LessonProgress & { userId: string };
    this.progress.set(`${userId}:${input.lessonId}`, value);
    return value;
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

    async function completed(lessonIds: string[]) {
      for (const lessonId of lessonIds) {
        await service.saveProgress('learner', {
          lessonId,
          completed: true,
          completedExerciseIds: [],
          points: 0,
        });
      }
      const dashboard = await service.getDashboard('learner');
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
});
