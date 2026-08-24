import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  Attempt,
  CatalogViewer,
  DraftOfferingInput,
  Enrolment,
  NOT_ENROLLED,
  NotEnrolledPayload,
  Evaluation,
  LessonProgress,
  OfferingOwnership,
  ProgramTrack,
  groupTracksBySubject,
  isOfferingVisibleTo,
  LESSON_NOT_FOUND,
  LessonNotFoundPayload,
  OFFERING_NOT_FOUND,
  OfferingNotFoundPayload,
  lessonHasVariant,
  publicExercise,
  rollUpCompletedLessons,
  selectLessonContent,
  tutorialExercises,
  visibleTracks,
} from '@optimistic-tanuki/learning-domain';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join, normalize } from 'path';
import {
  CreateAttemptInput,
  LEARNING_REPOSITORY,
  LearningRepository,
  OfferingContentPatch,
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

  /**
   * A lesson, if this viewer is allowed to read it.
   *
   * Filtering the catalog is not enough on its own: this route takes ids
   * directly, so without the same check an unpublished course was readable by
   * anyone who knew a lesson id. That was true of the running service until
   * the viewer argument was added here.
   */
  async getLesson(
    trackId: string,
    lessonId: string,
    viewer: CatalogViewer = {}
  ) {
    const track = (await this.listPrograms()).find(
      (candidate) => candidate.id === trackId
    );
    if (!track) throw this.lessonNotFound(trackId, lessonId);
    const offering = track.offerings.find((candidate) =>
      candidate.modules
        .flatMap((module) => module.lessons)
        .some((candidateLesson) => candidateLesson.id === lessonId)
    );
    if (!offering) throw this.lessonNotFound(trackId, lessonId);
    const ownership =
      offering.status === 'published'
        ? undefined
        : await this.repository.getOwnership(offering.id);
    if (!isOfferingVisibleTo(offering, ownership, viewer)) {
      // The same answer an unknown lesson gets. Telling an outsider that a
      // course exists but is not theirs to read is itself a disclosure.
      throw this.lessonNotFound(trackId, lessonId);
    }
    const lesson = offering.modules
      .flatMap((module) => module.lessons)
      .find((candidate) => candidate.id === lessonId);
    if (!lesson) throw this.lessonNotFound(trackId, lessonId);
    // The track says which rendition to prefer, and the rendition says where
    // its words are. A course written inside the product carries them; the
    // four ported tracks point at a file that ships with the workspace.
    const preferred = track.variantAxis?.options[0]?.id;
    const rendition = selectLessonContent(lesson, preferred);
    const content = rendition.body
      ? rendition.body
      : await this.readLessonFile(track, rendition.sourcePath as string);
    // Exercises are code, so they are still matched by language. A track with
    // no language simply matches none, which is correct.
    const languageId = track.supportedLanguageIds?.[0];
    return {
      lesson,
      content,
      exercises: languageId
        ? tutorialExercises
            .filter(
              (exercise) =>
                exercise.languageId === languageId &&
                exercise.lessonSlug === lesson.slug
            )
            .map(publicExercise)
        : [],
    };
  }

  private lessonNotFound(trackId: string, lessonId: string): RpcException {
    return new RpcException({
      code: LESSON_NOT_FOUND,
      trackId,
      lessonId,
    } satisfies LessonNotFoundPayload);
  }

  /**
   * Reads a lesson file that ships with the workspace.
   *
   * The content collection is checked here rather than at the top of
   * getLesson, because a course whose lessons carry their own text has no
   * files and needs no collection.
   */
  private async readLessonFile(
    track: ProgramTrack,
    sourcePath: string
  ): Promise<string> {
    const collection = track.contentCollection;
    if (!collection)
      throw new Error(`Track ${track.id} has no content collection`);
    const relative = sourcePath.replace(/^src\/content\//, '');
    const contentRoot =
      process.env.LEARNING_CONTENT_ROOT ??
      join(process.cwd(), 'assets', 'content');
    const safePath = normalize(join(contentRoot, collection, relative));
    if (!safePath.startsWith(normalize(join(contentRoot, collection))))
      throw new Error('Invalid lesson source path');
    return await readFile(safePath, 'utf8');
  }

  /**
   * The catalog as one viewer should see it: everything published, plus the
   * drafts they are entitled to see.
   *
   * Separate from listPrograms, which stays the unfiltered read that every
   * internal lookup (finding a lesson, resolving an offering) depends on. A
   * draft still has to be reachable by the person writing it.
   */
  async listCatalog(viewer: CatalogViewer): Promise<ProgramTrack[]> {
    const tracks = await this.listPrograms();
    const draftOfferingIds = tracks
      .flatMap((track) => track.offerings)
      .filter((offering) => offering.status !== 'published')
      .map((offering) => offering.id);
    // Ownership is only needed to decide who sees a draft, so nothing is read
    // for a catalog that happens to be entirely published.
    const ownerships = new Map<string, OfferingOwnership>();
    for (const offeringId of draftOfferingIds) {
      const ownership = await this.repository.getOwnership(offeringId);
      if (ownership) ownerships.set(offeringId, ownership);
    }
    return visibleTracks(tracks, ownerships, viewer);
  }

  /**
   * The subjects this viewer's catalog actually contains.
   *
   * Computed here rather than in the browser so the naming rule lives in one
   * place. The alternative was a copy of it in the client, which would drift
   * the first time a subject was renamed.
   */
  async listSubjects(viewer: CatalogViewer) {
    const groups = groupTracksBySubject(await this.listCatalog(viewer));
    return groups.map((group) => ({
      subjectId: group.subjectId,
      displayName: group.displayName,
      focusNames: group.focusNames,
      courseCount: group.tracks.reduce(
        (total, track) =>
          total +
          track.offerings.filter(
            (offering) => offering.subjectId === group.subjectId
          ).length,
        0
      ),
    }));
  }

  /**
   * The courses this profile may work on.
   *
   * Drafts included, published included: an author needs to see everything
   * they are responsible for, which is exactly the set the catalog hides from
   * everyone else.
   */
  async listMyOfferings(profileId: string) {
    const ownerships = await this.repository.listOwnerships(profileId);
    if (ownerships.length === 0) return [];
    const byOfferingId = new Map(
      ownerships.map((ownership) => [ownership.offeringId, ownership])
    );
    const tracks = await this.listPrograms();
    return tracks.flatMap((track) =>
      track.offerings
        .filter((offering) => byOfferingId.has(offering.id))
        .map((offering) => {
          const ownership = byOfferingId.get(offering.id) as OfferingOwnership;
          return {
            offering,
            trackId: track.id,
            trackDisplayName: track.displayName,
            lessonCount: offering.modules.reduce(
              (total, module) => total + module.lessons.length,
              0
            ),
            // An author needs to know which of these are theirs to publish
            // and which they were invited to help with.
            isOwner: ownership.ownerProfileId === profileId,
          };
        })
    );
  }

  /**
   * Everything a course page needs, in one call.
   *
   * Prerequisites are resolved to names here rather than in the client,
   * because the client only has the offerings it can see and a prerequisite
   * may live in a different track.
   */
  async getOfferingDetail(offeringId: string, viewer: CatalogViewer) {
    const tracks = await this.listPrograms();
    const track = tracks.find((candidate) =>
      candidate.offerings.some((offering) => offering.id === offeringId)
    );
    const offering = track?.offerings.find(
      (candidate) => candidate.id === offeringId
    );
    if (!track || !offering) throw this.offeringNotFound(offeringId);

    const ownership =
      offering.status === 'published'
        ? undefined
        : await this.repository.getOwnership(offeringId);
    if (!isOfferingVisibleTo(offering, ownership, viewer)) {
      // Same answer as a course that does not exist, for the same reason the
      // lesson route gives one.
      throw this.offeringNotFound(offeringId);
    }

    const byId = new Map(
      tracks
        .flatMap((candidate) => candidate.offerings)
        .map((candidate) => [candidate.id, candidate])
    );
    return {
      offering,
      trackId: track.id,
      trackDisplayName: track.displayName,
      variantAxis: track.variantAxis,
      lessonCount: offering.modules.reduce(
        (total, module) => total + module.lessons.length,
        0
      ),
      // An unknown prerequisite still shows, named by its id, rather than
      // vanishing. A course silently missing a requirement is worse than an
      // ugly one.
      prerequisites: (offering.prerequisiteOfferingIds ?? []).map((id) => ({
        offeringId: id,
        displayName: byId.get(id)?.displayName ?? id,
      })),
      ownerProfileId: (await this.repository.getOwnership(offeringId))
        ?.ownerProfileId,
    };
  }

  private offeringNotFound(offeringId: string): RpcException {
    return new RpcException({
      code: OFFERING_NOT_FOUND,
      offeringId,
    } satisfies OfferingNotFoundPayload);
  }

  async getProgress(profileId: string): Promise<LessonProgress[]> {
    return await this.repository.getProgress(profileId);
  }

  async getDashboard(profileId?: string) {
    // The catalog, not the raw list. Without this an unpublished course would
    // appear on every learner's dashboard the moment somebody opened it.
    const programs = await this.listCatalog({ profileId });
    const progress = profileId ? await this.getProgress(profileId) : [];
    const completedByLesson = new Map(
      progress.map((item) => [item.lessonId, item])
    );
    return programs.map((program) => {
      const lessons = program.offerings
        .flatMap((offering) => offering.modules)
        .flatMap((module) => module.lessons);
      const lessonIds = new Set(lessons.map((lesson) => lesson.id));
      const programProgress = progress.filter((item) =>
        lessonIds.has(item.lessonId)
      );
      // A parent lesson counts as done once every part of it is done, so a
      // learner who worked through the detail lessons is not asked to tick
      // the overview separately.
      const completed = rollUpCompletedLessons(
        lessons,
        lessons
          .filter((lesson) => completedByLesson.get(lesson.id)?.completed)
          .map((lesson) => lesson.id)
      );
      const completedLessons = completed.size;
      const completedExerciseIds = programProgress.flatMap(
        (item) => item.completedExerciseIds
      );
      // A track with no language has no code exercises. This used to index
      // supportedLanguageIds directly, which throws on a track that has none.
      // strictNullChecks is off in this workspace, so nothing warned about it.
      const trackLanguageId = program.supportedLanguageIds?.[0];
      const exercises = trackLanguageId
        ? tutorialExercises.filter(
            (exercise) => exercise.languageId === trackLanguageId
          )
        : [];
      const completedExercises = exercises.filter((exercise) =>
        completedExerciseIds.includes(exercise.id)
      ).length;
      const points = programProgress.reduce(
        (total, item) => total + item.points,
        0
      );
      return {
        program,
        totals: {
          lessons: lessons.length,
          exercises: exercises.length,
          points: exercises.reduce(
            (total, exercise) => total + exercise.points,
            0
          ),
        },
        progress: {
          completedLessons,
          completedExercises,
          points,
          nextLessonId:
            lessons.find((lesson) => !completed.has(lesson.id))?.id ?? null,
        },
      };
    });
  }

  async saveProgress(
    profileId: string,
    userId: string,
    progress: Omit<LessonProgress, 'updatedAt'>
  ): Promise<LessonProgress> {
    const offeringId = await this.findOfferingIdForLesson(progress.lessonId);
    const enrolment = await this.repository.getEnrolment(profileId, offeringId);
    // No enrolment, no progress. Without this, saving progress is the only
    // signal that anyone is taking anything, and it's forgeable by anyone
    // who knows a lessonId.
    if (!enrolment || enrolment.status !== 'active') {
      // A payload rather than a message, so the gateway can answer 409 and
      // the client can offer to enrol instead of showing a failure.
      throw new RpcException({
        code: NOT_ENROLLED,
        offeringId,
        lessonId: progress.lessonId,
      } satisfies NotEnrolledPayload);
    }
    return await this.repository.saveProgress(
      profileId,
      userId,
      enrolment.id,
      progress
    );
  }

  private async findOfferingIdForLesson(lessonId: string): Promise<string> {
    const tracks = await this.listPrograms();
    for (const track of tracks) {
      for (const offering of track.offerings) {
        const lessons = offering.modules.flatMap((module) => module.lessons);
        if (lessons.some((lesson) => lesson.id === lessonId)) {
          return offering.id;
        }
      }
    }
    throw new Error(`Lesson ${lessonId} is not attached to any offering`);
  }

  async enrol(profileId: string, offeringId: string): Promise<Enrolment> {
    // Nobody enrols in an unfinished course, including its author. A draft is
    // for writing and previewing, and enrolment is what progress hangs off.
    const offering = (await this.listPrograms())
      .flatMap((track) => track.offerings)
      .find((candidate) => candidate.id === offeringId);
    if (!offering) throw new Error(`Unknown offering: ${offeringId}`);
    if (offering.status !== 'published') {
      throw new Error(`Offering ${offeringId} is not published`);
    }
    return await this.repository.enrol(profileId, offeringId);
  }

  async withdraw(profileId: string, offeringId: string): Promise<Enrolment> {
    return await this.repository.withdraw(profileId, offeringId);
  }

  async listEnrolments(profileId: string): Promise<Enrolment[]> {
    return await this.repository.listEnrolments(profileId);
  }

  async runCode(activityId: string, code: string) {
    const exercise = tutorialExercises.find(
      (candidate) => candidate.id === activityId
    );
    if (!exercise) throw new Error(`Unknown exercise: ${activityId}`);
    const response = await fetch(
      `${
        process.env.LEARNING_RUNNER_URL ?? 'http://learning-runner:3025'
      }/runs`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ languageId: exercise.languageId, code }),
      }
    );
    const result = (await response.json()) as {
      success: boolean;
      output: string;
      errors: string[];
      timedOut: boolean;
    };
    return {
      ...result,
      testsPassed:
        result.success &&
        (!exercise.expectedOutput ||
          result.output.trim() === exercise.expectedOutput.trim()),
    };
  }

  async submitExercise(
    profileId: string,
    userId: string,
    activityId: string,
    code: string
  ) {
    const exercise = tutorialExercises.find(
      (candidate) => candidate.id === activityId
    );
    if (!exercise) throw new Error(`Unknown exercise: ${activityId}`);
    const response = await fetch(
      `${
        process.env.LEARNING_RUNNER_URL ?? 'http://learning-runner:3025'
      }/runs`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          languageId: exercise.languageId,
          code,
          verifier: exercise.verifier,
          expectedOutput: exercise.expectedOutput,
        }),
      }
    );
    const result = (await response.json()) as {
      success: boolean;
      output: string;
      errors: string[];
      timedOut: boolean;
      testsPassed?: boolean;
    };
    const passed = Boolean(
      result.success &&
        (result.testsPassed ??
          (!exercise.expectedOutput ||
            result.output.trim() === exercise.expectedOutput.trim()))
    );
    const tracks = await this.listPrograms();
    const lesson = tracks
      .flatMap((track) => track.offerings)
      .flatMap((offering) => offering.modules)
      .flatMap((module) => module.lessons)
      .find(
        (item) =>
          item.slug === exercise.lessonSlug &&
          lessonHasVariant(item, exercise.languageId)
      );
    if (!lesson)
      throw new Error(`Exercise ${activityId} is not attached to a lesson`);
    const previous = (await this.getProgress(profileId)).find(
      (item) => item.lessonId === lesson.id
    );
    const alreadyComplete =
      previous?.completedExerciseIds.includes(activityId) ?? false;
    const completedExerciseIds = passed
      ? [...new Set([...(previous?.completedExerciseIds ?? []), activityId])]
      : previous?.completedExerciseIds ?? [];
    const points =
      (previous?.points ?? 0) +
      (passed && !alreadyComplete ? exercise.points : 0);
    const progress = await this.saveProgress(profileId, userId, {
      lessonId: lesson.id,
      completed: previous?.completed ?? false,
      completedExerciseIds,
      points,
    });
    return {
      ...result,
      passed,
      awardedPoints: passed && !alreadyComplete ? exercise.points : 0,
      progress,
    };
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
        state:
          input.score >= input.maxScore * 0.7 ? 'graded' : 'needs_revision',
      });
    }

    return evaluation;
  }

  /**
   * Authorization already happened at the gateway before this was called;
   * the service trusts the caller the same way submitAttempt trusts the
   * userId it is given. offeringId is generated here rather than accepted
   * from the caller, so an author cannot collide with or hijack an existing
   * offering id by guessing it.
   */
  async createOffering(
    ownerProfileId: string,
    input: DraftOfferingInput
  ): Promise<{ track: ProgramTrack; ownership: OfferingOwnership }> {
    const offeringId = randomUUID();
    return this.repository.createOffering(ownerProfileId, offeringId, input);
  }

  async updateOffering(
    offeringId: string,
    patch: OfferingContentPatch
  ): Promise<ProgramTrack> {
    return this.repository.updateOfferingContent(offeringId, patch);
  }

  async deleteOffering(offeringId: string): Promise<void> {
    await this.repository.deleteOffering(offeringId);
  }

  async getOfferingOwnership(
    offeringId: string
  ): Promise<OfferingOwnership | undefined> {
    return this.repository.getOwnership(offeringId);
  }

  async setCoEditors(
    offeringId: string,
    coEditorProfileIds: string[]
  ): Promise<OfferingOwnership> {
    return this.repository.setCoEditors(offeringId, coEditorProfileIds);
  }
}
