import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Attempt,
  buildDraftProgramTrack,
  DraftOfferingInput,
  Enrolment,
  Evaluation,
  OfferingOwnership,
  ProgramTrack,
  ProgramTrackSchema,
} from '@optimistic-tanuki/learning-domain';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import {
  LEARNING_REPOSITORY,
  LearningRepository,
  OfferingContentPatch,
} from './learning.repository';
import {
  tutorialProgramTracks,
  LessonProgress,
} from '@optimistic-tanuki/learning-domain';
import { LessonProgressEntity } from '../entities/lesson-progress.entity';
import { EnrolmentEntity } from '../entities/enrolment.entity';
import { OfferingOwnershipEntity } from '../entities/offering-ownership.entity';

export { LEARNING_REPOSITORY };

@Injectable()
export class TypeOrmLearningRepository implements LearningRepository {
  private readonly logger = new Logger(TypeOrmLearningRepository.name);

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
    private readonly enrolmentRepo: Repository<EnrolmentEntity>,
    @InjectRepository(OfferingOwnershipEntity)
    private readonly offeringOwnershipRepo: Repository<OfferingOwnershipEntity>
  ) {}

  /**
   * The built-in catalog is a baseline, not a fallback. It used to disappear
   * the moment anything was stored, because the old code treated a non-empty
   * table as a full replacement for the four shipped tracks and then, on top
   * of that, filtered out anything without an upstream repositoryUrl, which
   * is exactly what an authored track looks like. That combination emptied
   * the catalog the first time anyone authored a course.
   *
   * Built-ins and stored tracks are merged by id instead. A stored row shadows
   * a built-in with the same id (an edit), and anything else stored is added
   * alongside the built-ins rather than replacing them.
   */
  async listPrograms(): Promise<ProgramTrack[]> {
    const rows = await this.programTrackRepo.find();
    const merged = new Map<string, ProgramTrack>();
    for (const track of tutorialProgramTracks) merged.set(track.id, track);
    for (const row of rows) {
      const track = this.readStoredTrack(row);
      if (track) merged.set(row.trackId, track);
    }
    return [...merged.values()];
  }

  /**
   * Validates a stored track on the way out, rather than casting it.
   *
   * A track is JSONB, so its shape is whatever was written, possibly by an
   * older version of this code. Parsing here is what converts a row that still
   * names its lesson renditions `languageVariants` into the current shape;
   * casting would have handed the old shape straight to callers that expect
   * `content`, and they would have failed on undefined further downstream.
   *
   * A row that cannot be read at all is skipped rather than thrown, so one bad
   * course cannot blank the catalog for everyone. It is logged, because a
   * course quietly missing from the catalog is its own kind of bug.
   */
  private readStoredTrack(row: ProgramTrackEntity): ProgramTrack | undefined {
    const parsed = ProgramTrackSchema.safeParse(row.data);
    if (parsed.success) return parsed.data;
    this.logger.error(
      `Stored program track ${row.trackId} does not match the schema and was left out of the catalog: ${parsed.error.message}`
    );
    return undefined;
  }

  async createOffering(
    ownerProfileId: string,
    offeringId: string,
    input: DraftOfferingInput
  ): Promise<{ track: ProgramTrack; ownership: OfferingOwnership }> {
    const track = buildDraftProgramTrack(offeringId, input);

    // One unit of work. A course saved without its ownership row would be
    // editable by nobody except an admin, because authorization denies any
    // action on an offering with no owner.
    const savedOwnership = await this.programTrackRepo.manager.transaction(
      async (manager) => {
        await manager.save(
          manager.create(ProgramTrackEntity, {
            trackId: track.id,
            displayName: track.displayName,
            data: track as unknown as Record<string, unknown>,
          })
        );
        return await manager.save(
          manager.create(OfferingOwnershipEntity, {
            offeringId,
            ownerProfileId,
            coEditorProfileIds: [],
          })
        );
      }
    );

    return { track, ownership: this.toOwnershipDomain(savedOwnership) };
  }

  async updateOfferingContent(
    offeringId: string,
    patch: OfferingContentPatch
  ): Promise<ProgramTrack> {
    const trackEntity = await this.programTrackRepo.findOne({
      where: { trackId: offeringId },
    });
    if (!trackEntity) {
      throw new NotFoundException(`Unknown offering: ${offeringId}`);
    }
    // Parsed, not cast, for the same reason as the read path: an edit rewrites
    // the whole row, so reading a legacy row through the cast would write the
    // legacy shape straight back and the row would never move forward.
    const track = ProgramTrackSchema.parse(trackEntity.data);
    const offeringIndex = track.offerings.findIndex(
      (offering) => offering.id === offeringId
    );
    if (offeringIndex === -1) {
      throw new NotFoundException(`Unknown offering: ${offeringId}`);
    }
    const offering = track.offerings[offeringIndex];
    const updatedOffering = {
      ...offering,
      ...(patch.displayName !== undefined
        ? { displayName: patch.displayName }
        : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
    };
    const updatedTrack: ProgramTrack = {
      ...track,
      ...(patch.displayName !== undefined
        ? { displayName: patch.displayName }
        : {}),
      offerings: track.offerings.map((existing, index) =>
        index === offeringIndex ? updatedOffering : existing
      ),
    };
    trackEntity.data = updatedTrack as unknown as Record<string, unknown>;
    trackEntity.displayName = updatedTrack.displayName;
    await this.programTrackRepo.save(trackEntity);
    return updatedTrack;
  }

  async deleteOffering(offeringId: string): Promise<void> {
    await this.programTrackRepo.delete({ trackId: offeringId });
    await this.offeringOwnershipRepo.delete({ offeringId });
  }

  async getOwnership(
    offeringId: string
  ): Promise<OfferingOwnership | undefined> {
    const entity = await this.offeringOwnershipRepo.findOne({
      where: { offeringId },
    });
    return entity ? this.toOwnershipDomain(entity) : undefined;
  }

  async setCoEditors(
    offeringId: string,
    coEditorProfileIds: string[]
  ): Promise<OfferingOwnership> {
    const entity = await this.offeringOwnershipRepo.findOne({
      where: { offeringId },
    });
    if (!entity) {
      throw new NotFoundException(
        `No ownership record for offering: ${offeringId}`
      );
    }
    entity.coEditorProfileIds = coEditorProfileIds;
    return this.toOwnershipDomain(
      await this.offeringOwnershipRepo.save(entity)
    );
  }

  private toOwnershipDomain(
    entity: OfferingOwnershipEntity
  ): OfferingOwnership {
    return {
      offeringId: entity.offeringId,
      ownerProfileId: entity.ownerProfileId,
      coEditorProfileIds: entity.coEditorProfileIds,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
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
