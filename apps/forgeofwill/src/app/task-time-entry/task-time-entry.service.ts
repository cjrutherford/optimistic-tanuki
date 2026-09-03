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

  /** Everything recorded on a project, for the panel that shows time per task. */
  getTaskTimeEntriesForProject(projectId: string) {
    return this.queryTaskTimeEntries({ projectId });
  }

  /**
   * Starts a timer on a task.
   *
   * No start time goes with it. The server reads its own clock, so the
   * duration cannot be shifted by a wrong clock or a curious client. The
   * comment here already said so while the code sent one anyway.
   */
  startTimer(taskId: string) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      throw new Error('User profile is not available');
    }
    return this.createTaskTimeEntry({
      taskId,
      createdBy: currentProfile.id,
    });
  }

  /**
   * Stops a running timer.
   *
   * Its own route rather than an update carrying an end time. Stopping through
   * update meant the client decided when the work ended and how long it took,
   * and since it sent only an end time, every finished entry recorded zero
   * seconds.
   */
  stopTimer(timeEntryId: string) {
    return this.http.patch<TaskTimeEntry>(
      `${this.baseUrl}/${timeEntryId}/stop`,
      {}
    );
  }
}
