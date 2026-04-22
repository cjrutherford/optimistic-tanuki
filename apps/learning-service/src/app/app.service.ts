import { Inject, Injectable } from '@nestjs/common';
import {
  Attempt,
  Evaluation,
  ProgramTrack,
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

  async listPrograms(): Promise<ProgramTrack[]> {
    return this.repository.listPrograms();
  }

  async submitAttempt(input: CreateAttemptInput): Promise<Attempt> {
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

  async recordEvaluation(input: RecordEvaluationInput): Promise<Evaluation> {
    const evaluation = await this.repository.recordEvaluation({
      id: randomUUID(),
      ...input,
      evaluatedAt: new Date().toISOString(),
    });

    const attempt = await this.repository.getAttempt(input.attemptId);
    if (attempt) {
      await this.repository.saveAttempt({
        ...attempt,
        state: input.score >= input.maxScore * 0.7 ? 'graded' : 'needs_revision',
      });
    }

    return evaluation;
  }
}

