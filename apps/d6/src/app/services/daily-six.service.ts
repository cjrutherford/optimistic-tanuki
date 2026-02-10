import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DailySixEntry {
  id: string;
  userId: string;
  affirmation: string;
  judgement: string;
  nonJudgement: string;
  mindfulActivity: string;
  gratitude: string;
  public: boolean;
  createdAt: Date;
}

export interface CreateDailySixDto {
  affirmation: string;
  judgement: string;
  nonJudgement: string;
  mindfulActivity: string;
  gratitude: string;
  public?: boolean;
}

export interface UpdateDailySixDto extends Partial<CreateDailySixDto> {}

@Injectable({ providedIn: 'root' })
export class DailySixService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/wellness/daily-six';

  create(dto: CreateDailySixDto): Observable<DailySixEntry> {
    return this.http.post<DailySixEntry>(this.baseUrl, dto);
  }

  getByUserId(userId: string): Observable<DailySixEntry[]> {
    const params = new HttpParams().set('userId', userId);
    return this.http.get<DailySixEntry[]>(this.baseUrl, { params });
  }

  getAll(): Observable<DailySixEntry[]> {
    return this.http.get<DailySixEntry[]>(this.baseUrl);
  }

  getPublic(): Observable<DailySixEntry[]> {
    const params = new HttpParams().set('public', 'true');
    return this.http.get<DailySixEntry[]>(this.baseUrl, { params });
  }

  update(id: string, dto: UpdateDailySixDto): Observable<DailySixEntry> {
    return this.http.patch<DailySixEntry>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
