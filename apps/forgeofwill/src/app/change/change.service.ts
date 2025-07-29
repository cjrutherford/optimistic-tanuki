import { Change, CreateChange, QueryChange } from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChangeService {
  private baseUrl = '/api/project-planning/changes';
  constructor(private readonly http: HttpClient) { }

  createChange(data: CreateChange) {
    return this.http.post<Change>(`${this.baseUrl}`, data);
  }

  getChanges() {
    return this.http.get<Change[]>(`${this.baseUrl}`);
  }

  queryChanges(query: QueryChange) {
    return this.http.post<Change[]>(`${this.baseUrl}/query`, query);
  }

  deleteChange(id: string) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  getChangeById(id: string) {
    return this.http.get<Change>(`${this.baseUrl}/${id}`);
  }

  updateChange(data: Change) {
    return this.http.patch<Change>(`${this.baseUrl}`, data);
  }
}
