import {
  CreateProjectJournal,
  ProjectJournal,
  QueryProjectJournal,
} from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class JournalService {
  private readonly http = inject(HttpClient);

  private baseUrl = '/api/project-planning/journal';

  createJournalEntry(data: CreateProjectJournal) {
    return this.http.post<ProjectJournal>(`${this.baseUrl}`, data);
  }

  getJournalEntries() {
    return this.http.get<ProjectJournal[]>(`${this.baseUrl}`);
  }

  queryJournalEntries(query: QueryProjectJournal) {
    return this.http.post<ProjectJournal[]>(`${this.baseUrl}/query`, query);
  }

  deleteJournalEntry(id: string) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  getJournalEntryById(id: string) {
    return this.http.get<ProjectJournal>(`${this.baseUrl}/${id}`);
  }

  updateJournalEntry(data: ProjectJournal) {
    return this.http.patch<ProjectJournal>(`${this.baseUrl}`, data);
  }
}
