import { Injectable } from '@nestjs/common';
import { AppService } from './app.service';
import { LEARNING_REPOSITORY, LearningRepository } from './learning.repository';
import { Test } from '@nestjs/testing';
import {
  Attempt,
  Evaluation,
  ProgramTrack,
  sampleProgramTrack,
} from '@optimistic-tanuki/learning-domain';

@Injectable()
class InMemoryLearningRepository implements LearningRepository {
  private readonly programs: ProgramTrack[] = [sampleProgramTrack];
  private readonly attempts = new Map<string, Attempt>();
  private readonly evaluations = new Map<string, Evaluation>();

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
    expect(programs[0].supportedLanguageIds).toEqual(
      expect.arrayContaining(['go', 'typescript'])
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
});
