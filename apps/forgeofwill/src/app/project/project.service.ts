import {
  CreateProject,
  Project,
  ProjectAnalytics,
  QueryProject,
  TagAnalytics,
} from '@optimistic-tanuki/ui-models';

import {
  AiChange,
  AiChangeDecision,
  ProjectNarrative,
} from '@optimistic-tanuki/project-ui';
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

  /**
   * Changes an agent proposed on this project, decided and undecided.
   *
   * A project can require approval before anything is written. Nothing in the
   * app could read those proposals until this, so the flag meant work stopped
   * somewhere a person could not reach it.
   */
  getAiChanges(projectId: string) {
    return this.http.get<AiChange[]>(`${this.baseUrl}/${projectId}/ai-changes`);
  }

  /** Approving carries the change out, so this is not only a status write. */
  reviewAiChange(decision: AiChangeDecision) {
    const { id, ...rest } = decision;
    return this.http.patch<AiChange>(`${this.baseUrl}/ai-changes/${id}`, rest);
  }

  /**
   * Asks a model what the project needs. Everything it answers is filed for
   * approval, so this proposes and never applies.
   *
   * Slow like the summary, and marked model bound on the gateway for the same
   * reason.
   */
  requestAiProposals(projectId: string) {
    return this.http.post<{
      model: string | null;
      discarded: number;
      unavailable?: string;
      changes?: AiChange[];
    }>(`${this.baseUrl}/${projectId}/ai-proposals`, {});
  }

  /**
   * Tells the assistant to do something on this project.
   *
   * It acts through the same MCP tools as any other client and as the signed
   * in person, so the approval gate applies: on a project that requires
   * approval nothing it does reaches the board until somebody agrees.
   */
  instructAssistant(
    projectId: string,
    instruction: string,
    history: { role: 'person' | 'assistant'; text: string }[] = []
  ) {
    return this.http.post<{
      said: string;
      used: { tool: string; result: string }[];
      awaitingApproval: boolean;
      model: string | null;
      unavailable?: string;
    }>(`${this.baseUrl}/${projectId}/ai-act`, { instruction, history });
  }

  /**
   * Where the time went on this project, per task and per tag.
   *
   * Only meaningful since time entries started recording real durations.
   */
  getProjectAnalytics(projectId: string) {
    return this.http.get<{
      project: ProjectAnalytics | null;
      tags: TagAnalytics[];
    }>(`${this.baseUrl}/${projectId}/analytics`);
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
