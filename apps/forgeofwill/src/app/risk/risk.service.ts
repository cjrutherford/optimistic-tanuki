import { CreateRisk, QueryRisk, Risk } from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RiskService {
  private baseUrl = '/api/project-planning';
  constructor(private readonly http: HttpClient) { }

  getRisks() {
    return this.http.get<Risk[]>(`${this.baseUrl}/risks`);
  }

  queryRisks(query: QueryRisk) {
    return this.http.post<Risk[]>(`${this.baseUrl}/risks/query`, query);
  }

  createRisk(risk: CreateRisk) {
    return this.http.post<Risk>(`${this.baseUrl}/risks`, risk);
  }

  getRiskById(id: string) {
    return this.http.get<Risk>(`${this.baseUrl}/risks/${id}`);
  }

  updateRisk(id: string, risk: Partial<Risk>) {
    return this.http.put<Risk>(`${this.baseUrl}/risks/${id}`, risk);
  }

  deleteRisk(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/risks/${id}`);
  }

}
