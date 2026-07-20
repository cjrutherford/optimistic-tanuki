import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

export interface OnPageCampaign {
  id: string;
  businessPageId: string;
  name: string;
  creative: {
    headline?: string | null;
    body?: string | null;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    imageUrl?: string | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SponsorDiscoveryService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly apiBaseUrl: string
  ) {}

  discoverOnPage(
    options: { channelId?: string; communityId?: string } = {}
  ): Observable<OnPageCampaign[]> {
    const params = new HttpParams({
      fromObject: {
        ...(options.channelId ? { channelId: options.channelId } : {}),
        ...(options.communityId ? { communityId: options.communityId } : {}),
      },
    });

    return this.http.get<OnPageCampaign[]>(
      `${this.apiBaseUrl}/payments/advertising-campaigns/eligible/on-page`,
      { params }
    );
  }
}
