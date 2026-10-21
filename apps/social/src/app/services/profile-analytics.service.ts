import { Inject, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Raw, Repository, MoreThanOrEqual } from 'typeorm';
import { ProfileView } from '../../entities/profile-view.entity';

export interface ProfileViewStats {
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  topSources: { source: string; count: number }[];
  recentViews: { viewedAt: Date }[];
}

const SOURCE_LABELS = new Set(['direct', 'profile', 'search', 'feed', 'other']);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new RpcException({
      code: 'PROFILE_ANALYTICS_REQUEST_INVALID',
      message: 'A valid profile or account UUID is required.',
    });
  }
  return value.toLowerCase();
}

function normalizeSource(source: unknown): string {
  return typeof source === 'string' && SOURCE_LABELS.has(source)
    ? source
    : 'other';
}

function profileIdScope(profileId: string) {
  return Raw((alias) => `LOWER(${alias}) = :profileId`, { profileId });
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
  ): Promise<{ success: true }> {
    const canonicalProfileId = normalizeUuid(profileId);
    const canonicalViewerId = normalizeUuid(viewerId);
    const view = this.profileViewRepo.create({
      profileId: canonicalProfileId,
      viewerId: canonicalViewerId,
      source: normalizeSource(source),
    });
    await this.profileViewRepo.save(view);
    return { success: true };
  }

  async getViewStats(profileId: string): Promise<ProfileViewStats> {
    const canonicalProfileId = normalizeUuid(profileId);
    const scope = () => profileIdScope(canonicalProfileId);
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
        this.profileViewRepo.count({ where: { profileId: scope() } }),
        this.profileViewRepo.count({
          where: { profileId: scope(), viewedAt: MoreThanOrEqual(startOfDay) },
        }),
        this.profileViewRepo.count({
          where: { profileId: scope(), viewedAt: MoreThanOrEqual(startOfWeek) },
        }),
        this.profileViewRepo.count({
          where: {
            profileId: scope(),
            viewedAt: MoreThanOrEqual(startOfMonth),
          },
        }),
        this.profileViewRepo
          .createQueryBuilder('profileView')
          .select('profileView.source', 'source')
          .addSelect('profileView.viewedAt', 'viewedAt')
          .where('LOWER(profileView.profileId) = :profileId', {
            profileId: canonicalProfileId,
          })
          .orderBy('profileView.viewedAt', 'DESC')
          .addOrderBy('profileView.id', 'DESC')
          .take(100)
          .getRawMany(),
      ]);

    const sourceCounts = new Map<string, number>();
    allViews.forEach((view) => {
      const source = normalizeSource(view.source);
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    });

    const topSources = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentViews = allViews
      .slice(0, 10)
      .map(({ viewedAt }) => ({ viewedAt }));

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
    limit?: unknown
  ): Promise<{ viewedAt: Date }[]> {
    const canonicalProfileId = normalizeUuid(profileId);
    const boundedLimit = normalizeLimit(limit);
    const views = await this.profileViewRepo
      .createQueryBuilder('profileView')
      .select('profileView.viewedAt', 'viewedAt')
      .where('LOWER(profileView.profileId) = :profileId', {
        profileId: canonicalProfileId,
      })
      .orderBy('profileView.viewedAt', 'DESC')
      .addOrderBy('profileView.id', 'DESC')
      .take(boundedLimit)
      .getRawMany();
    return views.map(({ viewedAt }) => ({ viewedAt }));
  }
}

function normalizeLimit(limit: unknown): number {
  if (limit === undefined) return 10;
  const numericLimit =
    typeof limit === 'number'
      ? limit
      : typeof limit === 'string' && /^[1-9]\d{0,2}$/.test(limit)
      ? Number(limit)
      : Number.NaN;
  if (
    !Number.isInteger(numericLimit) ||
    numericLimit < 1 ||
    numericLimit > 100
  ) {
    throw new RpcException({
      code: 'PROFILE_ANALYTICS_REQUEST_INVALID',
      message: 'Viewer limit must be an integer from 1 through 100.',
    });
  }
  return numericLimit;
}
