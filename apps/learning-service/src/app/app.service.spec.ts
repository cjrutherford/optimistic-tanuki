import { Injectable } from '@nestjs/common';
import { AppService } from './app.service';
import { GradingService } from './grading.service';

/**
 * A grader that marks nothing. Marking is covered in learning-domain, where
 * it is pure; nothing here should reach for a model.
 */
const gradingStub = () => ({ gradeWriting: jest.fn(async () => undefined) });
import { LEARNING_REPOSITORY, LearningRepository } from './learning.repository';
import { Test } from '@nestjs/testing';
import {
  Attempt,
  buildDraftProgramTrack,
  DraftOfferingInput,
  Enrolment,
  Evaluation,
  LessonProgress,
  OfferingOwnership,
  ProgramTrack,
  sampleProgramTracks,
  tutorialExercises,
  ACTIVITY_NOT_FOUND,
  LESSON_NOT_FOUND,
  NOT_ENROLLED,
  tutorialProgramTracks,
} from '@optimistic-tanuki/learning-domain';
import { OfferingContentPatch } from './learning.repository';
import { randomUUID } from 'crypto';
import { join } from 'path';

@Injectable()
class InMemoryLearningRepository implements LearningRepository {
  private readonly programs: ProgramTrack[] = sampleProgramTracks;
  private readonly attempts = new Map<string, Attempt>();
  private readonly evaluations = new Map<string, Evaluation>();
  private readonly progress = new Map<
    string,
    LessonProgress & { userId: string; profileId: string }
  >();
  private readonly enrolments = new Map<string, Enrolment>();
  private readonly ownerships = new Map<string, OfferingOwnership>();

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
  getProgress(profileId: string) {
    return [...this.progress.values()].filter(
      (item) => item.profileId === profileId
    );
  }
  saveProgress(
    profileId: string,
    userId: string,
    enrolmentId: string,
    input: Omit<LessonProgress, 'updatedAt'>
  ) {
    const value = {
      ...input,
      userId,
      profileId,
      updatedAt: new Date().toISOString(),
    } as LessonProgress & { userId: string; profileId: string };
    this.progress.set(`${profileId}:${input.lessonId}`, value);
    return value;
  }
  /**
   * The same merge the SQL does, so the tests exercise the real semantics:
   * union the exercise, add its points only the first time.
   */
  recordSolvedExercise(
    profileId: string,
    userId: string,
    enrolmentId: string,
    lessonId: string,
    exercise: { id: string; points: number }
  ) {
    const key = `${profileId}:${lessonId}`;
    const existing = this.progress.get(key);
    const already =
      existing?.completedExerciseIds.includes(exercise.id) ?? false;
    const value = {
      lessonId,
      completed: existing?.completed ?? false,
      completedExerciseIds: already
        ? existing?.completedExerciseIds ?? []
        : [...(existing?.completedExerciseIds ?? []), exercise.id],
      points: (existing?.points ?? 0) + (already ? 0 : exercise.points),
      userId,
      profileId,
      updatedAt: new Date().toISOString(),
    } as LessonProgress & { userId: string; profileId: string };
    this.progress.set(key, value);
    return value;
  }
  enrol(profileId: string, offeringId: string) {
    const key = `${profileId}:${offeringId}`;
    const existing = this.enrolments.get(key);
    if (existing) {
      const reactivated: Enrolment = { ...existing, status: 'active' };
      delete reactivated.withdrawnAt;
      this.enrolments.set(key, reactivated);
      return reactivated;
    }
    const enrolment: Enrolment = {
      id: randomUUID(),
      profileId,
      offeringId,
      status: 'active',
      enrolledAt: new Date().toISOString(),
    };
    this.enrolments.set(key, enrolment);
    return enrolment;
  }
  withdraw(profileId: string, offeringId: string) {
    const key = `${profileId}:${offeringId}`;
    const existing = this.enrolments.get(key);
    if (!existing) {
      throw new Error(
        `Profile ${profileId} is not enrolled in offering ${offeringId}`
      );
    }
    const withdrawn: Enrolment = {
      ...existing,
      status: 'withdrawn',
      withdrawnAt: new Date().toISOString(),
    };
    this.enrolments.set(key, withdrawn);
    return withdrawn;
  }
  listEnrolments(profileId: string) {
    return [...this.enrolments.values()].filter(
      (item) => item.profileId === profileId
    );
  }
  getEnrolment(profileId: string, offeringId: string) {
    return this.enrolments.get(`${profileId}:${offeringId}`);
  }
  createOffering(
    ownerProfileId: string,
    offeringId: string,
    input: DraftOfferingInput
  ) {
    const track = buildDraftProgramTrack(offeringId, input);
    this.programs.push(track);
    const ownership: OfferingOwnership = {
      offeringId,
      ownerProfileId,
      coEditorProfileIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.ownerships.set(offeringId, ownership);
    return { track, ownership };
  }
  updateOfferingContent(offeringId: string, patch: OfferingContentPatch) {
    const index = this.programs.findIndex((track) => track.id === offeringId);
    if (index === -1) throw new Error(`Unknown offering: ${offeringId}`);
    const track = this.programs[index];
    const updated: ProgramTrack = {
      ...track,
      ...(patch.displayName !== undefined
        ? { displayName: patch.displayName }
        : {}),
      offerings: track.offerings.map((offering) =>
        offering.id === offeringId
          ? {
              ...offering,
              ...(patch.displayName !== undefined
                ? { displayName: patch.displayName }
                : {}),
              ...(patch.description !== undefined
                ? { description: patch.description }
                : {}),
            }
          : offering
      ),
    };
    this.programs[index] = updated;
    return updated;
  }
  deleteOffering(offeringId: string) {
    const index = this.programs.findIndex((track) => track.id === offeringId);
    if (index !== -1) this.programs.splice(index, 1);
    this.ownerships.delete(offeringId);
  }
  getOwnership(offeringId: string) {
    return this.ownerships.get(offeringId);
  }
  listOwnerships(profileId: string) {
    return [...this.ownerships.values()].filter(
      (ownership) =>
        ownership.ownerProfileId === profileId ||
        ownership.coEditorProfileIds.includes(profileId)
    );
  }
  setCoEditors(offeringId: string, coEditorProfileIds: string[]) {
    const existing = this.ownerships.get(offeringId);
    if (!existing) throw new Error(`No ownership for offering: ${offeringId}`);
    const updated = { ...existing, coEditorProfileIds };
    this.ownerships.set(offeringId, updated);
    return updated;
  }
}

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: GradingService, useValue: gradingStub() },
        { provide: GradingService, useValue: gradingStub() },
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
    expect(
      programs.map((program) => program.supportedLanguageIds?.[0])
    ).toEqual(expect.arrayContaining(['go', 'typescript', 'cpp', 'rust']));
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

  // Go's basics split four topics into an overview plus three detail lessons.
  // Working through the parts should close the overview too, rather than
  // leaving the learner to tick the same material twice.
  describe('sub-lesson roll-up', () => {
    const parts = [
      'go-foundations-basics-basic-types',
      'go-foundations-basics-type-conversion',
      'go-foundations-basics-custom-types',
    ];
    const overview = 'go-foundations-basics-variables-types';

    const profileId = 'profile-learner';

    async function completed(lessonIds: string[]) {
      await service.enrol(profileId, 'go-foundations-100-core');
      for (const lessonId of lessonIds) {
        await service.saveProgress(profileId, 'learner', {
          lessonId,
          completed: true,
        });
      }
      const dashboard = await service.getDashboard(profileId);
      return dashboard.find((entry) => entry.program.id === 'go-foundations')!;
    }

    it('does not close the overview while a part is outstanding', async () => {
      const go = await completed(parts.slice(0, 2));
      expect(go.progress.completedLessons).toBe(2);
    });

    it('closes the overview once every part is done', async () => {
      const go = await completed(parts);
      // Three parts plus the overview they add up to.
      expect(go.progress.completedLessons).toBe(4);
    });

    it('does not offer the overview as the next lesson once it is covered', async () => {
      const go = await completed(parts);
      expect(go.progress.nextLessonId).not.toBe(overview);
    });
  });

  // A learner must never be able to grade themselves. Knowing who wrote a
  // score is what makes that checkable after the fact, so the gateway sends
  // the acting user and it has to survive the trip.
  describe('evaluation audit trail', () => {
    it('keeps the user who recorded the score', async () => {
      const attempt = await service.submitAttempt({
        userId: 'learner-1',
        offeringId: 'systems-100-core',
        activityId: 'systems-100-code-activity',
        activityType: 'code.run',
        submission: { stdout: 'ok' },
        isAsync: false,
      });

      const evaluation = await service.recordEvaluation({
        attemptId: attempt.id,
        mode: 'sync',
        grader: 'human',
        score: 9,
        maxScore: 10,
        feedback: 'Close enough',
        humanOverride: true,
        recordedByUserId: 'grader-7',
      });

      expect(evaluation.recordedByUserId).toBe('grader-7');
    });

    it('accepts an evaluation with no recorded user, for rows that predate it', async () => {
      const attempt = await service.submitAttempt({
        userId: 'learner-2',
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
        score: 10,
        maxScore: 10,
        feedback: 'Passed',
        humanOverride: false,
      });

      expect(evaluation.recordedByUserId).toBeUndefined();
    });
  });

  // Enrolment is the fact that someone is taking an offering. Progress must
  // not be recordable without it, or a lessonId is all it takes to forge
  // completion for a course nobody signed up for.
  describe('enrolment gates progress', () => {
    it('refuses to save progress for a profile with no enrolment', async () => {
      await expect(
        service.saveProgress('profile-unenrolled', 'user-1', {
          lessonId: 'go-foundations-basics-variables-types',
          completed: true,
        })
      ).rejects.toMatchObject({ error: { code: NOT_ENROLLED } });
    });

    it('saves progress once the profile is enrolled in the owning offering', async () => {
      await service.enrol('profile-enrolled', 'go-foundations-100-core');

      const progress = await service.saveProgress(
        'profile-enrolled',
        'user-1',
        { lessonId: 'go-foundations-basics-variables-types', completed: true }
      );

      expect(progress.lessonId).toBe('go-foundations-basics-variables-types');
    });

    it('stops progress after withdrawal', async () => {
      await service.enrol('profile-withdrawn', 'go-foundations-100-core');
      await service.withdraw('profile-withdrawn', 'go-foundations-100-core');

      await expect(
        service.saveProgress('profile-withdrawn', 'user-1', {
          lessonId: 'go-foundations-basics-variables-types',
          completed: true,
        })
      ).rejects.toMatchObject({ error: { code: NOT_ENROLLED } });
    });

    it("lists only a profile's own enrolments", async () => {
      await service.enrol('profile-a', 'go-foundations-100-core');
      await service.enrol('profile-b', 'go-foundations-100-core');

      const enrolments = await service.listEnrolments('profile-a');
      expect(enrolments).toHaveLength(1);
      expect(enrolments[0].profileId).toBe('profile-a');
    });
  });

  // Enrolment is explicit. Taking a course is a decision, and pressing
  // Submit is not that decision, so an unenrolled learner is refused rather
  // than quietly signed up.
  describe('enrolment is required before submitting', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          output: '',
          errors: [],
          timedOut: false,
          testsPassed: true,
        }),
      }) as unknown as typeof fetch;
    });

    afterEach(() => {
      (global.fetch as unknown as jest.Mock | undefined)?.mockRestore?.();
    });

    const goExercise = () =>
      tutorialExercises.find((candidate) => candidate.languageId === 'go')!;

    it('refuses a submission from a learner who has not enrolled', async () => {
      await expect(
        service.submitExercise('profile-new', 'user-new', goExercise().id, '')
      ).rejects.toBeDefined();

      expect(await service.listEnrolments('profile-new')).toEqual([]);
    });

    it('does not enrol anyone as a side effect of submitting', async () => {
      await service
        .submitExercise('profile-side', 'user-side', goExercise().id, '')
        .catch(() => undefined);

      expect(await service.listEnrolments('profile-side')).toEqual([]);
    });

    it('accepts the submission once the learner has enrolled', async () => {
      const exercise = goExercise();
      const offeringId = (await service.listPrograms())
        .flatMap((track) => track.offerings)
        .find((offering) =>
          offering.modules
            .flatMap((module) => module.lessons)
            .some((lesson) => lesson.slug === exercise.lessonSlug)
        )!.id;

      await service.enrol('profile-keen', offeringId);

      const result = await service.submitExercise(
        'profile-keen',
        'user-keen',
        exercise.id,
        ''
      );

      expect(result.progress).toBeDefined();
    });
  });

  // Authorization happens at the gateway; the service trusts the profileId
  // it is given, the same way submitAttempt trusts the userId it is given.
  describe('offering authoring write path', () => {
    it('creates a draft offering owned by the creator', async () => {
      const { track, ownership } = await service.createOffering(
        'designer-profile',
        { displayName: 'Intro to Watercolor', subjectId: 'art' }
      );

      expect(ownership.ownerProfileId).toBe('designer-profile');
      expect(ownership.coEditorProfileIds).toEqual([]);
      expect(track.offerings[0].displayName).toBe('Intro to Watercolor');

      const programs = await service.listPrograms();
      expect(programs.some((program) => program.id === track.id)).toBe(true);
    });

    it('updates the title and description of an existing offering', async () => {
      const { track } = await service.createOffering('designer-profile', {
        displayName: 'Intro to Watercolor',
        subjectId: 'art',
      });

      const updated = await service.updateOffering(track.id, {
        displayName: 'Watercolor Fundamentals',
        description: 'A gentler on-ramp than the old title implied.',
      });

      expect(updated.offerings[0].displayName).toBe('Watercolor Fundamentals');
      expect(updated.offerings[0].description).toBe(
        'A gentler on-ramp than the old title implied.'
      );
    });

    it('deletes an offering and its ownership record', async () => {
      const { track } = await service.createOffering('designer-profile', {
        displayName: 'Intro to Watercolor',
        subjectId: 'art',
      });

      await service.deleteOffering(track.id);

      const programs = await service.listPrograms();
      expect(programs.some((program) => program.id === track.id)).toBe(false);
      expect(await service.getOfferingOwnership(track.id)).toBeUndefined();
    });
  });
});

