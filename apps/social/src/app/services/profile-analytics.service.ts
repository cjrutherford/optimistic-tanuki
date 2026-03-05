import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { ProfileView } from '../../entities/profile-view.entity';

export interface ProfileViewStats {
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topSources: { source: string; count: number }[];
  recentViews: { viewerId: string; viewedAt: Date }[];
}

@Injectable()
export class ProfileAnalyticsService {
  constructor(
    @Inject(getRepositoryToken(ProfileView))
    private readonly profileViewRepo: Repository<ProfileView>
  ) {}

  async recordView(
    profileId: string,
    viewerId: string,
    source: string
  ): Promise<ProfileView> {
    const view = this.profileViewRepo.create({
      profileId,
      viewerId,
      source,
    });
    return await this.profileViewRepo.save(view);
  }

  async getViewStats(profileId: string): Promise<ProfileViewStats> {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalViews, viewsToday, viewsThisWeek, viewsThisMonth, allViews] =
      await Promise.all([
        this.profileViewRepo.count({ where: { profileId } }),
        this.profileViewRepo.count({
          where: { profileId, viewedAt: MoreThanOrEqual(startOfDay) },
        }),
        this.profileViewRepo.count({
          where: { profileId, viewedAt: MoreThanOrEqual(startOfWeek) },
        }),
        this.profileViewRepo.count({
          where: { profileId, viewedAt: MoreThanOrEqual(startOfMonth) },
        }),
        this.profileViewRepo.find({
          where: { profileId },
          order: { viewedAt: 'DESC' },
          take: 100,
        }),
      ]);

    const sourceCounts = new Map<string, number>();
    allViews.forEach((view) => {
      sourceCounts.set(view.source, (sourceCounts.get(view.source) || 0) + 1);
    });

    const topSources = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentViews = allViews.slice(0, 10).map((view) => ({
      viewerId: view.viewerId,
      viewedAt: view.viewedAt,
    }));

    return {
      totalViews,
      viewsToday,
      viewsThisWeek,
      viewsThisMonth,
      topSources,
      recentViews,
    };
  }

  async getRecentViewers(
    profileId: string,
    limit: number = 10
  ): Promise<ProfileView[]> {
    return await this.profileViewRepo.find({
      where: { profileId },
      order: { viewedAt: 'DESC' },
      take: limit,
    });
  }
}
