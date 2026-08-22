import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

export interface Lesson {
  id: string;
  title: string;
  slug: string;
}
export interface LearningModule {
  id: string;
  title: string;
  lessons: Lesson[];
}
export interface Program {
  id: string;
  displayName: string;
  supportedLanguageIds: string[];
  offerings: { id: string; displayName: string; modules: LearningModule[] }[];
}
export interface DashboardEntry {
  program: Program;
  totals: { lessons: number; exercises: number; points: number };
  progress: {
    completedLessons: number;
    completedExercises: number;
    points: number;
    nextLessonId: string | null;
  };
}
export interface Exercise {
  id: string;
  title: string;
  description: string;
  starterCode: string;
  hints: string[];
  points: number;
  difficulty: string;
}
export interface LessonResponse {
  lesson: Lesson;
  content: string;
  exercises: Exercise[];
}

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  completedExerciseIds: string[];
  points: number;
  updatedAt?: string;
}

export interface RunResult {
  output: string;
  errors: string[];
  testsPassed?: boolean;
}

export interface SubmitResult extends RunResult {
  passed: boolean;
  awardedPoints: number;
  progress: LessonProgress;
}

/** Raised when a save needs a session the visitor does not have. */
export class NotSignedInError extends Error {
  constructor() {
    super('Sign in to save your progress.');
    this.name = 'NotSignedInError';
  }
}

const emptyLesson: LessonResponse = {
  lesson: { id: '', title: '', slug: '' },
  content: '',
  exercises: [],
};

@Injectable({ providedIn: 'root' })
export class LearningDataService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  dashboard(): Observable<DashboardEntry[]> {
    return this.isBrowser
      ? this.http.get<DashboardEntry[]>('/api/learning/dashboard')
      : of<DashboardEntry[]>([]);
  }

  lesson(trackId: string, lessonId: string): Observable<LessonResponse> {
    return this.isBrowser
      ? this.http.get<LessonResponse>(
          `/api/learning/programs/${trackId}/lessons/${lessonId}`
        )
      : of(emptyLesson);
  }

  /**
   * The visitor's saved progress. Anonymous visitors get an empty list from the
   * gateway rather than a 401, so this never needs a session to be called.
   */
  myProgress(): Observable<LessonProgress[]> {
    if (!this.isBrowser) return of<LessonProgress[]>([]);
    return this.http.get<LessonProgress[]>('/api/learning/me/progress').pipe(
      catchError(() => of<LessonProgress[]>([])),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  /** Runs code without recording anything. Open to anonymous visitors. */
  run(activityId: string, code: string): Observable<RunResult> {
    return this.http.post<RunResult>('/api/learning/runs', {
      activityId,
      code,
    });
  }

  /**
   * Runs code against the exercise verifier and records the result. Needs a
   * session, so a 401 becomes a NotSignedInError the caller can show.
   */
  submit(activityId: string, code: string): Observable<SubmitResult> {
    return this.http
      .post<SubmitResult>(`/api/learning/exercises/${activityId}/submit`, {
        code,
      })
      .pipe(
        catchError((error: HttpErrorResponse) =>
          error.status === 401
            ? throwError(() => new NotSignedInError())
            : throwError(() => error)
        )
      );
  }
}
