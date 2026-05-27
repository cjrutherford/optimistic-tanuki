import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CampaignConcept, GenerationRequest } from '../types';

export interface MarketingEnrichmentResult {
  concepts: CampaignConcept[];
  enrichmentApplied: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MarketingEnrichmentApiService {
  constructor(private readonly http: HttpClient) {}

  async enrichConcepts(
    request: GenerationRequest,
    concepts: CampaignConcept[]
  ): Promise<MarketingEnrichmentResult> {
    const response = await firstValueFrom(
      this.http
        .post<MarketingEnrichmentResult>('/api/marketing-generator/enrich', {
          request,
          concepts,
        })
        .pipe(catchError(() => of({ concepts, enrichmentApplied: false })))
    );

    return {
      concepts: response.concepts,
      enrichmentApplied: !!response.enrichmentApplied,
    };
  }
}
