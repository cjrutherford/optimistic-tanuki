import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService, InMemoryLearningRepository } from './app.service';
import { LEARNING_REPOSITORY } from './learning.repository';

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

  it('lists programs with requirement graphs', () => {
    const programs = appController.listPrograms();
    expect(programs.length).toBeGreaterThan(0);
    expect(programs[0].requirements.children.length).toBeGreaterThan(0);
  });

  it('submits an async attempt', () => {
    const attempt = appController.submitAttempt({
      userId: 'user-1',
      offeringId: 'systems-200-elective-testing',
      activityId: 'systems-200-writing',
      activityType: 'writing.response',
      submission: { response: 'My answer' },
    });

    expect(attempt.state).toBe('submitted');
    expect(attempt.isAsync).toBe(true);
  });

  it('records an evaluation result', () => {
    const attempt = appController.submitAttempt({
      userId: 'user-1',
      offeringId: 'systems-200-elective-testing',
      activityId: 'systems-200-writing',
      activityType: 'writing.response',
      submission: { response: 'My answer' },
    });

    const evaluation = appController.recordEvaluation({
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
