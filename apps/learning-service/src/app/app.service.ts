import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  Activity,
  CodeExercise,
  CodeRunActivity,
  GoExecutionMode,
  LessonMetadata,
  ACTIVITY_NOT_FOUND,
  ActivityNotFoundPayload,
  Attempt,
  CatalogViewer,
  GradeOutcome,
  gradeMultipleChoice,
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
  normalizeCoEditorProfileIds,
  OFFERING_NOT_FOUND,
  OfferingNotFoundPayload,
  lessonHasVariant,
  publicActivity,
  publicExercise,
  rollUpCompletedLessons,
  selectLessonContent,
  tutorialExercises,
  visibleTracks,
} from '@optimistic-tanuki/learning-domain';
import { GradingService } from './grading.service';
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

interface RunnerResult {
  success: boolean;
  output: string;
  errors: string[];
  timedOut: boolean;
  testsPassed?: boolean;
  testResults?: Array<{
    name: string;
    passed: boolean;
    error?: string;
  }>;
}

interface RunnerRequest {
  languageId: string;
  code: string;
  expectedOutput?: string;
  verifier?: {
    testCode?: string;
    validationPattern?: string;
    executionMode?: GoExecutionMode;
  };
  supportingFiles?: Record<string, string>;
}

interface AuthoredCodeLocation {
  offering: ProgramTrack['offerings'][number];
  activity: CodeRunActivity;
}

interface ChallengeLessonLocation {
  lesson: LessonMetadata;
  moduleId: string;
  offeringId: string;
}

type PublicExercise = ReturnType<typeof publicExercise>;

interface ChallengeListItem extends PublicExercise {
  trackId: string;
  trackDisplayName: string;
  offeringId?: string;
  moduleId: string;
  lessonId: string;
  lessonTitle: string;
  solved: boolean;
}

function indexChallengeLessons(
  offerings: readonly ProgramTrack['offerings'][number][]
): Map<string, ChallengeLessonLocation> {
  const index = new Map<string, ChallengeLessonLocation>();
  for (const offering of offerings) {
    for (const module of offering.modules) {
      for (const lesson of module.lessons) {
        if (!index.has(lesson.slug)) {
          index.set(lesson.slug, {
            lesson,
            moduleId: module.id,
            offeringId: offering.id,
          });
        }
      }
    }
  }
  return index;
}

function mapChallenges(
  track: ProgramTrack,
  lessonIndex: ReadonlyMap<string, ChallengeLessonLocation>,
  exercises: readonly CodeExercise[],
  isSolved: (exerciseId: string, offeringId?: string) => boolean
): ChallengeListItem[] {
  return exercises
    .filter(
      (exercise) => exercise.languageId === track.supportedLanguageIds?.[0]
    )
    .map((exercise) => {
      const location = lessonIndex.get(exercise.lessonSlug);
      return {
        ...publicExercise(exercise),
        trackId: track.id,
        trackDisplayName: track.displayName,
        offeringId: location?.offeringId,
        moduleId: location?.moduleId ?? '',
        lessonId: location?.lesson.id ?? exercise.lessonSlug,
        lessonTitle: location?.lesson.title ?? exercise.title,
        solved: isSolved(exercise.id, location?.offeringId),
      };
    });
}

@Injectable()
export class AppService {
  constructor(
    @Inject(LEARNING_REPOSITORY)
    private readonly repository: LearningRepository,
    private readonly grading: GradingService
  ) {}

  async listPrograms(): Promise<ProgramTrack[]> {
    return this.repository.listPrograms();
  }

  /**
   * Strips the mark scheme out of every activity in a catalog.
   *
   * listPrograms itself stays whole, because grading reads activities back out
   * of it by id and needs the answers. This runs at the edges, on what is
   * about to leave the service.
   */
  private withoutMarkSchemes(tracks: ProgramTrack[]): ProgramTrack[] {
    return tracks.map((track) => ({
      ...track,
      offerings: track.offerings.map((offering) => ({
        ...offering,
        activities: offering.activities.map(publicActivity),
      })),
    })) as ProgramTrack[];
  }

