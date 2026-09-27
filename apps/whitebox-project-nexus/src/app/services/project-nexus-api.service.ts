import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ChangeOrderResponseDto,
  ChangeOrderSubmissionDto,
  DrawingManifestDto,
  InspectionPhotoResponseDto,
  InspectionPhotoUploadDto,
  ProjectMilestoneDto,
  UpdateMilestoneDto,
} from '@optimistic-tanuki/models';

@Injectable({
  providedIn: 'root',
})
export class ProjectNexusApiService {
  private readonly baseUrl = '/api/v1/nexus';

  constructor(private readonly http: HttpClient) {}

  getMilestones(projectId: string): Observable<ProjectMilestoneDto[]> {
    return this.http.get<ProjectMilestoneDto[]>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/milestones`,
      { withCredentials: true }
    );
  }

  updateMilestone(
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto & { predecessorIds?: string[] }
  ): Observable<ProjectMilestoneDto> {
    return this.http.patch<ProjectMilestoneDto>(
      `${this.baseUrl}/projects/${encodeURIComponent(
        projectId
      )}/milestones/${encodeURIComponent(milestoneId)}`,
      dto,
      { withCredentials: true }
    );
  }

  getDrawings(projectId: string): Observable<DrawingManifestDto> {
    return this.http.get<DrawingManifestDto>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/drawings`,
      { withCredentials: true }
    );
  }

  uploadInspectionPhoto(
    projectId: string,
    dto: InspectionPhotoUploadDto
  ): Observable<InspectionPhotoResponseDto> {
    return this.http.post<InspectionPhotoResponseDto>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/photos`,
      { ...dto, projectId },
      { withCredentials: true }
    );
  }

  getChangeOrders(projectId: string): Observable<ChangeOrderResponseDto[]> {
    return this.http.get<ChangeOrderResponseDto[]>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/change-orders`,
      { withCredentials: true }
    );
  }

  submitChangeOrder(
    projectId: string,
    dto: ChangeOrderSubmissionDto
  ): Observable<ChangeOrderResponseDto> {
    return this.http.post<ChangeOrderResponseDto>(
      `${this.baseUrl}/projects/${encodeURIComponent(projectId)}/change-orders`,
      { ...dto, projectId },
      { withCredentials: true }
    );
  }

  transitionChangeOrder(
    projectId: string,
    changeOrderId: string,
    transition: string
  ): Observable<ChangeOrderResponseDto> {
    return this.http.post<ChangeOrderResponseDto>(
      `${this.baseUrl}/projects/${encodeURIComponent(
        projectId
      )}/change-orders/${encodeURIComponent(changeOrderId)}/transition`,
      { transition },
      { withCredentials: true }
    );
  }

  downloadChangeOrderDocument(
    projectId: string,
    changeOrderId: string
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/projects/${encodeURIComponent(
        projectId
      )}/change-orders/${encodeURIComponent(changeOrderId)}/document`,
      { withCredentials: true, responseType: 'blob' }
    );
  }
}
