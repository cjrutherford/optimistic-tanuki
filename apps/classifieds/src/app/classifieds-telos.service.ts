import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProfileTelosSourceFactDto } from '@optimistic-tanuki/models';
import { Repository } from 'typeorm';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';

@Injectable()
export class ClassifiedsTelosService {
  private readonly stopWords = new Set([
    'about',
    'after',
    'condition',
    'from',
    'have',
    'into',
    'listing',
    'local',
    'market',
    'more',
    'sale',
    'sell',
    'their',
    'them',
    'they',
    'this',
    'with',
    'your',
  ]);

  constructor(
    @InjectRepository(ClassifiedAdEntity)
    private readonly repo: Repository<ClassifiedAdEntity>
  ) {}

  async getProfileFacts(
    profileId: string
  ): Promise<ProfileTelosSourceFactDto[]> {
    const ads = await this.repo.find({
      where: { profileId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const activeAds = ads.filter((ad) => ad.status === 'active');
    const soldAds = ads.filter((ad) => ad.status === 'sold');
    const featuredAds = ads.filter((ad) => ad.isFeatured);
    const categories = this.rankValues(ads.map((ad) => ad.category));
    const conditions = this.rankValues(ads.map((ad) => ad.condition));
    const topics = this.extractTopTopics([
      ...ads.flatMap((ad) => [ad.title, ad.description]),
    ]);
    const recentTitles = ads.map((ad) => ad.title).slice(0, 5);
    const avgPrice = ads.length
      ? Number(
          (
            ads.reduce((sum, ad) => sum + Number(ad.price || 0), 0) / ads.length
          ).toFixed(2)
        )
      : 0;
    const currencies = [
      ...new Set(ads.map((ad) => ad.currency).filter(Boolean)),
    ];

    const facts: ProfileTelosSourceFactDto[] = [
      {
        sourceType: 'classifieds:summary',
        sourceId: profileId,
        title: 'Classified listings summary',
        content: `Marketplace activity includes ${ads.length} listings, ${activeAds.length} active listings, ${soldAds.length} sold listings, and ${featuredAds.length} featured listings.`,
        metadata: {
          counts: {
            listings: ads.length,
            activeListings: activeAds.length,
            soldListings: soldAds.length,
            featuredListings: featuredAds.length,
          },
          averagePrice: avgPrice,
          currencies,
        },
      },
    ];

    if (categories.length > 0 || conditions.length > 0) {
      facts.push({
        sourceType: 'classifieds:inventory',
        sourceId: profileId,
        title: 'Listing categories and conditions',
        content: `Listings are concentrated in categories such as ${categories.join(
          ', '
        )}${
          conditions.length
            ? ` with common conditions like ${conditions.join(', ')}`
            : ''
        }.`,
        metadata: {
          categories,
          conditions,
        },
      });
    }

    if (topics.length > 0) {
      facts.push({
        sourceType: 'classifieds:topics',
        sourceId: profileId,
        title: 'Recurring classified topics',
        content: `Recurring classified topics include ${topics.join(', ')}.`,
        metadata: {
          topics,
        },
      });
    }

    if (recentTitles.length > 0) {
      facts.push({
        sourceType: 'classifieds:listings',
        sourceId: profileId,
        title: 'Recent classified listings',
        content: `Recent listings include ${recentTitles.join(', ')}.`,
        metadata: {
          recentTitles,
        },
      });
    }

    return facts;
  }

  private rankValues(values: Array<string | null | undefined>): string[] {
    const counts = new Map<string, number>();

    for (const value of values) {
      if (!value) {
        continue;
      }

      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        continue;
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 5)
      .map(([value]) => value);
  }

  private extractTopTopics(values: Array<string | null | undefined>): string[] {
    const counts = new Map<string, number>();

    for (const value of values) {
      for (const token of this.tokenize(value)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private tokenize(value?: string | null): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/[^a-zA-Z]+/)
      .map((token) => token.trim().toLowerCase())
      .filter(
        (token) =>
          token.length >= 4 &&
          !this.stopWords.has(token) &&
          !/^\d+$/.test(token)
      );
  }
}
