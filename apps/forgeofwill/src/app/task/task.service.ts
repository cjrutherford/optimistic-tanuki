import { CreateTask, QueryTask, Task } from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private baseUrl = '/api/project-planning/tasks';
  constructor(private readonly http: HttpClient) { }

  createTask(data: CreateTask) {
    return this.http.post<Task>(`${this.baseUrl}`, data);
  }

  getTasks() {
    return this.http.get<Task[]>(`${this.baseUrl}`);
  }

  queryTasks(query: QueryTask) {
    return this.http.post<Task[]>(`${this.baseUrl}/query`, query);
  }

  getTaskById(id: string) {
    return this.http.get<Task>(`${this.baseUrl}/${id}`);
  }

  updateTask(data: Task) {
    return this.http.patch<Task>(`${this.baseUrl}`, data);
  }

  deleteTask(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
