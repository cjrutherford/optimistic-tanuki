import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { EMPTY, Observable, of, throwError } from 'rxjs';
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
export interface VariantAxis {
  id: string;
  displayName: string;
  options: { id: string; displayName: string }[];
}
export interface Program {
  id: string;
  displayName: string;
  /** Only present on tracks that teach a programming language. */
  supportedLanguageIds?: string[];
  /** What this track's lessons vary along, when they vary at all. */
  variantAxis?: VariantAxis;
  offerings: { id: string; displayName: string; modules: LearningModule[] }[];
}

/**
 * The short label above a track's name, such as "Go" or "Watercolour".
 *
 * This used to read `supportedLanguageIds[0]` directly, which meant a course
 * about anything other than a programming language rendered an empty label or
 * crashed. It now reads the track's own axis, and says nothing when a track
 * has none, because a course that does not vary has nothing to announce.
 */
export function programVariantLabel(program: Program): string {
  return program.variantAxis?.options[0]?.displayName ?? '';
}
export interface CatalogOffering {
  id: string;
  displayName: string;
  description?: string;
  subjectId: string;
  level: number;
  credits: number;
  status: 'draft' | 'published';
  modules: LearningModule[];
}
export interface CatalogTrack {
  id: string;
  displayName: string;
  subjectIds: string[];
  variantAxis?: VariantAxis;
  focuses: { id: string; displayName: string; subjectIds: string[] }[];
  offerings: CatalogOffering[];
}
export interface MyCourse {
  offering: CatalogOffering;
  trackId: string;
  trackDisplayName: string;
  lessonCount: number;
  isOwner: boolean;
}
export interface CatalogSubject {
  subjectId: string;
  displayName: string;
  focusNames: string[];
  courseCount: number;
}
export interface OfferingDetail {
  offering: CatalogOffering;
  trackId: string;
  trackDisplayName: string;
  variantAxis?: VariantAxis;
  lessonCount: number;
  prerequisites: { offeringId: string; displayName: string }[];
  author: { profileId: string; displayName: string } | null;
  isEnrolled: boolean;
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
export interface AnswerableActivityDto {
  type: 'quiz.mcq' | 'writing.response' | 'project.submission' | 'code.run';
  id: string;
  prompt: string;
  lessonId?: string;
  options?: { id: string; text: string }[];
  maxWords?: number;
}
export interface AnswerResult {
  attemptId: string;
  graded: boolean;
  score?: number;
  maxScore?: number;
  feedback: string;
  criteria?: {
    id: string;
    description: string;
    maxPoints: number;
    points: number;
    evidenceFound: boolean;
    comment: string;
  }[];
}
export interface LessonResponse {
  lesson: Lesson;
  content: string;
  exercises: Exercise[];
  /** The work the course author set for this lesson. */
  activities?: AnswerableActivityDto[];
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

  /**
   * The catalog, already filtered by the gateway to what this caller may see.
   *
   * On the server this completes without emitting, rather than emitting an
   * empty list. The difference matters: an empty list is indistinguishable
   * from a catalog with nothing in it, and the entrance page rendered
   * "Nothing has been published here yet" on every first paint because of it.
   * Emitting nothing leaves the page in its loading state until the browser
   * has actually asked.
   */
  catalog(): Observable<CatalogTrack[]> {
    return this.isBrowser
      ? this.http.get<CatalogTrack[]>('/api/learning/programs')
      : EMPTY;
  }

  /** The courses this author owns or co-edits, drafts included. */
  myCourses(): Observable<MyCourse[]> {
    return this.isBrowser
      ? this.http.get<MyCourse[]>('/api/learning/me/courses')
      : EMPTY;
  }

  authorStatus(): Observable<{ isCourseDesigner: boolean }> {
    return this.isBrowser
      ? this.http.get<{ isCourseDesigner: boolean }>('/api/learning/me/author')
      : EMPTY;
  }

  optInAsAuthor(): Observable<{ isCourseDesigner: boolean }> {
    return this.http.post<{ isCourseDesigner: boolean }>(
      '/api/learning/me/author/opt-in',
      {}
    );
  }

  createCourse(input: {
    displayName: string;
    subjectId: string;
    description?: string;
  }): Observable<{ track: { id: string } }> {
    return this.http.post<{ track: { id: string } }>(
      '/api/learning/offerings',
      input
    );
  }

  saveCourse(
    offeringId: string,
    patch: {
      displayName?: string;
      description?: string;
      modules?: unknown[];
      activities?: unknown[];
    }
  ): Observable<unknown> {
    return this.http.put(`/api/learning/offerings/${offeringId}`, patch);
  }

  setCourseStatus(
    offeringId: string,
    status: 'draft' | 'published'
  ): Observable<unknown> {
    return this.http.put(`/api/learning/offerings/${offeringId}/status`, {
      status,
    });
  }

  subjects(): Observable<CatalogSubject[]> {
    return this.isBrowser
      ? this.http.get<CatalogSubject[]>('/api/learning/subjects')
      : EMPTY;
  }

  offering(offeringId: string): Observable<OfferingDetail | null> {
    return this.isBrowser
      ? this.http.get<OfferingDetail>(`/api/learning/offerings/${offeringId}`)
      : EMPTY;
  }

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

  /**
   * Records that a lesson has been read.
   *
   * The only way a learner can make progress in a course with no code in it.
   * The server refuses this without an enrolment, the same as submitting an
   * exercise, so a 409 carries the offering to enrol in.
   */
  markLesson(
    lessonId: string,
    completed: boolean,
    completedExerciseIds: string[],
    points: number
  ): Observable<LessonProgress> {
    return this.http
      .put<LessonProgress>('/api/learning/me/progress', {
        lessonId,
        completed,
        completedExerciseIds,
        points,
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401)
            return throwError(() => new NotSignedInError());
          if (error.status === 409) {
            const offeringId =
              (error.error as { offeringId?: string })?.offeringId ?? '';
            return throwError(() => new NotEnrolledError(offeringId));
          }
          return throwError(() => error);
        })
      );
  }

  /**
   * Answers an activity the course author wrote.
   *
   * Marking happens on the server. A 409 carries the offering to enrol in,
   * exactly as submitting an exercise does.
   */
  answerActivity(
    activityId: string,
    submission: unknown
  ): Observable<AnswerResult> {
    return this.http
      .post<AnswerResult>(`/api/learning/activities/${activityId}/answer`, {
        submission,
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401)
            return throwError(() => new NotSignedInError());
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
