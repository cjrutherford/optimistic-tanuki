import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CampaignConcept, GenerationRequest } from '../types';
import type { LlmUsage } from './marketing-enrichment.server';

export interface MarketingEnrichmentResult {
  concepts: CampaignConcept[];
  enrichmentApplied: boolean;
  usage: LlmUsage | null;
}

export interface MarketingGenerationResult {
  concepts: CampaignConcept[];
  generationApplied: boolean;
  usage: LlmUsage | null;
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
        .pipe(
          catchError(() =>
            of({ concepts, enrichmentApplied: false, usage: null })
          )
        )
    );

    return {
      concepts: response.concepts,
      enrichmentApplied: !!response.enrichmentApplied,
      usage: response.usage ?? null,
    };
  }

  async generateConcepts(
    request: GenerationRequest,
    concepts: CampaignConcept[]
  ): Promise<MarketingGenerationResult> {
    const response = await firstValueFrom(
      this.http
        .post<MarketingGenerationResult>('/api/marketing-generator/generate', {
          request,
          concepts,
        })
        .pipe(
          catchError(() =>
            of({ concepts, generationApplied: false, usage: null })
          )
        )
    );

    return {
      concepts: response.concepts,
      generationApplied: !!response.generationApplied,
      usage: response.usage ?? null,
    };
  }
}
