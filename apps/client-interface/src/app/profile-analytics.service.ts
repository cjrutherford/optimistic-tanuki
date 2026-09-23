import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/profile-ui-data-access';

export interface ProfileViewStats {
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topSources: { source: string; count: number }[];
  recentViews: { viewerId: string; viewedAt: Date }[];
}

export interface ProfileViewer {
  viewerId: string;
  viewedAt: Date;
}

@Injectable({ providedIn: 'root' })
export class ProfileAnalyticsService {
  private readonly analytics = inject(OptomisitcTanukiAPIService);

  constructor() {}

  recordView(
    profileId: string,
    viewerId: string,
    source: string
  ): Observable<void> {
    return this.analytics.profileAnalyticsControllerRecordView<void>({
      profileId,
      viewerId,
      source,
    });
  }

  getViewStats(profileId: string): Observable<ProfileViewStats> {
    return this.analytics.profileAnalyticsControllerGetViewStats<ProfileViewStats>(
      profileId
    );
  }

  getRecentViewers(
    profileId: string,
    limit: number = 10
  ): Observable<ProfileViewer[]> {
    return this.analytics.profileAnalyticsControllerGetRecentViewers<
      ProfileViewer[]
    >(profileId, { limit });
  }
}
