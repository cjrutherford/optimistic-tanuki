import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LearningRepository, LEARNING_REPOSITORY } from './learning.repository';
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

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
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
