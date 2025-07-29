import { CreateProject, Project, QueryProject } from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
   baseUrl = '/api/project-planning/projects'
  constructor(private readonly http: HttpClient) { }

  createProject(data: CreateProject) {
    return this.http.post<Project>(`${this.baseUrl}`, data);
  }

  getProjects() {
    return this.http.get<Project[]>(`${this.baseUrl}`);
  }

  queryProjects(query: QueryProject) {
    return this.http.post<Project[]>(`${this.baseUrl}/query`, query);
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
}
