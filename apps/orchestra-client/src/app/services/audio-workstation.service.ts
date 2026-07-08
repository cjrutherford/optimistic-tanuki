import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { Observable } from 'rxjs';

export interface CreateProjectDto {
  name: string;
  bpm?: number;
  key?: string;
  genre?: string;
  mood?: string;
}

export interface AudioProject {
  id: string;
  name: string;
  userId: string;
  bpm: number;
  key: string;
  timeSignature: string;
  genre: string | null;
  mood: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
}

export interface Track {
  id: string;
  projectId: string;
  name: string;
  type: string;
  assetId: string | null;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  sortOrder: number;
  waveformDataUrl: string | null;
}

export interface RequestGenerationDto {
  projectId: string;
  collaborationMode: 'full-auto' | 'cover' | 'full-collab';
  prompt?: string;
  voiceMemoAssetId?: string;
  referenceTrackAssetId?: string;
  parameters?: {
    bpm?: number;
    key?: string;
    genre?: string;
    mood?: string;
    duration?: number;
    structure?: string;
  };
}

export interface GenerationRequest {
  id: string;
  projectId: string;
  collaborationMode: string;
  agentType: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultAssetId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MixSnapshot {
  id: string;
  projectId: string;
  trackId: string;
  volume: number;
  pan: number;
  eq: any;
  dynamics: any;
  effects: any;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AudioWorkstationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly apiPath = `${this.baseUrl}/audio`;

  getProjects(): Observable<AudioProject[]> {
    return this.http.get<AudioProject[]>(`${this.apiPath}/projects`);
  }

  getProject(id: string): Observable<AudioProject> {
    return this.http.get<AudioProject>(`${this.apiPath}/projects/${id}`);
  }

  createProject(dto: CreateProjectDto): Observable<AudioProject> {
    return this.http.post<AudioProject>(`${this.apiPath}/projects`, dto);
  }

  updateProject(
    id: string,
    dto: Partial<CreateProjectDto>
  ): Observable<AudioProject> {
    return this.http.patch<AudioProject>(`${this.apiPath}/projects/${id}`, dto);
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiPath}/projects/${id}`);
  }

  getTracks(projectId: string): Observable<Track[]> {
    return this.http.get<Track[]>(
      `${this.apiPath}/projects/${projectId}/tracks`
    );
  }

  updateTrack(id: string, dto: Partial<Track>): Observable<Track> {
    return this.http.patch<Track>(`${this.apiPath}/tracks/${id}`, dto);
  }

  requestGeneration(
    projectId: string,
    dto: RequestGenerationDto
  ): Observable<{ requestId: string }> {
    return this.http.post<{ requestId: string }>(
      `${this.apiPath}/projects/${projectId}/generate`,
      dto
    );
  }

  getGenerationStatus(requestId: string): Observable<GenerationRequest> {
    return this.http.get<GenerationRequest>(
      `${this.apiPath}/generations/${requestId}`
    );
  }

  getMix(projectId: string): Observable<MixSnapshot[]> {
    return this.http.get<MixSnapshot[]>(
      `${this.apiPath}/projects/${projectId}/mix`
    );
  }

  saveMix(
    projectId: string,
    trackId: string,
    dto: Partial<MixSnapshot>
  ): Observable<MixSnapshot> {
    return this.http.put<MixSnapshot>(
      `${this.apiPath}/projects/${projectId}/mix/${trackId}`,
      dto
    );
  }

  startExport(projectId: string, dto: any): Observable<{ exportId: string }> {
    return this.http.post<{ exportId: string }>(
      `${this.apiPath}/projects/${projectId}/export`,
      dto
    );
  }

  getExportStatus(exportId: string): Observable<any> {
    return this.http.get(`${this.apiPath}/exports/${exportId}`);
  }
}
