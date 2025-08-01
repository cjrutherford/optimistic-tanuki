import { CreateTask, QueryTask, Task } from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProfileService } from '../profile/profile.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private baseUrl = '/api/project-planning/tasks';
  constructor(
    private readonly http: HttpClient,
    private readonly profileService: ProfileService,
  ) { }

  createTask(data: CreateTask) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      throw new Error('User profile is not available');
    }
    data.createdBy = currentProfile.id;
    return this.http.post<Task>(`${this.baseUrl}`, data);
  }

  getTasks() {
    return this.http.get<Task[]>(`${this.baseUrl}`);
  }

  queryTasks(query: QueryTask) {
    return this.http.post<Task[]>(`${this.baseUrl}/query`, query);
  }

  getTaskById(id: string) {
    return this.http.get<Task>(`${this.baseUrl}/${id}`);
  }

  updateTask(data: Task) {
    return this.http.patch<Task>(`${this.baseUrl}`, data);
  }

  deleteTask(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
