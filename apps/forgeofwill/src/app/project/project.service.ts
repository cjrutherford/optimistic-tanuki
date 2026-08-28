import {
  CreateProject,
  Project,
  QueryProject,
} from '@optimistic-tanuki/ui-models';

import { ProjectNarrative } from '@optimistic-tanuki/project-ui';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProfileService } from '../profile/profile.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  baseUrl = '/api/project-planning/projects';
  constructor(
    private readonly http: HttpClient,
    private readonly profileService: ProfileService
  ) {}

  createProject(data: CreateProject) {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) {
      throw new Error(
        'No profile selected. Please select a profile before creating a project.'
      );
    }
    data.createdBy = profile.id;
    data.owner = profile.id;
    return this.http.post<Project>(`${this.baseUrl}`, data);
  }

  getProjects() {
    return this.http.get<Project[]>(`${this.baseUrl}`);
  }

  queryProjects(query: QueryProject) {
    return this.http.post<Project[]>(`${this.baseUrl}/query`, query);
  }

  /**
   * A model's read of one project.
   *
   * Slow by nature, roughly 25 seconds, because a model is reading the whole
   * project. The gateway route is marked model bound for that reason. Callers
   * should treat it as something the reader asks for rather than something the
   * page fetches on load.
   */
  getProjectSummary(id: string) {
    return this.http.get<ProjectNarrative>(`${this.baseUrl}/${id}/summary`);
  }

  getProjectById(id: string) {
    return this.http.get<Project>(`${this.baseUrl}/${id}`);
  }

  updateProject(data: Project) {
    return this.http.patch<Project>(`${this.baseUrl}`, data);
  }

  deleteProject(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  inviteMember(projectId: string, email: string, createdBy: string) {
    const profile = this.profileService.getCurrentUserProfile();
    if (!profile) {
      throw new Error(
        'No profile selected. Please select a profile before inviting members.'
      );
    }

    const invite = {
      projectId,
      email,
      createdBy,
    };

    return this.http.post(`${this.baseUrl}/${projectId}/invite`, invite);
  }
}
