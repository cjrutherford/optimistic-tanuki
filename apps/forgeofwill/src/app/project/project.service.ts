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
import { Injectable, NgZone, inject } from '@angular/core';
import { ProfileService } from '../profile/profile.service';

/** What the caller sees while the assistant works, then what it produced. */
export type AssistantProgress =
  | { type: 'tool'; tool: string }
  /**
   * A piece of the answer, as it is written. The done event still carries the
   * whole reply, so nothing depends on every chunk arriving.
   */
  | { type: 'text'; chunk: string }
  /** The agent's own words while it works. Not the answer, and never shown
   * as one. */
  | { type: 'thinking'; chunk: string }
  | {
      type: 'done';
      result: {
        said: string;
        used: { tool: string; result: string }[];
        awaitingApproval: boolean;
        model: string | null;
        unavailable?: string;
        /** Who answered, present whenever a persona could be read. */
        spokenBy?: { id: string; name: string; blurb: string };
      };
    };

/** An invitation to work on a project with somebody. */
export interface ProjectInvite {
  id: string;
  projectId: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'LEFT';
  createdAt?: string;
  respondedAt?: string;
  /** Present on your own invitations: you cannot read the project yet. */
  projectName?: string;
}

/** Somebody on a project, ready to be shown. */
export interface ProjectPerson {
  profileId: string;
  name?: string;
  isOwner: boolean;
}

/** One message in a project's conversation. */
export interface ProjectMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt?: string;
}

/** The conversation belonging to a project. */
export interface ProjectConversation {
  id: string;
  title: string;
  projectId: string;
  participants: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  baseUrl = '/api/project-planning/projects';
  /** Invitations are not under a project: you read yours before you can see it. */
  invitationsUrl = '/api/project-planning/invitations';

  /** Only used to bring streamed events back into Angular. See below. */
  private readonly zone = inject(NgZone);

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

  /**
   * The same instruction, reported as the assistant works.
   *
   * fetch rather than HttpClient because the response is read a line at a time
   * as it arrives, and HttpClient hands back a whole body. Cookies carry the
   * session, the same way every other call here is authenticated.
   *
   * Each line is one event. The caller sees the tools being used, then the
   * result. A run takes a minute or more, and silence for that long looks like
   * a fault.
   *
   * Every event is handed to the caller inside Angular's zone. zone.js does not
   * patch fetch or a ReadableStream reader, so without this the signals a
   * caller writes from here are set correctly and never painted: no progress,
   * no tools appearing, and an answer that only shows up when something
   * unrelated happens to trigger a cycle. Doing it here rather than at each
   * call site means the next thing built on this stream is right by default.
   */
  async instructAssistantStreaming(
    projectId: string | null,
    instruction: string,
    history: { role: 'person' | 'assistant'; text: string }[],
    onEvent: (event: AssistantProgress) => void,
    /** Who to speak as. Null lets the orchestrator pick its usual persona. */
    personaId: string | null = null
  ): Promise<void> {
    // With no project chosen the assistant is not stuck, it just starts further
    // back by listing projects. That is a route of its own: interpolating a
    // null id asks the gateway for a project literally named "null".
    const url = projectId
      ? `${this.baseUrl}/${projectId}/ai-act/stream`
      : `${this.baseUrl.replace(/\/projects$/, '')}/ai-act/stream`;

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-ot-appscope': 'forgeofwill',
      },
      body: JSON.stringify({ instruction, history, personaId }),
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `The assistant could not be reached (${response.status})`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // A chunk can end mid-line, so the tail is kept for the next one.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;

        // Parsing and handling are caught separately on purpose. Wrapping both
        // would report a bug in the caller as a malformed line and hide it.
        let event: AssistantProgress;
        try {
          event = JSON.parse(line) as AssistantProgress;
        } catch {
          // A line that will not parse is one event lost, not a reason to
          // abandon a run that is still producing them.
          continue;
        }
        this.zone.run(() => onEvent(event));
      }
    }
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

  /**
   * Working on a project with somebody.
   *
   * Only the owner may invite, list or withdraw, and the service refuses
   * everyone else in the same words as being unable to reach the project at
   * all, so nothing here can be used to find out which projects exist.
   */
  inviteToProject(projectId: string, email: string) {
    return this.http.post<ProjectInvite>(
      `${this.baseUrl}/${projectId}/invites`,
      { email }
    );
  }

  getProjectInvites(projectId: string) {
    return this.http.get<ProjectInvite[]>(
      `${this.baseUrl}/${projectId}/invites`
    );
  }

  revokeProjectInvite(inviteId: string) {
    return this.http.delete<ProjectInvite>(
      `${this.baseUrl}/invites/${inviteId}`
    );
  }

  /**
   * The invitee's side.
   *
   * Scoped by the caller's own address on the server, never by anything sent
   * from here, so an invitation can only be seen and answered by the person it
   * was addressed to.
   */
  getMyInvitations() {
    return this.http.get<ProjectInvite[]>(`${this.invitationsUrl}`);
  }

  respondToInvitation(inviteId: string, accept: boolean) {
    return this.http.patch<ProjectInvite>(
      `${this.invitationsUrl}/${inviteId}`,
      {
        accept,
      }
    );
  }

  /** The owner removing somebody. */
  removeProjectMember(projectId: string, profileId: string) {
    return this.http.delete<{ projectId: string; removed: string }>(
      `${this.baseUrl}/${projectId}/members/${profileId}`
    );
  }

  /** A member taking themselves out, which needs nobody else to agree. */
  leaveProject(projectId: string) {
    return this.http.delete<{ projectId: string; left: string }>(
      `${this.baseUrl}/${projectId}/members/me`
    );
  }

  /**
   * The reader's own profile id.
   *
   * Every page that shows who is on a project needs to know which of them is
   * the reader, and the profile service is already injected here.
   */
  currentProfileId(): string {
    return this.profileService.getCurrentUserProfile()?.id ?? '';
  }

  /**
   * Who is on a project, by name.
   *
   * Membership is stored as profile ids, which is right for deciding access
   * and useless for showing somebody a list of people. The gateway resolves
   * the names because it is the one that talks to profiles.
   */
  getProjectPeople(projectId: string) {
    return this.http.get<ProjectPerson[]>(
      `${this.baseUrl}/${projectId}/people`
    );
  }

  /**
   * The messages in a conversation, and sending one.
   *
   * Both are refused for anybody not in the conversation. That check lives in
   * the chat service, which is the one that knows who is in it.
   */
  getConversationMessages(conversationId: string) {
    return this.http.get<ProjectMessage[]>(
      `/api/chat/messages/${conversationId}`
    );
  }

  sendConversationMessage(conversationId: string, content: string) {
    return this.http.post<ProjectMessage>('/api/chat/messages', {
      conversationId,
      content,
      recipientIds: [],
    });
  }

  /** The conversation belonging to a project, made if it is not there yet. */
  getProjectConversation(projectId: string) {
    return this.http.get<ProjectConversation>(
      `${this.baseUrl}/${projectId}/conversation`
    );
  }
}
