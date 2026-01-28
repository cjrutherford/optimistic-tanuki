import {
  CreateTaskTimeEntry,
  QueryTaskTimeEntry,
  TaskTimeEntry,
  UpdateTaskTimeEntry,
} from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProfileService } from '../profile/profile.service';

@Injectable({
  providedIn: 'root',
})
export class TaskTimeEntryService {
  private baseUrl = '/api/project-planning/task-time-entries';
  
  constructor(
    private readonly http: HttpClient,
    private readonly profileService: ProfileService
  ) {}

  createTaskTimeEntry(data: CreateTaskTimeEntry) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      throw new Error('User profile is not available');
    }
    data.createdBy = currentProfile.id;
    return this.http.post<TaskTimeEntry>(`${this.baseUrl}`, data);
  }

  getTaskTimeEntries() {
    return this.http.get<TaskTimeEntry[]>(`${this.baseUrl}`);
  }

  queryTaskTimeEntries(query: QueryTaskTimeEntry) {
    return this.http.post<TaskTimeEntry[]>(`${this.baseUrl}/query`, query);
  }

  getTaskTimeEntryById(id: string) {
    return this.http.get<TaskTimeEntry>(`${this.baseUrl}/${id}`);
  }

  updateTaskTimeEntry(data: UpdateTaskTimeEntry) {
    return this.http.patch<TaskTimeEntry>(`${this.baseUrl}`, data);
  }

  deleteTaskTimeEntry(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getTaskTimeEntriesForTask(taskId: string) {
    return this.queryTaskTimeEntries({ taskId });
  }

  /**
   * Start a timer for a task
   * Note: startTime is not provided - the backend automatically sets it to the current time
   * This ensures consistency and prevents client-side time manipulation
   */
  startTimer(taskId: string) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      throw new Error('User profile is not available');
    }
    return this.createTaskTimeEntry({
      taskId,
      startTime: new Date(),
      createdBy: currentProfile.id,
    });
  }

  stopTimer(timeEntryId: string) {
    return this.updateTaskTimeEntry({
      id: timeEntryId,
      endTime: new Date(),
    });
  }
}
