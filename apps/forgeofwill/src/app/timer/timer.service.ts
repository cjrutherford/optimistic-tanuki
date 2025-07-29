import { CreateTimer, Timer } from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TimerService {
  private baseUrl = '/api/project-planning/timers';
  constructor(private readonly http: HttpClient) { }

  createTimer(data: CreateTimer) {
    return this.http.post<Timer>(`${this.baseUrl}`, data);
  }

  getTimers() {
    return this.http.get<Timer[]>(`${this.baseUrl}`);
  }

  getTimerById(id: string) {
    return this.http.get<Timer>(`${this.baseUrl}/${id}`);
  }

  updateTimer(data: Timer) {
    return this.http.patch<Timer>(`${this.baseUrl}`, data);
  }

  deleteTimer(id: string) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
