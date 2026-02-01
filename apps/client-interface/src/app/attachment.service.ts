import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AttachmentDto,
  CreateAttachmentDto,
  UpdateAttachmentDto,
  SearchAttachmentDto,
} from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class AttachmentService {
  private apiBaseUrl = inject(API_BASE_URL);
  private http = inject(HttpClient);

  private baseUrl: string;

  constructor() {
    this.baseUrl = `${this.apiBaseUrl}/social/attachment`;
  }

  createAttachment(
    attachmentDto: CreateAttachmentDto
  ): Observable<AttachmentDto> {
    return this.http.post<AttachmentDto>(this.baseUrl, attachmentDto);
  }

  getAttachment(id: string): Observable<AttachmentDto> {
    return this.http.get<AttachmentDto>(`${this.baseUrl}/${id}`);
  }

  updateAttachment(
    id: string,
    updateAttachmentDto: UpdateAttachmentDto
  ): Observable<AttachmentDto> {
    return this.http.put<AttachmentDto>(
      `${this.baseUrl}/update/${id}`,
      updateAttachmentDto
    );
  }

  deleteAttachment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  searchAttachments(
    searchCriteria: SearchAttachmentDto
  ): Observable<AttachmentDto[]> {
    return this.http.post<AttachmentDto[]>(
      `${this.baseUrl}/find`,
      searchCriteria
    );
  }
}
