import { CreateProject, Project, QueryProject } from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProfileService } from '../profile/profile.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
   baseUrl = '/api/project-planning/projects'
  constructor(
    private readonly http: HttpClient,
    private readonly profileService: ProfileService
  ) { }

  createProject(data: CreateProject) {
    const profile = this.profileService.getCurrentUserProfile();
    if(profile !== undefined && profile === null) {
      throw new Error('No profile selected. Please select a profile before creating a project.');
    }
    data.createdBy = profile.id;
    data.owner = profile.id;
    return this.http.post<Project>(`${this.baseUrl}`, data);
  }

  getProjects() {
    return this.http.get<Project[]>(`${this.baseUrl}`);
  }

  queryProjects(query: QueryProject): Observable<Project[]> {
    return this.http.post<Project[]>(`${this.baseUrl}/query`, {...query});
  }

  getProjectById(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/${id}`);
  }

  updateProject(data: Project): Observable<Project> {
    return this.http.patch<Project>(`${this.baseUrl}`, data);
  }

  deleteProject(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