/**
 * getLesson reads a file off disk, and until this slice it found that file by
 * mapping the track's first language through a hard-coded table of four
 * repository names. A track that taught anything other than those four
 * languages could not have content at all. The track now says where its files
 * live and which rendition to prefer, and nothing here reasons about a
 * language. None of that was covered by a test before.
 */
describe('AppService.getLesson content resolution', () => {
  const CONTENT_ROOT = join(__dirname, '..', '..', 'src', 'assets', 'content');

  async function serviceOver(tracks: ProgramTrack[]) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: GradingService, useValue: gradingStub() },
        { provide: GradingService, useValue: gradingStub() },
        {
          provide: LEARNING_REPOSITORY,
          useValue: {
            listPrograms: () => tracks,
          } as Partial<LearningRepository>,
        },
      ],
    }).compile();
    return moduleRef.get(AppService);
  }

  const goTrack = tutorialProgramTracks.find(
    (track) => track.id === 'go-foundations'
  )!;
  const firstGoLesson = goTrack.offerings[0].modules[0].lessons[0];

  let previousRoot: string | undefined;

  beforeEach(() => {
    previousRoot = process.env.LEARNING_CONTENT_ROOT;
    process.env.LEARNING_CONTENT_ROOT = CONTENT_ROOT;
  });

  afterEach(() => {
    if (previousRoot === undefined) delete process.env.LEARNING_CONTENT_ROOT;
    else process.env.LEARNING_CONTENT_ROOT = previousRoot;
  });

  it('reads a lesson through the track content collection', async () => {
    const service = await serviceOver([goTrack]);

    const result = await service.getLesson(goTrack.id, firstGoLesson.id);

    expect(result.content.length).toBeGreaterThan(0);
    expect(result.lesson.id).toBe(firstGoLesson.id);
  });

  it('still attaches code exercises to a lesson that has a language', async () => {
    const service = await serviceOver([goTrack]);
    const withExercises = goTrack.offerings[0].modules
      .flatMap((module) => module.lessons)
      .find((lesson) =>
        tutorialExercises.some(
          (exercise) =>
            exercise.languageId === 'go' && exercise.lessonSlug === lesson.slug
        )
      )!;

    const result = await service.getLesson(goTrack.id, withExercises.id);

    expect(result.exercises.length).toBeGreaterThan(0);
  });

  it('serves a lesson that varies along no axis at all', async () => {
    const track = {
      ...goTrack,
      id: 'art',
      supportedLanguageIds: undefined,
      variantAxis: undefined,
      offerings: [
        {
          ...goTrack.offerings[0],
          id: 'art-100',
          modules: [
            {
              id: 'art-module',
              title: 'Colour',
              lessons: [
                {
                  ...firstGoLesson,
                  id: 'art-lesson',
                  content: [
                    {
                      format: 'markdown' as const,
                      sourcePath: firstGoLesson.content[0].sourcePath,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as ProgramTrack;
    const service = await serviceOver([track]);

    const result = await service.getLesson('art', 'art-lesson');

    expect(result.content.length).toBeGreaterThan(0);
    // No language means no code exercises, rather than someone else's.
    expect(result.exercises).toEqual([]);
  });

  it('refuses a track that has no content collection', async () => {
    const service = await serviceOver([
      { ...goTrack, contentCollection: undefined } as ProgramTrack,
    ]);

    await expect(
      service.getLesson(goTrack.id, firstGoLesson.id)
    ).rejects.toThrow(/no content collection/);
  });

  it('refuses a source path that climbs out of the collection', async () => {
    const escaping = {
      ...goTrack,
      offerings: [
        {
          ...goTrack.offerings[0],
          modules: [
            {
              id: 'm',
              title: 'm',
              lessons: [
                {
                  ...firstGoLesson,
                  content: [
                    {
                      variantId: 'go',
                      format: 'file-variant' as const,
                      sourcePath: '../../../../etc/passwd',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    } as unknown as ProgramTrack;
    const service = await serviceOver([escaping]);

    await expect(
      service.getLesson(goTrack.id, firstGoLesson.id)
    ).rejects.toThrow(/Invalid lesson source path/);
  });
});

/**
 * The dashboard indexed supportedLanguageIds directly to count a track's
 * exercises. That field is optional now, and strictNullChecks is off in this
 * workspace, so nothing warned that a course with no language would throw and
 * take the whole dashboard down with it.
 */
describe('AppService.getDashboard with a course that has no language', () => {
  it('reports no exercises rather than throwing', async () => {
    const draft = buildDraftProgramTrack('art-1', {
      displayName: 'Intro to Watercolour',
      subjectId: 'art',
    });
    // Published, because the dashboard only shows what a learner may see, and
    // this test is about a course with no language rather than about drafts.
    const track = {
      ...draft,
      offerings: [{ ...draft.offerings[0], status: 'published' as const }],
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: GradingService, useValue: gradingStub() },
        { provide: GradingService, useValue: gradingStub() },
        {
          provide: LEARNING_REPOSITORY,
          useValue: {
            listPrograms: () => [track],
            getProgress: () => [],
            getOwnership: () => undefined,
          } as Partial<LearningRepository>,
        },
      ],
    }).compile();

    const dashboard = await moduleRef.get(AppService).getDashboard('profile-1');

    expect(dashboard).toHaveLength(1);
    expect(dashboard[0].totals.exercises).toBe(0);
    expect(dashboard[0].totals.points).toBe(0);
  });
});

/**
 * Where a course written inside the product actually lives, and who can see it
 * before it is finished.
 */
describe('AppService authored content', () => {
  function art(status: 'draft' | 'published', body: string) {
    return {
      id: 'art-1',
      displayName: 'Intro to Watercolour',
      subjectIds: ['art'],
      focuses: [{ id: 'f', displayName: 'Art', subjectIds: ['art'] }],
      offerings: [
        {
          id: 'art-1',
          type: 'course',
          displayName: 'Intro to Watercolour',
          subjectId: 'art',
          level: 100,
          credits: 1,
          outcomeTags: ['art'],
          status,
          modules: [
            {
              id: 'm',
              title: 'Pigments',
              lessons: [
                {
                  id: 'art-lesson-1',
                  title: 'Three pigments',
                  slug: 'three-pigments',
                  content: [{ format: 'markdown', body }],
                },
              ],
            },
          ],
          activities: [],
        },
      ],
      requirements: {
        id: 'r',
        operator: 'AND',
        children: [{ kind: 'offering', offeringId: 'art-1' }],
      },
    } as unknown as ProgramTrack;
  }

  const ownership = {
    offeringId: 'art-1',
    ownerProfileId: 'author-profile',
    coEditorProfileIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  async function serviceOver(tracks: ProgramTrack[]) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: GradingService, useValue: gradingStub() },
        { provide: GradingService, useValue: gradingStub() },
        {
          provide: LEARNING_REPOSITORY,
          useValue: {
            listPrograms: () => tracks,
            getProgress: () => [],
            getOwnership: (offeringId: string) =>
              offeringId === 'art-1' ? ownership : undefined,
            enrol: (profileId: string, offeringId: string) => ({
              id: 'e-1',
              profileId,
              offeringId,
              status: 'active',
              enrolledAt: '2026-01-01T00:00:00.000Z',
            }),
          } as Partial<LearningRepository>,
        },
      ],
    }).compile();
    return moduleRef.get(AppService);
  }

  // An author has no way to add a file to the repository, so a lesson they
  // wrote has to carry its own words. This path did not exist before.
  it('serves a lesson from its own body, with no file anywhere', async () => {
    const service = await serviceOver([art('published', '# Three pigments')]);

    const result = await service.getLesson('art-1', 'art-lesson-1');

    expect(result.content).toBe('# Three pigments');
    expect(result.exercises).toEqual([]);
  });

  it('needs no content collection for a course that carries its own text', async () => {
    const track = art('published', 'words');

    expect(track.contentCollection).toBeUndefined();
    await expect(
      (await serviceOver([track])).getLesson('art-1', 'art-lesson-1')
    ).resolves.toBeDefined();
  });

  describe('who sees a draft', () => {
    it('hides it from a learner', async () => {
      const service = await serviceOver([art('draft', 'words')]);

      expect(await service.listCatalog({ profileId: 'learner' })).toEqual([]);
    });

    it('hides it from an anonymous visitor', async () => {
      const service = await serviceOver([art('draft', 'words')]);

      expect(await service.listCatalog({})).toEqual([]);
    });

    it('shows it to the author writing it', async () => {
      const service = await serviceOver([art('draft', 'words')]);

      const catalog = await service.listCatalog({
        profileId: 'author-profile',
      });

      expect(catalog.map((track) => track.id)).toEqual(['art-1']);
    });

    it('shows it to somebody who answers for the platform', async () => {
      const service = await serviceOver([art('draft', 'words')]);

      const catalog = await service.listCatalog({
        profileId: 'admin-profile',
        seesEveryDraft: true,
      });

      expect(catalog.map((track) => track.id)).toEqual(['art-1']);
    });

    it('shows it to everyone once published', async () => {
      const service = await serviceOver([art('published', 'words')]);

      expect(
        (await service.listCatalog({ profileId: 'learner' })).map(
          (track) => track.id
        )
      ).toEqual(['art-1']);
    });

    // A draft on a stranger's dashboard would be a course they cannot open.
    it('keeps a draft off a learner dashboard', async () => {
      const service = await serviceOver([art('draft', 'words')]);

      expect(await service.getDashboard('learner')).toEqual([]);
    });

    // The unfiltered read still has to reach it, or the author could not edit
    // the course they can see.
    it('still reaches a draft through the unfiltered read', async () => {
      const service = await serviceOver([art('draft', 'words')]);

      expect((await service.listPrograms()).map((track) => track.id)).toEqual([
        'art-1',
      ]);
    });
  });

  /**
   * Found by probing the running service, not by a test: the catalog hid the
   * draft, and then this route handed the same course to an anonymous caller
   * who guessed its two ids.
   */
  describe('reading a draft lesson directly', () => {
    it('refuses an anonymous caller who knows the ids', async () => {
      const service = await serviceOver([art('draft', 'secret words')]);

      await expect(
        service.getLesson('art-1', 'art-lesson-1', {})
      ).rejects.toMatchObject({ error: { code: LESSON_NOT_FOUND } });
    });

    it('refuses a signed-in learner who does not own it', async () => {
      const service = await serviceOver([art('draft', 'secret words')]);

      await expect(
        service.getLesson('art-1', 'art-lesson-1', { profileId: 'learner' })
      ).rejects.toMatchObject({ error: { code: LESSON_NOT_FOUND } });
    });

    // Not "you may not read this course", which would confirm it exists.
    it('does not admit that the course exists', async () => {
      const service = await serviceOver([art('draft', 'secret words')]);

      // A structured code, not a message, so the gateway can recognise it
      // after it crosses the microservice boundary.
      await expect(
        service.getLesson('art-1', 'art-lesson-1', {})
      ).rejects.toMatchObject({
        error: { code: LESSON_NOT_FOUND, trackId: 'art-1' },
      });
    });

    it('lets the author read their own draft', async () => {
      const service = await serviceOver([art('draft', 'secret words')]);

      await expect(
        service.getLesson('art-1', 'art-lesson-1', {
          profileId: 'author-profile',
        })
      ).resolves.toMatchObject({ content: 'secret words' });
    });

    it('lets somebody who answers for the platform read it', async () => {
      const service = await serviceOver([art('draft', 'secret words')]);

      await expect(
        service.getLesson('art-1', 'art-lesson-1', {
          profileId: 'admin',
          seesEveryDraft: true,
        })
      ).resolves.toBeDefined();
    });

    it('lets anyone read it once published', async () => {
      const service = await serviceOver([art('published', 'open words')]);

      await expect(
        service.getLesson('art-1', 'art-lesson-1', {})
      ).resolves.toMatchObject({ content: 'open words' });
    });
  });

  describe('enrolment', () => {
    it('refuses an unfinished course', async () => {
      const service = await serviceOver([art('draft', 'words')]);

      await expect(service.enrol('learner', 'art-1')).rejects.toThrow(
        /not published/
      );
    });

    it('allows a published one', async () => {
      const service = await serviceOver([art('published', 'words')]);

      await expect(service.enrol('learner', 'art-1')).resolves.toMatchObject({
        offeringId: 'art-1',
        status: 'active',
      });
    });
  });

  /**
   * The course page and the editor are the same route, and they want opposite
   * things from it.
   *
   * This route returned the offering exactly as listPrograms holds it, which
   * keeps the mark scheme so grading can read answers back out by id. That
   * meant every quiz answer key and sample response in every course was
   * readable by anyone who fetched the course, signed in or not. It shipped
   * that way and no test here noticed, so both directions are pinned below.
   */
  describe('what the offering route gives away', () => {
    /** The same art course, plus work that has a right answer. */
    function marked(status: 'draft' | 'published') {
      const track = art(status, 'words') as unknown as ProgramTrack;
      track.offerings[0].activities = [
        {
          id: 'a-quiz',
          type: 'quiz.mcq',
          lessonId: 'art-lesson-1',
          prompt: 'Which pigment is not a primary?',
          options: [
            { id: 'o1', text: 'Green' },
            { id: 'o2', text: 'Red' },
          ],
          correctOptionIds: ['o1'],
        },
        {
          id: 'a-write',
          type: 'writing.response',
          lessonId: 'art-lesson-1',
          prompt: 'Explain why.',
          rubric: 'Names the primaries.',
          sampleResponse: 'Green is mixed from blue and yellow.',
        },
      ] as unknown as ProgramTrack['offerings'][number]['activities'];
      return track;
    }

    async function activitiesSeenBy(profileId?: string) {
      const service = await serviceOver([marked('published')]);
      const detail = await service.getOfferingDetail(
        'art-1',
        profileId ? { profileId } : {}
      );
      return detail.offering.activities as unknown as Record<string, unknown>[];
    }

    it('withholds the answer key from an anonymous visitor', async () => {
      const [quiz, writing] = await activitiesSeenBy();

      expect(quiz).not.toHaveProperty('correctOptionIds');
      expect(writing).not.toHaveProperty('sampleResponse');
      // The question itself still has to arrive, or the page is blank.
      expect(quiz['options']).toHaveLength(2);
    });

    it('withholds it from a signed-in learner who does not own the course', async () => {
      const [quiz, writing] = await activitiesSeenBy('some-learner');

      expect(quiz).not.toHaveProperty('correctOptionIds');
      expect(writing).not.toHaveProperty('sampleResponse');
    });

    /**
     * The other half, and the more dangerous one to get wrong. The editor
     * loads from this route and saves activities back as a full replacement,
     * so an author handed a stripped copy would save it over their own
     * answers the next time they touched anything.
     */
    it('gives the author their own answers back', async () => {
      const [quiz, writing] = await activitiesSeenBy('author-profile');

      expect(quiz['correctOptionIds']).toEqual(['o1']);
      expect(writing['sampleResponse']).toBe(
        'Green is mixed from blue and yellow.'
      );
    });

    it('still hides a draft from everyone but its author', async () => {
      // Reading ownership for published courses too is what makes the check
      // above possible; this makes sure it did not loosen the draft rule.
      const service = await serviceOver([marked('draft')]);

      await expect(
        service.getOfferingDetail('art-1', { profileId: 'some-learner' })
      ).rejects.toThrow();
      await expect(
        service.getOfferingDetail('art-1', { profileId: 'author-profile' })
      ).resolves.toBeDefined();
    });
  });
});

/**
 * Nothing else lists a draft to the person writing it: the catalog hides
 * drafts by design, and the dashboard shows only what a learner may see.
 */
describe('AppService.listMyOfferings', () => {
  function ownership(
    offeringId: string,
    ownerProfileId: string,
    coEditorProfileIds: string[] = []
  ) {
    return {
      offeringId,
      ownerProfileId,
      coEditorProfileIds,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  function course(id: string, status: 'draft' | 'published') {
    return {
      id,
      displayName: id,
      subjectIds: ['art'],
      focuses: [{ id: 'f', displayName: 'Art', subjectIds: ['art'] }],
      offerings: [
        {
          id,
          type: 'course',
          displayName: id,
          subjectId: 'art',
          level: 100,
          credits: 1,
          outcomeTags: ['art'],
          status,
          modules: [
            {
              id: 'm',
              title: 'M',
              lessons: [
                {
                  id: 'l',
                  title: 'l',
                  slug: 'l',
                  content: [{ format: 'markdown', body: 'words' }],
                },
              ],
            },
          ],
          activities: [],
        },
      ],
      requirements: {
        id: 'r',
        operator: 'AND',
        children: [{ kind: 'offering', offeringId: id }],
      },
    } as unknown as ProgramTrack;
  }

  async function serviceWith(
    tracks: ProgramTrack[],
    ownerships: ReturnType<typeof ownership>[]
  ) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: GradingService, useValue: gradingStub() },
        { provide: GradingService, useValue: gradingStub() },
        {
          provide: LEARNING_REPOSITORY,
          useValue: {
            listPrograms: () => tracks,
            listOwnerships: (profileId: string) =>
              ownerships.filter(
                (item) =>
                  item.ownerProfileId === profileId ||
                  item.coEditorProfileIds.includes(profileId)
              ),
          } as Partial<LearningRepository>,
        },
      ],
    }).compile();
    return moduleRef.get(AppService);
  }

  it('lists a draft to the author who owns it', async () => {
    const service = await serviceWith(
      [course('mine', 'draft')],
      [ownership('mine', 'author')]
    );

    const mine = await service.listMyOfferings('author');

    expect(mine.map((item) => item.offering.id)).toEqual(['mine']);
    expect(mine[0].offering.status).toBe('draft');
  });

  it('lists published courses too, since an author still maintains them', async () => {
    const service = await serviceWith(
      [course('mine', 'published')],
      [ownership('mine', 'author')]
    );

    expect(await service.listMyOfferings('author')).toHaveLength(1);
  });

  it('lists a course somebody invited them to co-edit', async () => {
    const service = await serviceWith(
      [course('theirs', 'draft')],
      [ownership('theirs', 'author', ['helper'])]
    );

    const theirs = await service.listMyOfferings('helper');

    expect(theirs.map((item) => item.offering.id)).toEqual(['theirs']);
  });

  // Publishing is the owner's call, so an author needs to know which is which.
  it('says which of them are theirs to publish', async () => {
    const service = await serviceWith(
      [course('mine', 'draft'), course('theirs', 'draft')],
      [ownership('mine', 'author'), ownership('theirs', 'someone', ['author'])]
    );

    const all = await service.listMyOfferings('author');

    expect(all.map((item) => [item.offering.id, item.isOwner])).toEqual([
      ['mine', true],
      ['theirs', false],
    ]);
  });

  it("does not list somebody else's course", async () => {
    const service = await serviceWith(
      [course('theirs', 'draft')],
      [ownership('theirs', 'someone')]
    );

    expect(await service.listMyOfferings('author')).toEqual([]);
  });

  it('reads nothing at all for somebody who has written nothing', async () => {
    const listPrograms = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: GradingService, useValue: gradingStub() },
        { provide: GradingService, useValue: gradingStub() },
        {
          provide: LEARNING_REPOSITORY,
          useValue: {
            listPrograms,
            listOwnerships: () => [],
          } as Partial<LearningRepository>,
        },
      ],
    }).compile();

    expect(await moduleRef.get(AppService).listMyOfferings('nobody')).toEqual(
      []
    );
    expect(listPrograms).not.toHaveBeenCalled();
  });

  it('counts the lessons in each one', async () => {
    const service = await serviceWith(
      [course('mine', 'draft')],
      [ownership('mine', 'author')]
    );

    expect((await service.listMyOfferings('author'))[0].lessonCount).toBe(1);
  });
});

/**
 * Answering an activity an author wrote. Marking itself is pure and covered in
 * learning-domain; what matters here is that nothing is recorded for somebody
 * who has not enrolled, and that an answer is never lost when marking fails.
 */
describe('AppService.answerActivity', () => {
  const rubric = {
    id: 'r1',
    title: 'Reading a tide table',
    criteria: [
      { id: 'range', description: 'Explains the range.', maxPoints: 2 },
    ],
  };

  function course(activities: unknown[]) {
    return {
      id: 'art-1',
      displayName: 'Reading Tide Tables',
      subjectIds: ['seamanship'],
      focuses: [{ id: 'f', displayName: 'F', subjectIds: ['seamanship'] }],
      offerings: [
        {
          id: 'art-1',
          type: 'course',
          displayName: 'Reading Tide Tables',
          subjectId: 'seamanship',
          level: 100,
          credits: 1,
          outcomeTags: ['x'],
          status: 'published',
          modules: [
            {
              id: 'm',
              title: 'm',
              lessons: [
                {
                  id: 'l1',
                  title: 'l',
                  slug: 'l',
                  content: [{ format: 'markdown', body: 'words' }],
                },
              ],
            },
          ],
          activities,
        },
      ],
      requirements: {
        id: 'r',
        operator: 'AND',
        children: [{ kind: 'offering', offeringId: 'art-1' }],
      },
    } as unknown as ProgramTrack;
  }

  const mcq = {
    type: 'quiz.mcq',
    id: 'q1',
    prompt: 'Which is cool?',
    lessonId: 'l1',
    options: [
      { id: 'o1', text: 'Ultramarine' },
      { id: 'o2', text: 'Cadmium red' },
    ],
    correctOptionIds: ['o1'],
  };

  const written = {
    type: 'writing.response',
    id: 'w1',
    prompt: 'What is the range?',
    lessonId: 'l1',
    rubric,
  };

  async function build(
    activities: unknown[],
    options: { enrolled?: boolean; grade?: unknown } = {}
  ) {
    const saved: unknown[] = [];
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: GradingService,
          useValue: {
            gradeWriting: jest.fn(async () => options.grade),
          },
        },
        {
          provide: LEARNING_REPOSITORY,
          useValue: {
            listPrograms: () => [course(activities)],
            getEnrolment: () =>
              options.enrolled === false
                ? undefined
                : {
                    id: 'e1',
                    profileId: 'p1',
                    offeringId: 'art-1',
                    status: 'active' as const,
                    enrolledAt: '2026-01-01T00:00:00.000Z',
                  },
            getProgress: () => [],
            createAttempt: (attempt: unknown) => attempt,
            getAttempt: () => undefined,
            saveAttempt: (attempt: unknown) => attempt,
            recordEvaluation: (evaluation: unknown) => {
              saved.push(evaluation);
              return evaluation;
            },
            saveProgress: (
              _p: string,
              _u: string,
              _e: string,
              progress: unknown
            ) => progress,
          } as Partial<LearningRepository>,
        },
      ],
    }).compile();
    return { service: moduleRef.get(AppService), evaluations: saved };
  }

  it('marks a multiple choice without asking any model', async () => {
    const { service } = await build([mcq]);

    const result = await service.answerActivity('p1', 'u1', 'q1', ['o1']);

    expect(result).toMatchObject({ graded: true, score: 1, maxScore: 1 });
  });

  it('marks a wrong choice as wrong', async () => {
    const { service } = await build([mcq]);

    expect((await service.answerActivity('p1', 'u1', 'q1', ['o2'])).score).toBe(
      0
    );
  });

  it('records who graded it and how', async () => {
    const { service, evaluations } = await build([mcq]);

    await service.answerActivity('p1', 'u1', 'q1', ['o1']);

    expect(evaluations[0]).toMatchObject({ grader: 'auto', mode: 'sync' });
  });

  it('marks a written answer against the author rubric', async () => {
    const { service, evaluations } = await build([written], {
      grade: { score: 2, maxScore: 2, feedback: 'Good.', criteria: [] },
    });

    const result = await service.answerActivity('p1', 'u1', 'w1', 'The range.');

    expect(result).toMatchObject({ graded: true, score: 2 });
    expect(evaluations[0]).toMatchObject({ grader: 'llm', mode: 'async' });
  });

  it('keeps the rubric with the evaluation, so a mark can be read back', async () => {
    const { service, evaluations } = await build([written], {
      grade: { score: 2, maxScore: 2, feedback: 'Good.', criteria: [] },
    });

    await service.answerActivity('p1', 'u1', 'w1', 'The range.');

    expect(evaluations[0]).toMatchObject({ rubric });
  });

  // A grader that is unreachable must not lose a learner's work.
  it('records an answer it could not mark, rather than failing', async () => {
    const { service, evaluations } = await build([written], {
      grade: undefined,
    });

    const result = await service.answerActivity('p1', 'u1', 'w1', 'Something.');

    expect(result.graded).toBe(false);
    expect(result.attemptId).toBeTruthy();
    expect(result.feedback).toContain('marked by a person');
    expect(evaluations).toHaveLength(0);
  });

  it('leaves an answer with no rubric for a person', async () => {
    const { service } = await build([{ ...written, rubric: undefined }]);

    expect((await service.answerActivity('p1', 'u1', 'w1', 'Hi')).graded).toBe(
      false
    );
  });

  // The same rule as submitting an exercise.
  it('refuses somebody who has not enrolled', async () => {
    const { service } = await build([mcq], { enrolled: false });

    await expect(
      service.answerActivity('p1', 'u1', 'q1', ['o1'])
    ).rejects.toMatchObject({ error: { code: NOT_ENROLLED } });
  });

  it('refuses an activity nobody offered', async () => {
    const { service } = await build([mcq]);

    await expect(
      service.answerActivity('p1', 'u1', 'made-up', ['o1'])
    ).rejects.toMatchObject({ error: { code: ACTIVITY_NOT_FOUND } });
  });

  it('counts a fully correct answer towards the lesson', async () => {
    const { service } = await build([mcq]);

    const result = await service.answerActivity('p1', 'u1', 'q1', ['o1']);

    expect(result.progress).toMatchObject({
      lessonId: 'l1',
      completedExerciseIds: ['q1'],
    });
  });

  it('does not count a wrong answer towards the lesson', async () => {
    const { service } = await build([mcq]);

    const result = await service.answerActivity('p1', 'u1', 'q1', ['o2']);

    expect(result.progress).toMatchObject({ completedExerciseIds: [] });
  });

  it('records an activity that belongs to no lesson without progress', async () => {
    const { service } = await build([{ ...mcq, lessonId: undefined }]);

    const result = await service.answerActivity('p1', 'u1', 'q1', ['o1']);

    expect(result.graded).toBe(true);
    expect(result.progress).toBeUndefined();
  });
});
