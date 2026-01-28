import {
  CreateTaskNote,
  QueryTaskNote,
  TaskNote,
  UpdateTaskNote,
} from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProfileService } from '../profile/profile.service';

@Injectable({
  providedIn: 'root',
})
export class TaskNoteService {
  private baseUrl = '/api/project-planning/task-notes';
  
  constructor(
    private readonly http: HttpClient,
    private readonly profileService: ProfileService
  ) {}

  createTaskNote(data: CreateTaskNote) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      throw new Error('User profile is not available');
    }
    data.profileId = currentProfile.id;
    return this.http.post<TaskNote>(`${this.baseUrl}`, data);
  }

  getTaskNotes() {
    return this.http.get<TaskNote[]>(`${this.baseUrl}`);
  }

  queryTaskNotes(query: QueryTaskNote) {
    return this.http.post<TaskNote[]>(`${this.baseUrl}/query`, query);
  }

  getTaskNoteById(id: string) {
    return this.http.get<TaskNote>(`${this.baseUrl}/${id}`);
  }

  updateTaskNote(data: UpdateTaskNote) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      throw new Error('User profile is not available');
    }
    data.updatedBy = currentProfile.id;
    return this.http.patch<TaskNote>(`${this.baseUrl}`, data);
  }

  deleteTaskNote(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getTaskNotesForTask(taskId: string) {
    return this.queryTaskNotes({ taskId });
  }
}
