import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { of } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class LearningDataService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  dashboard() {
    return this.isBrowser
      ? this.http.get<DashboardEntry[]>('/api/learning/dashboard')
      : of<DashboardEntry[]>([]);
  }
  lesson(trackId: string, lessonId: string) {
    return this.isBrowser
      ? this.http.get<LessonResponse>(
          `/api/learning/programs/${trackId}/lessons/${lessonId}`
        )
      : of<LessonResponse>({
          lesson: { id: '', title: '', slug: '' },
          content: '',
          exercises: [],
        });
  }
  run(activityId: string, code: string) {
    return this.http.post<{
      output: string;
      errors: string[];
      testsPassed?: boolean;
    }>('/api/learning/runs', { activityId, code });
  }
}
