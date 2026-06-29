import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LOCALITY_INFO_API_URL } from '@optimistic-tanuki/ui-models';
import { LocalitySummary } from './community.service';

type LocalityInfoApiResponse = {
  extract?: string;
  thumbnail?: {
    source?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

@Injectable({
  providedIn: 'root',
})
export class LocalityInfoService {
  constructor(
    private readonly http: HttpClient,
    @Inject(LOCALITY_INFO_API_URL)
    private readonly localityInfoApiUrl: string
  ) {}

  async enrichLocality(locality: LocalitySummary): Promise<LocalitySummary> {
    const title = locality.label.primary?.trim() || locality.name?.trim();
    if (!this.localityInfoApiUrl || !title) {
      return locality;
    }

    try {
      const url = `${this.localityInfoApiUrl}/${encodeURIComponent(title)}`;
      const response = await firstValueFrom(
        this.http.get<LocalityInfoApiResponse>(url)
      );

      return {
        ...locality,
        description: response.extract?.trim() || locality.description,
        imageUrl: response.thumbnail?.source || locality.imageUrl,
        externalInfo:
          response.extract || response.thumbnail?.source
            ? {
                source: 'api',
                articleUrl: response.content_urls?.desktop?.page,
              }
            : locality.externalInfo,
      };
    } catch {
      return locality;
    }
  }
}
