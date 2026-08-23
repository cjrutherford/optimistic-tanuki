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
  /** Which track's runtime this exercise belongs to: go, rust, cpp, typescript. */
  languageId: string;
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

/** Raised when the learner has not enrolled in the course they are working in. */
export class NotEnrolledError extends Error {
  constructor(readonly offeringId: string) {
    super('Enrol to start.');
    this.name = 'NotEnrolledError';
  }
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

  /**
   * Runs code without recording anything, but the run itself is compute and
   * needs a session, so a 401 becomes a NotSignedInError the caller can show.
   */
  run(activityId: string, code: string): Observable<RunResult> {
    return this.http
      .post<RunResult>('/api/learning/runs', {
        activityId,
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
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401)
            return throwError(() => new NotSignedInError());
          // 409 carries the offering the learner needs to enrol in, so the
          // page can ask rather than just reporting that it did not work.
          if (error.status === 409) {
            const offeringId =
              (error.error as { offeringId?: string })?.offeringId ?? '';
            return throwError(() => new NotEnrolledError(offeringId));
          }
          return throwError(() => error);
        })
      );
  }

  /** Enrols the signed-in learner in an offering. */
  enrol(offeringId: string): Observable<{ offeringId: string }> {
    return this.http.post<{ offeringId: string }>('/api/learning/enrolments', {
      offeringId,
    });
  }
}
