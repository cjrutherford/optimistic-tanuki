import { Inject, Injectable } from '@nestjs/common';
import {
  Attempt,
  Enrolment,
  Evaluation,
  LessonProgress,
  ProgramTrack,
  publicExercise,
  rollUpCompletedLessons,
  tutorialExercises,
} from '@optimistic-tanuki/learning-domain';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join, normalize } from 'path';
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

  async getLesson(trackId: string, lessonId: string) {
    const track = (await this.listPrograms()).find(
      (candidate) => candidate.id === trackId
    );
    if (!track) throw new Error(`Unknown learning track: ${trackId}`);
    const lesson = track.offerings
      .flatMap((offering) => offering.modules)
      .flatMap((module) => module.lessons)
      .find((candidate) => candidate.id === lessonId);
    if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
    const languageId = track.supportedLanguageIds[0] as
      | 'typescript'
      | 'go'
      | 'cpp'
      | 'rust';
    const repository = {
      typescript: 'letsgots',
      go: 'letsgogo',
      cpp: 'letsgocpp',
      rust: 'letsgorust',
    }[languageId];
    const sourcePath = lesson.languageVariants[0].sourcePath.replace(
      /^src\/content\//,
      ''
    );
    const contentRoot =
      process.env.LEARNING_CONTENT_ROOT ??
      join(process.cwd(), 'assets', 'content');
    const safePath = normalize(join(contentRoot, repository, sourcePath));
    if (!safePath.startsWith(normalize(join(contentRoot, repository))))
      throw new Error('Invalid lesson source path');
    const content = await readFile(safePath, 'utf8');
    return {
      lesson,
      content,
      exercises: tutorialExercises
        .filter(
          (exercise) =>
            exercise.languageId === languageId &&
            exercise.lessonSlug === lesson.slug
        )
        .map(publicExercise),
    };
  }

  async getProgress(profileId: string): Promise<LessonProgress[]> {
    return await this.repository.getProgress(profileId);
  }

  async getDashboard(profileId?: string) {
    const programs = await this.listPrograms();
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
      const exercises = tutorialExercises.filter(
        (exercise) => exercise.languageId === program.supportedLanguageIds[0]
      );
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
      throw new Error(
        `Profile ${profileId} must be enrolled in offering ${offeringId} before recording progress on lesson ${progress.lessonId}`
      );
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
          item.languageVariants.some(
            (variant) => variant.languageId === exercise.languageId
          )
      );
    if (!lesson)
      throw new Error(`Exercise ${activityId} is not attached to a lesson`);
    // Working an exercise in a course is how someone takes that course, so
    // the first submission enrols them. saveProgress stays strict and refuses
    // progress without an enrolment; this is what makes sure there is one,
    // rather than making a learner find an enrol button before they can start.
    await this.enrol(profileId, await this.findOfferingIdForLesson(lesson.id));

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
}
