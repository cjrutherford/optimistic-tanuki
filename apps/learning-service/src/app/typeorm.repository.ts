import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Attempt,
  Enrolment,
  Evaluation,
  ProgramTrack,
} from '@optimistic-tanuki/learning-domain';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import { LEARNING_REPOSITORY, LearningRepository } from './learning.repository';
import {
  tutorialProgramTracks,
  LessonProgress,
} from '@optimistic-tanuki/learning-domain';
import { LessonProgressEntity } from '../entities/lesson-progress.entity';
import { EnrolmentEntity } from '../entities/enrolment.entity';

export { LEARNING_REPOSITORY };

@Injectable()
export class TypeOrmLearningRepository implements LearningRepository {
  constructor(
    @InjectRepository(ProgramTrackEntity)
    private readonly programTrackRepo: Repository<ProgramTrackEntity>,
    @InjectRepository(AttemptEntity)
    private readonly attemptRepo: Repository<AttemptEntity>,
    @InjectRepository(EvaluationEntity)
    private readonly evaluationRepo: Repository<EvaluationEntity>,
    @InjectRepository(LessonProgressEntity)
    private readonly lessonProgressRepo: Repository<LessonProgressEntity>,
    @InjectRepository(EnrolmentEntity)
    private readonly enrolmentRepo: Repository<EnrolmentEntity>
  ) {}

  async listPrograms(): Promise<ProgramTrack[]> {
    const rows = await this.programTrackRepo.find();
    if (rows.length === 0) {
      return tutorialProgramTracks;
    }
    return rows
      .map((row) => row.data as unknown as ProgramTrack)
      .filter((track) => track.source?.repositoryUrl);
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
      recordedByUserId: input.recordedByUserId ?? null,
    });
    const saved = await this.evaluationRepo.save(entity);
    return this.toEvaluationDomain(saved);
  }

  async getProgress(profileId: string): Promise<LessonProgress[]> {
    return (await this.lessonProgressRepo.find({ where: { profileId } })).map(
      (row) => this.toProgressDomain(row)
    );
  }

  async saveProgress(
    profileId: string,
    userId: string,
    enrolmentId: string,
    progress: Omit<LessonProgress, 'updatedAt'>
  ): Promise<LessonProgress> {
    const existing = await this.lessonProgressRepo.findOne({
      where: { profileId, lessonId: progress.lessonId },
    });
    const entity = this.lessonProgressRepo.create({
      ...(existing ?? {}),
      userId,
      profileId,
      enrolmentId,
      lessonId: progress.lessonId,
      completed: progress.completed,
      completedExerciseIds: progress.completedExerciseIds,
      points: progress.points,
    });
    return this.toProgressDomain(await this.lessonProgressRepo.save(entity));
  }

  async enrol(profileId: string, offeringId: string): Promise<Enrolment> {
    const existing = await this.enrolmentRepo.findOne({
      where: { profileId, offeringId },
    });
    if (existing) {
      // Re-enrolling after a withdrawal reactivates the same row rather than
      // creating a second one, which the unique constraint would reject
      // anyway.
      if (existing.status === 'withdrawn') {
        existing.status = 'active';
        existing.withdrawnAt = null;
        return this.toEnrolmentDomain(await this.enrolmentRepo.save(existing));
      }
      return this.toEnrolmentDomain(existing);
    }
    const entity = this.enrolmentRepo.create({
      profileId,
      offeringId,
      status: 'active',
    });
    return this.toEnrolmentDomain(await this.enrolmentRepo.save(entity));
  }

  async withdraw(profileId: string, offeringId: string): Promise<Enrolment> {
    const existing = await this.enrolmentRepo.findOne({
      where: { profileId, offeringId },
    });
    if (!existing) {
      throw new Error(
        `Profile ${profileId} is not enrolled in offering ${offeringId}`
      );
    }
    existing.status = 'withdrawn';
    existing.withdrawnAt = new Date();
    return this.toEnrolmentDomain(await this.enrolmentRepo.save(existing));
  }

  async listEnrolments(profileId: string): Promise<Enrolment[]> {
    return (await this.enrolmentRepo.find({ where: { profileId } })).map(
      (row) => this.toEnrolmentDomain(row)
    );
  }

  async getEnrolment(
    profileId: string,
    offeringId: string
  ): Promise<Enrolment | undefined> {
    const entity = await this.enrolmentRepo.findOne({
      where: { profileId, offeringId },
    });
    return entity ? this.toEnrolmentDomain(entity) : undefined;
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
      ...(entity.recordedByUserId
        ? { recordedByUserId: entity.recordedByUserId }
        : {}),
      evaluatedAt: entity.evaluatedAt.toISOString(),
    };
  }

  private toEnrolmentDomain(entity: EnrolmentEntity): Enrolment {
    return {
      id: entity.id,
      profileId: entity.profileId,
      offeringId: entity.offeringId,
      status: entity.status as Enrolment['status'],
      enrolledAt: entity.enrolledAt.toISOString(),
      ...(entity.withdrawnAt
        ? { withdrawnAt: entity.withdrawnAt.toISOString() }
        : {}),
    };
  }

  private toProgressDomain(entity: LessonProgressEntity): LessonProgress {
    return {
      lessonId: entity.lessonId,
      completed: entity.completed,
      completedExerciseIds: entity.completedExerciseIds,
      points: entity.points,
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
