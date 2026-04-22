import { Inject, Injectable } from '@nestjs/common';
import {
  Attempt,
  Evaluation,
  ProgramTrack,
  sampleProgramTrack,
} from '@optimistic-tanuki/learning-domain';
import { randomUUID } from 'crypto';
import {
  CreateAttemptInput,
  LEARNING_REPOSITORY,
  LearningRepository,
  RecordEvaluationInput,
} from './learning.repository';

@Injectable()
export class AppService {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepository
  ) {}

  listPrograms(): ProgramTrack[] {
    return this.repository.listPrograms();
  }

  submitAttempt(input: CreateAttemptInput): Attempt {
    return this.repository.createAttempt({
      id: randomUUID(),
      userId: input.userId,
      offeringId: input.offeringId,
      activityId: input.activityId,
      activityType: input.activityType,
      state: 'submitted',
      isAsync: input.isAsync ?? input.activityType !== 'code.run',
      submission: input.submission,
      submittedAt: new Date().toISOString(),
    });
  }

  recordEvaluation(input: RecordEvaluationInput): Evaluation {
    const evaluation = this.repository.recordEvaluation({
      id: randomUUID(),
      ...input,
      evaluatedAt: new Date().toISOString(),
    });

    const attempt = this.repository.getAttempt(input.attemptId);
    if (attempt) {
      this.repository.saveAttempt({
        ...attempt,
        state: input.score >= input.maxScore * 0.7 ? 'graded' : 'needs_revision',
      });
    }

    return evaluation;
  }
}

@Injectable()
export class InMemoryLearningRepository implements LearningRepository {
  private readonly programs: ProgramTrack[] = [sampleProgramTrack];
  private readonly attempts = new Map<string, Attempt>();
  private readonly evaluations = new Map<string, Evaluation>();

  listPrograms(): ProgramTrack[] {
    return this.programs;
  }

  createAttempt(input: Attempt): Attempt {
    this.attempts.set(input.id, input);
    return input;
  }

  getAttempt(attemptId: string): Attempt | undefined {
    return this.attempts.get(attemptId);
  }

  saveAttempt(attempt: Attempt): Attempt {
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  recordEvaluation(input: Evaluation): Evaluation {
    this.evaluations.set(input.id, input);
    return input;
  }
}
