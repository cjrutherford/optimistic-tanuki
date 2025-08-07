import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AttachmentDto, CreateAttachmentDto, UpdateAttachmentDto, SearchAttachmentDto } from '@optimistic-tanuki/social-ui';


/**
 * Service for managing attachments.
 */
@Injectable({
  providedIn: 'root'
})
export class AttachmentService {
  private baseUrl = '/api/social/attachment';

  /**
   * Creates an instance of AttachmentService.
   * @param http The HttpClient instance.
   */
  constructor(private http: HttpClient) { }

  /**
   * Creates a new attachment.
   * @param attachmentDto The data for creating the attachment.
   * @returns An Observable of the created AttachmentDto.
   */
  createAttachment(attachmentDto: CreateAttachmentDto): Observable<AttachmentDto> {
    return this.http.post<AttachmentDto>(this.baseUrl, attachmentDto);
  }

  /**
   * Retrieves an attachment by its ID.
   * @param id The ID of the attachment to retrieve.
   * @returns An Observable of the retrieved AttachmentDto.
   */
  getAttachment(id: string): Observable<AttachmentDto> {
    return this.http.get<AttachmentDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Updates an existing attachment.
   * @param id The ID of the attachment to update.
   * @param updateAttachmentDto The data for updating the attachment.
   * @returns An Observable of the updated AttachmentDto.
   */
  updateAttachment(id: string, updateAttachmentDto: UpdateAttachmentDto): Observable<AttachmentDto> {
    return this.http.put<AttachmentDto>(`${this.baseUrl}/update/${id}`, updateAttachmentDto);
  }

  /**
   * Deletes an attachment by its ID.
   * @param id The ID of the attachment to delete.
   * @returns An Observable that completes when the attachment is deleted.
   */
  deleteAttachment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Searches for attachments based on criteria.
   * @param searchCriteria The criteria for searching attachments.
   * @returns An Observable of an array of AttachmentDto.
   */
  searchAttachments(searchCriteria: SearchAttachmentDto): Observable<AttachmentDto[]> {
    return this.http.post<AttachmentDto[]>(`${this.baseUrl}/find`, searchCriteria);
  }
}
