import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attempt, Evaluation, ProgramTrack } from '@optimistic-tanuki/learning-domain';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import {
  LEARNING_REPOSITORY,
  LearningRepository,
} from './learning.repository';
import { sampleProgramTrack } from '@optimistic-tanuki/learning-domain';

export { LEARNING_REPOSITORY };

@Injectable()
export class TypeOrmLearningRepository implements LearningRepository {
  constructor(
    @InjectRepository(ProgramTrackEntity)
    private readonly programTrackRepo: Repository<ProgramTrackEntity>,
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(EvaluationEntity)
    private readonly evaluationRepo: Repository<EvaluationEntity>
  ) {}

  async listPrograms(): Promise<ProgramTrack[]> {
    const rows = await this.programTrackRepo.find();
    if (rows.length === 0) {
      return [sampleProgramTrack];
    }
    return rows.map((row) => row.data as unknown as ProgramTrack);
  }

  async createAttempt(input: Attempt): Promise<Attempt> {
    const entity = this.attemptRepo.create({
      id: input.id,
      userId: input.userId,
      offeringId: input.offeringId,
      activityId: input.activityId,
      activityType: input.activityType,
      state: input.state,
      isAsync: input.isAsync,
      submission: input.submission as Record<string, unknown>,
    });
    const saved = await this.attemptRepo.save(entity);
    return this.toAttemptDomain(saved);
  }

  async getAttempt(attemptId: string): Promise<Attempt | undefined> {
    const entity = await this.attemptRepo.findOne({ where: { id: attemptId } });
    return entity ? this.toAttemptDomain(entity) : undefined;
  }

  async saveAttempt(attempt: Attempt): Promise<Attempt> {
    await this.attemptRepo.update(attempt.id, { state: attempt.state });
    const saved = await this.attemptRepo.findOne({ where: { id: attempt.id } });
    return this.toAttemptDomain(saved!);
  }

  async recordEvaluation(input: Evaluation): Promise<Evaluation> {
    const entity = this.evaluationRepo.create({
      id: input.id,
      attemptId: input.attemptId,
      mode: input.mode,
      grader: input.grader,
      score: input.score,
      maxScore: input.maxScore,
      feedback: input.feedback,
      rubric: input.rubric as unknown as Record<string, unknown>,
      humanOverride: input.humanOverride,
    });
    const saved = await this.evaluationRepo.save(entity);
    return this.toEvaluationDomain(saved);
  }

  private toAttemptDomain(entity: AttemptEntity): Attempt {
    return {
      id: entity.id,
      userId: entity.userId,
      offeringId: entity.offeringId,
      activityId: entity.activityId,
      activityType: entity.activityType as Attempt['activityType'],
      state: entity.state as Attempt['state'],
      isAsync: entity.isAsync,
      submission: entity.submission,
      submittedAt: entity.submittedAt.toISOString(),
    };
  }

  private toEvaluationDomain(entity: EvaluationEntity): Evaluation {
    return {
      id: entity.id,
      attemptId: entity.attemptId,
      mode: entity.mode as Evaluation['mode'],
      grader: entity.grader as Evaluation['grader'],
      score: Number(entity.score),
      maxScore: Number(entity.maxScore),
      feedback: entity.feedback,
      rubric: entity.rubric as unknown as Evaluation['rubric'],
      humanOverride: entity.humanOverride,
      evaluatedAt: entity.evaluatedAt.toISOString(),
    };
  }
}
