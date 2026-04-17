import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DailyFourEntry {
  id: string;
  userId: string;
  affirmation: string;
  mindfulActivity: string;
  gratitude: string;
  plannedPleasurable: string;
  public: boolean;
  createdAt: Date;
}

export interface CreateDailyFourDto {
  affirmation: string;
  mindfulActivity: string;
  gratitude: string;
  plannedPleasurable: string;
  public?: boolean;
}

export type UpdateDailyFourDto = Partial<CreateDailyFourDto>;

@Injectable({ providedIn: 'root' })
export class DailyFourService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/wellness/daily-four';

  create(dto: CreateDailyFourDto): Observable<DailyFourEntry> {
    return this.http.post<DailyFourEntry>(this.baseUrl, dto);
  }

  getByUserId(userId: string): Observable<DailyFourEntry[]> {
    const params = new HttpParams().set('userId', userId);
    return this.http.get<DailyFourEntry[]>(this.baseUrl, { params });
  }

  getAll(): Observable<DailyFourEntry[]> {
    return this.http.get<DailyFourEntry[]>(this.baseUrl);
  }

  getPublic(): Observable<DailyFourEntry[]> {
    const params = new HttpParams().set('public', 'true');
    return this.http.get<DailyFourEntry[]>(this.baseUrl, { params });
  }

  update(id: string, dto: UpdateDailyFourDto): Observable<DailyFourEntry> {
    return this.http.patch<DailyFourEntry>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
