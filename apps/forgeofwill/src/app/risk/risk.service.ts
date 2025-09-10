import { CreateRisk, QueryRisk, Risk } from '@optimistic-tanuki/ui-models';

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProfileService } from '../profile/profile.service';

@Injectable({
  providedIn: 'root'
})
export class RiskService {
  private baseUrl = '/api/project-planning/risk';
  constructor(
    private readonly http: HttpClient,
    private readonly profileService: ProfileService,
  ) { }

  getRisks() {
    return this.http.get<Risk[]>(`${this.baseUrl}/`);
  }

  queryRisks(query: QueryRisk) {
    return this.http.post<Risk[]>(`${this.baseUrl}/query`, query);
  }

  createRisk(risk: CreateRisk) {
    const currentProfile = this.profileService.getCurrentUserProfile();
    if (!currentProfile) {
      throw new Error('User profile is not available');
    }
    risk.createdBy = currentProfile.id;
    risk.riskOwner = currentProfile.id;
    return this.http.post<Risk>(`${this.baseUrl}/`, risk);
  }

  getRiskById(id: string) {
    return this.http.get<Risk>(`${this.baseUrl}/${id}`);
  }

  updateRisk(id: string, risk: Partial<Risk>) {
    return this.http.patch<Risk>(`${this.baseUrl}`, risk);
  }

  deleteRisk(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

}