  /** The catalog as it leaves the service, for callers with no viewer. */
  async listPublicPrograms(): Promise<ProgramTrack[]> {
    return this.withoutMarkSchemes(await this.listPrograms());
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
    viewer: CatalogViewer = {},
    offeringId?: string,
    moduleId?: string
  ) {
    const track = (await this.listPrograms()).find(
      (candidate) => candidate.id === trackId
    );
    if (!track) throw this.lessonNotFound(trackId, lessonId);
    const location = await this.resolveReadableLesson(
      track,
      lessonId,
      moduleId,
      viewer,
      offeringId
    );
    if (!location) throw this.lessonNotFound(trackId, lessonId);
    const { offering, lesson } = location;
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
      offeringId: offering.id,
      content,
      // The work this lesson's author set. Separate from the exercises above,
      // which are code and belong to the ported tracks.
      activities: offering.activities
        .filter((activity) => activity.lessonId === lesson.id)
        .map(publicActivity),
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
   * Resolve a lesson only after applying visibility to every matching
   * offering. Legacy URLs do not carry an offering id, so picking the first
   * structural match and checking visibility afterwards can hide a published
   * rendition behind an earlier private draft.
   */
  private async resolveReadableLesson(
    track: ProgramTrack,
    lessonId: string,
    moduleId: string | undefined,
    viewer: CatalogViewer,
    requestedOfferingId?: string
  ): Promise<
    | {
        offering: ProgramTrack['offerings'][number];
        module: ProgramTrack['offerings'][number]['modules'][number];
        lesson: ProgramTrack['offerings'][number]['modules'][number]['lessons'][number];
      }
    | undefined
  > {
    const candidates = track.offerings.filter(
      (offering) =>
        (!requestedOfferingId || offering.id === requestedOfferingId) &&
        offering.modules.some(
          (module) =>
            (!moduleId || module.id === moduleId) &&
            module.lessons.some((lesson) => lesson.id === lessonId)
        )
    );
    for (const offering of candidates) {
      const ownership =
        offering.status === 'published'
          ? undefined
          : await this.repository.getOwnership(offering.id);
      if (!isOfferingVisibleTo(offering, ownership, viewer)) continue;
      const module = moduleId
        ? offering.modules.find(
            (candidate) =>
              candidate.id === moduleId &&
              candidate.lessons.some((lesson) => lesson.id === lessonId)
          )
        : offering.modules.find((candidate) =>
            candidate.lessons.some((lesson) => lesson.id === lessonId)
          );
      const lesson = module?.lessons.find(
        (candidate) => candidate.id === lessonId
      );
      if (module && lesson) return { offering, module, lesson };
    }
    return undefined;
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
    return this.withoutMarkSchemes(visibleTracks(tracks, ownerships, viewer));
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

    // Looked up whether or not the course is published, because this route
    // feeds the editor as well as the course page and the answer below turns
    // on who is asking. A published course used to skip this entirely.
    const ownership = await this.repository.getOwnership(offeringId);
    if (
      !isOfferingVisibleTo(
        offering,
        offering.status === 'published' ? undefined : ownership,
        viewer
      )
    ) {
      // Same answer as a course that does not exist, for the same reason the
      // lesson route gives one.
      throw this.offeringNotFound(offeringId);
    }

    // The author gets their own course back whole. Everyone else gets it
    // without the mark scheme.
    //
    // Both halves matter. Returning it whole to everyone handed anyone who
    // fetched a course every quiz answer key and sample response in it,
    // signed in or not. Stripping it from everyone would have been worse in
    // a quieter way: the editor loads from this route and saves activities
    // back as a full replacement, so an author opening their own course
    // would have saved the stripped copy over their answers.
    const isOwner = Boolean(
      viewer.profileId && ownership?.ownerProfileId === viewer.profileId
    );
    const canEdit = Boolean(
      viewer.profileId &&
        ownership &&
        (ownership.ownerProfileId === viewer.profileId ||
          ownership.coEditorProfileIds.includes(viewer.profileId))
    );
    const visibleOffering = canEdit
      ? offering
      : { ...offering, activities: offering.activities.map(publicActivity) };

    const byId = new Map(
      tracks
        .flatMap((candidate) => candidate.offerings)
        .map((candidate) => [candidate.id, candidate])
    );
    return {
      offering: visibleOffering,
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
      ownerProfileId: ownership?.ownerProfileId,
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
    if (!profileId) return [];
    // The catalog, not the raw list. Without this an unpublished course would
    // appear on every learner's dashboard the moment somebody opened it.
    const programs = await this.listCatalog({ profileId });
    const [progress, enrolments] = await Promise.all([
      this.getProgress(profileId),
      this.listEnrolments(profileId),
    ]);
    const activeOfferingIds = new Set(
      enrolments
        .filter((enrolment) => enrolment.status === 'active')
        .map((enrolment) => enrolment.offeringId)
    );
    return programs.flatMap((program) =>
      program.offerings
        .filter((offering) => activeOfferingIds.has(offering.id))
        .map((offering) => {
          const lessons = offering.modules.flatMap((module) => module.lessons);
          const lessonIds = new Set(lessons.map((lesson) => lesson.id));
          const programProgress = progress.filter(
            (item) =>
              lessonIds.has(item.lessonId) && item.offeringId === offering.id
          );
          // A parent lesson counts as done once every part of it is done, so a
          // learner who worked through the detail lessons is not asked to tick
          // the overview separately.
          const completed = rollUpCompletedLessons(
            lessons,
            lessons
              .filter((lesson) =>
                programProgress.some(
                  (item) => item.lessonId === lesson.id && item.completed
                )
              )
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
            offeringId: offering.id,
            offering,
            program: { ...program, offerings: [offering] },
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
        })
    );
  }

  /**
   * Records progress on a lesson.
   *
   * `earned` is what the server watched the learner do, and only the two
   * callers that grade work supply it: submitting an exercise and answering
   * an activity. A learner marking a lesson read supplies nothing, and the
   * points and solved exercises already on the record are carried forward
   * untouched.
   *
   * This used to take the whole record from the caller and write it verbatim,
   * so anyone could send themselves any score.
   */
  async saveProgress(
    profileId: string,
    userId: string,
    progress: { lessonId: string; completed: boolean; offeringId?: string },
    earned?: { completedExerciseIds: string[]; points: number }
  ): Promise<LessonProgress> {
    const location = await this.resolveEnrolledLesson(
      profileId,
      progress.lessonId,
      progress.offeringId
    );
    const previous = (await this.getProgress(profileId)).find(
      (item) =>
        item.lessonId === progress.lessonId &&
        item.offeringId === location.offering.id
    );
    return await this.repository.saveProgress(
      profileId,
      userId,
      location.enrolment.id,
      {
        lessonId: progress.lessonId,
        offeringId: location.offering.id,
        completed: progress.completed,
        completedExerciseIds:
          earned?.completedExerciseIds ?? previous?.completedExerciseIds ?? [],
        points: earned?.points ?? previous?.points ?? 0,
      }
    );
  }

  /**
   * No enrolment, no progress.
   *
   * Without this, saving progress is the only signal that anyone is taking
   * anything, and it is forgeable by anyone who knows a lessonId. Throws a
   * payload rather than a message so the gateway can answer 409 and the client
   * can offer to enrol instead of showing a failure.
   */
  private async requireActiveEnrolment(
    profileId: string,
    lessonId: string,
    offeringId: string
  ): Promise<Enrolment> {
    const enrolment = await this.repository.getEnrolment(profileId, offeringId);
    if (!enrolment || enrolment.status !== 'active') {
      throw new RpcException({
        code: NOT_ENROLLED,
        offeringId,
        lessonId,
      } satisfies NotEnrolledPayload);
    }
    return enrolment;
  }

  /**
   * Resolve a mutation target using the supplied offering when present.
   * Without it, only published offerings with an active enrolment are
   * candidates; this makes legacy clients safe when lesson ids collide.
   */
  private async resolveEnrolledLesson(
    profileId: string,
    lessonIdOrSlug: string,
    requestedOfferingId?: string,
    languageId?: string
  ): Promise<{
    track: ProgramTrack;
    offering: ProgramTrack['offerings'][number];
    module: ProgramTrack['offerings'][number]['modules'][number];
    lesson: ProgramTrack['offerings'][number]['modules'][number]['lessons'][number];
    enrolment: Enrolment;
  }> {
    const tracks = await this.listPrograms();
    const candidates: Array<{
      track: ProgramTrack;
      offering: ProgramTrack['offerings'][number];
      module: ProgramTrack['offerings'][number]['modules'][number];
      lesson: ProgramTrack['offerings'][number]['modules'][number]['lessons'][number];
    }> = [];
    for (const track of tracks) {
      if (languageId && !track.supportedLanguageIds?.includes(languageId)) {
        continue;
      }
      for (const offering of track.offerings) {
        if (requestedOfferingId && offering.id !== requestedOfferingId) {
          continue;
        }
        for (const module of offering.modules) {
          const lesson = module.lessons.find(
            (candidate) =>
              (candidate.id === lessonIdOrSlug ||
                candidate.slug === lessonIdOrSlug) &&
              (!languageId || lessonHasVariant(candidate, languageId))
          );
          if (lesson) candidates.push({ track, offering, module, lesson });
        }
      }
    }

    const published = candidates.filter(
      (candidate) => candidate.offering.status === 'published'
    );
    if (requestedOfferingId && published.length === 0) {
      throw this.lessonNotFound(candidates[0]?.track.id ?? '', lessonIdOrSlug);
    }

    for (const candidate of published) {
      const enrolment = await this.repository.getEnrolment(
        profileId,
        candidate.offering.id
      );
      if (enrolment?.status === 'active') {
        return { ...candidate, enrolment };
      }
    }

    const visibleCandidate = published[0];
    if (visibleCandidate) {
      return {
        ...visibleCandidate,
        enrolment: await this.requireActiveEnrolment(
          profileId,
          lessonIdOrSlug,
          visibleCandidate.offering.id
        ),
      };
    }
    throw this.lessonNotFound(candidates[0]?.track.id ?? '', lessonIdOrSlug);
  }

  async enrol(profileId: string, offeringId: string): Promise<Enrolment> {
    // Nobody enrols in an unfinished course, including its author. A draft is
    // for writing and previewing, and enrolment is what progress hangs off.
    const offering = (await this.listPrograms())
      .flatMap((track) => track.offerings)
      .find((candidate) => candidate.id === offeringId);
    if (!offering || offering.status !== 'published') {
      // An unknown course and a course that is not available to ordinary
      // learners must cross the service boundary as the same structured
      // not-found response. A plain Error becomes a 500 and leaks which
      // branch was taken.
      throw this.offeringNotFound(offeringId);
    }
    return await this.repository.enrol(profileId, offeringId);
  }

  async withdraw(profileId: string, offeringId: string): Promise<Enrolment> {
    return await this.repository.withdraw(profileId, offeringId);
  }

  async listEnrolments(profileId: string): Promise<Enrolment[]> {
    return await this.repository.listEnrolments(profileId);
  }

  private async runCodeInRunner(request: RunnerRequest): Promise<RunnerResult> {
    const response = await fetch(
      `${
        process.env.LEARNING_RUNNER_URL ?? 'http://learning-runner:3025'
      }/runs`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      }
    );
    return (await response.json()) as RunnerResult;
  }

  private async findAuthoredCodeActivity(
    activityId: string,
    requestedOfferingId?: string
  ): Promise<AuthoredCodeLocation | undefined> {
    for (const track of await this.listPrograms()) {
      for (const offering of track.offerings) {
        if (requestedOfferingId && offering.id !== requestedOfferingId) {
          continue;
        }
        const activity = offering.activities.find(
          (candidate): candidate is CodeRunActivity =>
            candidate.id === activityId && candidate.type === 'code.run'
        );
        if (activity) return { offering, activity };
      }
    }
    return undefined;
  }

  private async runCodeInRunnerForActivity(
    activity: CodeRunActivity,
    code: string,
    includeVerifier: boolean
  ): Promise<RunnerResult> {
    return await this.runCodeInRunner({
      languageId: activity.languageId ?? 'typescript',
      code,
      ...(includeVerifier
        ? {
            expectedOutput: activity.expectedOutput,
            verifier: activity.verifier,
          }
        : {}),
      supportingFiles: activity.supportingFiles,
    });
  }

  async runCode(
    activityId: string,
    code: string,
    profileId?: string,
    offeringId?: string
  ) {
    const authored = await this.findAuthoredCodeActivity(
      activityId,
      offeringId
    );
    if (authored) {
      if (!profileId) {
        throw new RpcException({
          code: NOT_ENROLLED,
          offeringId: authored.offering.id,
          lessonId: authored.activity.lessonId ?? '',
        } satisfies NotEnrolledPayload);
      }
      const location = await this.resolveEnrolledActivity(
        profileId,
        activityId,
        offeringId
      );
      if (location.activity.type !== 'code.run') {
        throw new RpcException({
          code: ACTIVITY_NOT_FOUND,
          activityId,
        } satisfies ActivityNotFoundPayload);
      }
      return await this.runCodeInRunnerForActivity(
        location.activity,
        code,
        false
      );
    }

    const exercise = tutorialExercises.find(
      (candidate) => candidate.id === activityId
    );
    if (!exercise) throw new Error(`Unknown exercise: ${activityId}`);
    const result = await this.runCodeInRunner({
      languageId: exercise.languageId,
      code,
      // A plain run must not send verifier code or accidentally turn a normal
      // Go program into a test. Test-only exercises have no hidden verifier,
      // so their explicit mode is safe and necessary here.
      verifier: {
        executionMode: exercise.verifier.testCode
          ? 'run'
          : exercise.verifier.executionMode,
      },
      supportingFiles: exercise.supportingFiles,
    });
    return {
      ...result,
      testsPassed:
        result.success &&
        (result.testsPassed ??
          (!exercise.expectedOutput ||
            result.output.trim() === exercise.expectedOutput.trim())),
    };
  }

  async submitExercise(
    profileId: string,
    userId: string,
    activityId: string,
    code: string,
    offeringId?: string
  ) {
    const exercise = tutorialExercises.find(
      (candidate) => candidate.id === activityId
    );
    if (!exercise) throw new Error(`Unknown exercise: ${activityId}`);
    const location = await this.resolveEnrolledLesson(
      profileId,
      exercise.lessonSlug,
      offeringId,
      exercise.languageId
    );
    const result = await this.runCodeInRunner({
      languageId: exercise.languageId,
      code,
      verifier: exercise.verifier,
      expectedOutput: exercise.expectedOutput,
      supportingFiles: exercise.supportingFiles,
    });
    const passed = Boolean(
      result.success &&
        (result.testsPassed ??
          (!exercise.expectedOutput ||
            result.output.trim() === exercise.expectedOutput.trim()))
    );
    const previous = (await this.getProgress(profileId)).find(
      (item) =>
        item.lessonId === location.lesson.id &&
        item.offeringId === location.offering.id
    );
    const alreadyComplete =
      previous?.completedExerciseIds.includes(activityId) ?? false;

    if (!passed) {
      // Nothing was earned, so nothing is written. Returning the record as it
      // stands keeps the response shape the same for the client.
      return {
        ...result,
        passed,
        awardedPoints: 0,
        progress:
          previous ??
          (await this.saveProgress(profileId, userId, {
            lessonId: location.lesson.id,
            completed: false,
            offeringId: location.offering.id,
          })),
      };
    }

    // The new total is computed by the database, not here. Two exercises in
    // the same lesson solved at once would otherwise both read the same
    // points and the later write would discard the earlier award.
    const progress = await this.repository.recordSolvedExercise(
      profileId,
      userId,
      location.enrolment.id,
      location.lesson.id,
      { id: activityId, points: exercise.points }
    );

    return {
      ...result,
      passed,
      awardedPoints: alreadyComplete ? 0 : exercise.points,
      progress,
    };
  }

  async listChallenges(params: {
    trackId?: string;
    profileId?: string;
    viewer?: CatalogViewer;
  }) {
    const tracks = await this.listCatalog(
      params.viewer ?? { profileId: params.profileId }
    );
    const progress = params.profileId
      ? await this.getProgress(params.profileId)
      : [];
    const isSolvedInOffering = (exerciseId: string, offeringId?: string) =>
      progress.some(
        (item) =>
          item.completedExerciseIds.includes(exerciseId) &&
          item.offeringId === offeringId
      );
    const activeEnrolments = params.profileId
      ? (await this.listEnrolments(params.profileId)).filter(
          (e) => e.status === 'active'
        )
      : [];

    if (params.trackId) {
      const track = tracks.find((t) => t.id === params.trackId);
      if (!track) {
        return { challenges: [], enrolledCount: 0, trackDisplayName: '' };
      }
      const trackOfferingIds = new Set(
        track.offerings.map((offering) => offering.id)
      );
      const enrolledCount = activeEnrolments.filter((enrolment) =>
        trackOfferingIds.has(enrolment.offeringId)
      ).length;
      const languageId = track.supportedLanguageIds?.[0];
      if (!languageId) {
        return {
          challenges: [],
          enrolledCount,
          trackDisplayName: track.displayName,
        };
      }

      const trackOfferings = [...track.offerings].sort(
        (left, right) =>
          Number(!activeEnrolments.some((e) => e.offeringId === left.id)) -
          Number(!activeEnrolments.some((e) => e.offeringId === right.id))
      );
      const lessonInfo = indexChallengeLessons(trackOfferings);
      const challenges = mapChallenges(
        track,
        lessonInfo,
        tutorialExercises,
        isSolvedInOffering
      );

      return {
        challenges,
        enrolledCount,
        trackDisplayName: track.displayName,
      };
    }

    if (activeEnrolments.length === 0) {
      return {
        challenges: [],
        enrolledCount: 0,
        trackDisplayName: '',
      };
    }

    const enrolledOfferingIds = new Set(
      activeEnrolments.map((e) => e.offeringId)
    );
    const enrolledTracks = tracks.filter((track) =>
      track.offerings.some((offering) => enrolledOfferingIds.has(offering.id))
    );

    const challenges: ChallengeListItem[] = [];
    for (const track of enrolledTracks) {
      const languageId = track.supportedLanguageIds?.[0];
      if (!languageId) continue;
      const enrolledOfferingIdsForTrack = new Set(
        track.offerings
          .filter((offering) => enrolledOfferingIds.has(offering.id))
          .map((offering) => offering.id)
      );
      const trackOfferings = [...track.offerings].sort(
        (left, right) =>
          Number(!enrolledOfferingIdsForTrack.has(left.id)) -
          Number(!enrolledOfferingIdsForTrack.has(right.id))
      );
      const lessonBySlug = indexChallengeLessons(trackOfferings);
      const trackChallenges = mapChallenges(
        track,
        lessonBySlug,
        tutorialExercises,
        isSolvedInOffering
      );
      challenges.push(...trackChallenges);
    }

    return {
      challenges,
      enrolledCount: activeEnrolments.length,
      trackDisplayName: 'All Enrolled Courses',
    };
  }

  /**
   * Answers an activity an author wrote, and marks it.
   *
   * The exercise path above runs code in a sandbox. This is the other kind of
   * work: a multiple choice, marked in process because the author already said
   * what is correct, or a written answer marked against the author's rubric.
   *
   * Every answer is recorded whether or not it could be marked. A grader that
   * is unreachable must not lose a learner's work, so the attempt is stored
   * and left for a person.
   */
  private async resolveEnrolledActivity(
    profileId: string,
    activityId: string,
    requestedOfferingId?: string
  ): Promise<{
    offering: ProgramTrack['offerings'][number];
    activity: Activity;
    enrolment: Enrolment;
  }> {
    const candidates: Array<{
      offering: ProgramTrack['offerings'][number];
      activity: Activity;
    }> = [];
    for (const track of await this.listPrograms()) {
      for (const offering of track.offerings) {
        if (requestedOfferingId && offering.id !== requestedOfferingId) {
          continue;
        }
        const activity = offering.activities.find(
          (candidate) => candidate.id === activityId
        );
        if (activity) candidates.push({ offering, activity });
      }
    }
    const published = candidates.filter(
      (candidate) => candidate.offering.status === 'published'
    );
    if (requestedOfferingId && published.length === 0) {
      throw new RpcException({
        code: ACTIVITY_NOT_FOUND,
        activityId,
      } satisfies ActivityNotFoundPayload);
    }
    for (const candidate of published) {
      const enrolment = await this.repository.getEnrolment(
        profileId,
        candidate.offering.id
      );
      if (enrolment?.status === 'active') {
        return { ...candidate, enrolment };
      }
    }
    const visibleCandidate = published[0];
    if (!visibleCandidate) {
      throw new RpcException({
        code: ACTIVITY_NOT_FOUND,
        activityId,
      } satisfies ActivityNotFoundPayload);
    }
    return {
      ...visibleCandidate,
      enrolment: await this.requireActiveEnrolment(
        profileId,
        '',
        visibleCandidate.offering.id
      ),
    };
  }

  async answerActivity(
    profileId: string,
    userId: string,
    activityId: string,
    submission: unknown,
    requestedOfferingId?: string
  ) {
    const location = await this.resolveEnrolledActivity(
      profileId,
      activityId,
      requestedOfferingId
    );
    const { offering, activity } = location;

    if (activity.type === 'code.run') {
      return await this.answerCodeActivity(
        profileId,
        userId,
        offering,
        activity,
        submission
      );
    }

    const outcome = await this.markAnswer(activity, submission);

    const attempt = await this.submitAttempt({
      userId,
      offeringId: offering.id,
      activityId,
      activityType: activity.type,
      submission,
    });

    let evaluation: Evaluation | undefined;
    if (outcome) {
      evaluation = await this.recordEvaluation({
        attemptId: attempt.id,
        mode: activity.type === 'quiz.mcq' ? 'sync' : 'async',
        grader: activity.type === 'quiz.mcq' ? 'auto' : 'llm',
        score: outcome.score,
        maxScore: outcome.maxScore,
        feedback: outcome.feedback,
        ...(activity.type === 'writing.response' && activity.rubric
          ? { rubric: activity.rubric }
          : {}),
        humanOverride: false,
      });
    }

    const progress = activity.lessonId
      ? await this.recordActivityProgress(
          profileId,
          userId,
          activity.lessonId,
          activityId,
          outcome,
          offering.id
        )
      : undefined;

    return {
      attemptId: attempt.id,
      graded: Boolean(outcome),
      score: outcome?.score,
      maxScore: outcome?.maxScore,
      feedback:
        outcome?.feedback ??
        'Your answer has been recorded. This one is marked by a person.',
      criteria: outcome?.criteria,
      evaluationId: evaluation?.id,
      progress,
    };
  }

  private async answerCodeActivity(
    profileId: string,
    userId: string,
    offering: ProgramTrack['offerings'][number],
    activity: CodeRunActivity,
    submission: unknown
  ) {
    const code = typeof submission === 'string' ? submission : '';
    const result = await this.runCodeInRunnerForActivity(activity, code, true);
    const passed = Boolean(
      result.success &&
        (result.testsPassed ??
          (!activity.expectedOutput ||
            result.output.trim() === activity.expectedOutput.trim()))
    );
    const outcome: GradeOutcome = {
      score: passed ? 1 : 0,
      maxScore: 1,
      feedback: passed
        ? 'Passed. Your code matched the author’s verifier.'
        : 'Not passed yet. Review the output and diagnostics, then try again.',
      criteria: [],
    };
    const previous = activity.lessonId
      ? (await this.getProgress(profileId)).find(
          (item) =>
            item.lessonId === activity.lessonId &&
            item.offeringId === offering.id
        )
      : undefined;
    const alreadyComplete =
      previous?.completedExerciseIds.includes(activity.id) ?? false;
    const attempt = await this.submitAttempt({
      userId,
      offeringId: offering.id,
      activityId: activity.id,
      activityType: activity.type,
      submission: code,
      isAsync: false,
    });
    const evaluation = await this.recordEvaluation({
      attemptId: attempt.id,
      mode: 'sync',
      grader: 'auto',
      score: outcome.score,
      maxScore: outcome.maxScore,
      feedback: outcome.feedback,
      humanOverride: false,
    });
    const progress = activity.lessonId
      ? await this.recordActivityProgress(
          profileId,
          userId,
          activity.lessonId,
          activity.id,
          outcome,
          offering.id
        )
      : undefined;

    return {
      attemptId: attempt.id,
      evaluationId: evaluation.id,
      graded: true,
      score: outcome.score,
      maxScore: outcome.maxScore,
      feedback: outcome.feedback,
      criteria: outcome.criteria,
      output: result.output,
      errors: result.errors,
      passed,
      testsPassed: result.testsPassed ?? passed,
      awardedPoints: passed && !alreadyComplete ? outcome.score : 0,
      progress,
    };
  }

  /** Marks an answer, or returns nothing when it cannot be marked. */
  private async markAnswer(
    activity: Activity,
    submission: unknown
  ): Promise<GradeOutcome | undefined> {
    if (activity.type === 'quiz.mcq') {
      const chosen = Array.isArray(submission)
        ? (submission as string[])
        : typeof submission === 'string'
        ? [submission]
        : [];
      return gradeMultipleChoice(activity, chosen);
    }
    if (activity.type === 'writing.response') {
      const text = typeof submission === 'string' ? submission.trim() : '';
      if (!text) return undefined;
      return await this.grading.gradeWriting(activity, text);
    }
    return undefined;
  }

  /**
   * Folds a marked answer into the lesson's progress.
   *
   * An activity counts as done once it has been answered acceptably, and only
   * awards its points the first time, exactly as an exercise does.
   */
  private async recordActivityProgress(
    profileId: string,
    userId: string,
    lessonId: string,
    activityId: string,
    outcome: GradeOutcome | undefined,
    offeringId?: string
  ): Promise<LessonProgress | undefined> {
    if (!outcome) return undefined;
    const passed = outcome.maxScore > 0 && outcome.score >= outcome.maxScore;
    const previous = (await this.getProgress(profileId)).find(
      (item) => item.lessonId === lessonId && item.offeringId === offeringId
    );
    const already =
      previous?.completedExerciseIds.includes(activityId) ?? false;
    return await this.saveProgress(
      profileId,
      userId,
      {
        lessonId,
        completed: previous?.completed ?? false,
        offeringId,
      },
      {
        completedExerciseIds: passed
          ? [
              ...new Set([
                ...(previous?.completedExerciseIds ?? []),
                activityId,
              ]),
            ]
          : previous?.completedExerciseIds ?? [],
        points:
          (previous?.points ?? 0) + (passed && !already ? outcome.score : 0),
      }
    );
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

  async deleteOffering(
    offeringId: string
  ): Promise<{ deleted: true; offeringId: string }> {
    const exists = (await this.listPrograms()).some((track) =>
      track.offerings.some((offering) => offering.id === offeringId)
    );
    if (!exists) throw this.offeringNotFound(offeringId);
    if (!(await this.repository.getOwnership(offeringId))) {
      throw this.offeringNotFound(offeringId);
    }
    await this.repository.deleteOffering(offeringId);
    return { deleted: true, offeringId };
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
    const normalized = normalizeCoEditorProfileIds(coEditorProfileIds);
    if (!normalized.success) {
      throw new RpcException({
        statusCode: 400,
        message:
          'coEditorProfileIds must be an array of at most 50 profile UUIDs.',
      });
    }
    return this.repository.setCoEditors(offeringId, normalized.data);
  }
}
