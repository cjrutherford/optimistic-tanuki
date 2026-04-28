import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CampaignConcept, GenerationRequest } from '../types';

@Injectable({
  providedIn: 'root',
})
export class MarketingEnrichmentApiService {
  constructor(private readonly http: HttpClient) {}

  async enrichConcepts(
    request: GenerationRequest,
    concepts: CampaignConcept[]
  ): Promise<CampaignConcept[]> {
    const response = await firstValueFrom(
      this.http
        .post<{ concepts: CampaignConcept[] }>('/api/marketing-generator/enrich', {
          request,
          concepts,
        })
        .pipe(catchError(() => of({ concepts })))
    );

    return response.concepts;
  }
}
