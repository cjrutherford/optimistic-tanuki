import { Injectable } from '@nestjs/common';
import { AppService } from './app.service';
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
          completedExerciseIds: [],
          points: 0,
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
          completedExerciseIds: [],
          points: 0,
        })
      ).rejects.toMatchObject({ error: { code: NOT_ENROLLED } });
    });

    it('saves progress once the profile is enrolled in the owning offering', async () => {
      await service.enrol('profile-enrolled', 'go-foundations-100-core');

      const progress = await service.saveProgress(
        'profile-enrolled',
        'user-1',
        {
          lessonId: 'go-foundations-basics-variables-types',
          completed: true,
          completedExerciseIds: [],
          points: 0,
        }
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
          completedExerciseIds: [],
          points: 0,
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
    const track = buildDraftProgramTrack('art-1', {
      displayName: 'Intro to Watercolour',
      subjectId: 'art',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: LEARNING_REPOSITORY,
          useValue: {
            listPrograms: () => [track],
            getProgress: () => [],
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
