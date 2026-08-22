import { Inject, Injectable } from '@nestjs/common';
import {
  Attempt,
  Evaluation,
  LessonProgress,
  ProgramTrack,
  publicExercise,
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

  async getProgress(userId: string): Promise<LessonProgress[]> {
    return await this.repository.getProgress(userId);
  }

  async getDashboard(userId?: string) {
    const programs = await this.listPrograms();
    const progress = userId ? await this.getProgress(userId) : [];
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
      const completedLessons = lessons.filter(
        (lesson) => completedByLesson.get(lesson.id)?.completed
      ).length;
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
            lessons.find(
              (lesson) => !completedByLesson.get(lesson.id)?.completed
            )?.id ?? null,
        },
      };
    });
  }

  async saveProgress(
    userId: string,
    progress: Omit<LessonProgress, 'updatedAt'>
  ): Promise<LessonProgress> {
    return await this.repository.saveProgress(userId, progress);
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

  async submitExercise(userId: string, activityId: string, code: string) {
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
    const previous = (await this.getProgress(userId)).find(
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
    const progress = await this.saveProgress(userId, {
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
