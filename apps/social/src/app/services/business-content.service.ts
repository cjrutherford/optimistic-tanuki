import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BusinessPageContent } from '../../entities/business-page-content.entity';
import { BusinessThemeContent } from '../../entities/business-theme-content.entity';
import { CommunitySponsorshipContent } from '../../entities/community-sponsorship-content.entity';

/**
 * Business content reads/writes owned by social (O13/E14, decided row-move
 * with dual-write). Money state stays payments-side; these rows carry
 * content + display fields plus back-references (`paymentsBusinessPageId`,
 * `paymentsSponsorshipId`) so either side can reconcile.
 */
@Injectable()
export class BusinessContentService {
  constructor(
    @Inject(getRepositoryToken(BusinessPageContent))
    private readonly pages: Repository<BusinessPageContent>,
    @Inject(getRepositoryToken(BusinessThemeContent))
    private readonly themes: Repository<BusinessThemeContent>,
    @Inject(getRepositoryToken(CommunitySponsorshipContent))
    private readonly sponsorships: Repository<CommunitySponsorshipContent>
  ) {}

  async getBusinessPage(
    communityId: string
  ): Promise<BusinessPageContent | null> {
    return await this.pages.findOne({ where: { communityId } });
  }

  async getBusinessPagesByCommunityIds(
    communityIds: string[]
  ): Promise<BusinessPageContent[]> {
    if (communityIds.length === 0) {
      return [];
    }
    return await this.pages.find({ where: { communityId: In(communityIds) } });
  }

  async createBusinessPage(data: {
    communityId: string;
    ownerId: string;
    tier?: string;
    paymentsBusinessPageId?: string;
  }): Promise<BusinessPageContent> {
    const existing = await this.getBusinessPage(data.communityId);
    if (existing) {
      return existing;
    }
    return await this.pages.save(
      this.pages.create({
        communityId: data.communityId,
        ownerId: data.ownerId,
        tier: data.tier ?? 'basic',
        subscriptionStatus: 'inactive',
        paymentsBusinessPageId: data.paymentsBusinessPageId ?? null,
      })
    );
  }

  async updateBusinessPage(
    communityId: string,
    ownerId: string,
    data: Partial<BusinessPageContent>
  ): Promise<BusinessPageContent | null> {
    const page = await this.pages.findOne({ where: { communityId, ownerId } });
    if (!page) {
      return null;
    }
    Object.assign(page, data);
    return await this.pages.save(page);
  }

  async getBusinessTheme(
    businessPageId: string
  ): Promise<BusinessThemeContent | null> {
    return await this.themes.findOne({ where: { businessPageId } });
  }

  async createBusinessTheme(data: {
    businessPageId: string;
    personalityId?: string;
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    customCss?: string;
    customFontFamily?: string;
  }): Promise<BusinessThemeContent> {
    return await this.themes.save(this.themes.create(data));
  }

  async getActiveSponsorships(
    communityId: string
  ): Promise<CommunitySponsorshipContent[]> {
    return await this.sponsorships.find({
      where: { communityId, status: 'active' },
    });
  }

  async getUserSponsorships(
    userId: string
  ): Promise<CommunitySponsorshipContent[]> {
    return await this.sponsorships.find({ where: { userId } });
  }

  async createSponsorship(data: {
    communityId: string;
    businessPageId?: string;
    userId: string;
    type: string;
    adContent?: string;
    months?: number;
    paymentsSponsorshipId?: string;
  }): Promise<CommunitySponsorshipContent> {
    return await this.sponsorships.save(
      this.sponsorships.create({
        communityId: data.communityId,
        businessPageId: data.businessPageId,
        userId: data.userId,
        type: data.type,
        adContent: data.adContent,
        status: 'pending',
        months: data.months ?? 1,
        paymentsSponsorshipId: data.paymentsSponsorshipId ?? null,
      })
    );
  }
}
