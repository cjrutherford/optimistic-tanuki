import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest, map } from 'rxjs';
import { DailyFourEntry } from './daily-four.service';
import { DailySixEntry } from './daily-six.service';

export interface DailyPostDto {
  id: string;
  createdAt: Date;
  userId: string;
  public: boolean;
  prompts: { [key: string]: string };
  userAvatar?: string;
  userName?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedService {
  private readonly http = inject(HttpClient);
  private readonly dailyFourUrl = '/api/wellness/daily-four';
  private readonly dailySixUrl = '/api/wellness/daily-six';

  loadPosts(): Observable<DailyPostDto[]> {
    return combineLatest([
      this.getPublicDailyFours(),
      this.getPublicDailySixes(),
    ]).pipe(
      map(([dailyFours, dailySixes]) => {
        const posts = [...dailyFours, ...dailySixes].sort((a, b) => {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        return posts;
      })
    );
  }

  private getPublicDailyFours(): Observable<DailyPostDto[]> {
    return this.http
      .get<DailyFourEntry[]>(`${this.dailyFourUrl}?public=true`)
      .pipe(map((entries) => entries.map((e) => this.mapToPostDto(e))));
  }

  private getPublicDailySixes(): Observable<DailyPostDto[]> {
    return this.http
      .get<DailySixEntry[]>(`${this.dailySixUrl}?public=true`)
      .pipe(map((entries) => entries.map((e) => this.mapToPostDto(e))));
  }

  private mapToPostDto(
    entry: DailyFourEntry | DailySixEntry
  ): DailyPostDto {
    const prompts: { [key: string]: string } = {};
    
    // Extract prompt fields (excluding metadata fields)
    const excludedFields = ['id', 'createdAt', 'userId', 'public'];
    for (const [key, value] of Object.entries(entry)) {
      if (!excludedFields.includes(key) && typeof value === 'string') {
        prompts[key] = value;
      }
    }

    return {
      id: entry.id,
      createdAt: entry.createdAt,
      userId: entry.userId,
      public: entry.public,
      prompts,
    };
  }
}
