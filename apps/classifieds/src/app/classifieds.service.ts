import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { CommunityCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';
import { firstValueFrom, timeout } from 'rxjs';

export interface CreateClassifiedAdDto {
  communityId?: string | null;
  title: string;
  description: string;
  price: number;
  currency?: string;
  category?: string;
  condition?: string;
  imageUrls?: string[];
}

export interface UpdateClassifiedAdDto {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  condition?: string;
  imageUrls?: string[];
}

export interface SearchClassifiedsDto {
  communityId?: string;
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  appScope?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ClassifiedsService {
  private readonly logger = new Logger(ClassifiedsService.name);
  private readonly createFields = new Set([
    'communityId',
    'title',
    'description',
    'price',
    'currency',
    'category',
    'condition',
    'imageUrls',
  ]);
  private readonly updateFields = new Set([
    'title',
    'description',
    'price',
    'currency',
    'category',
    'condition',
    'imageUrls',
  ]);

  constructor(
    @InjectRepository(ClassifiedAdEntity)
    private readonly repo: Repository<ClassifiedAdEntity>,
    @Optional()
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient?: ClientProxy
  ) {}

  async create(
    dto: CreateClassifiedAdDto,
    profileId: string,
    userId: string,
    appScope?: string
  ): Promise<ClassifiedAdEntity> {
    this.assertAllowedFields(dto, this.createFields);
    appScope = this.requireAppScope(appScope);
    if (dto.communityId) {
      await this.assertCommunityPostingAllowed(
        dto.communityId,
        userId,
        appScope
      );
    }
    const ad = this.repo.create({
      ...dto,
      profileId,
      userId,
      appScope,
      status: 'active',
      currency: dto.currency ?? 'USD',
    });
    return this.repo.save(ad);
  }

  async findById(
    id: string,
    appScope: string,
    requestingUserId?: string
  ): Promise<ClassifiedAdEntity> {
    this.requireAppScope(appScope);
    const ad = await this.repo.findOne({ where: { id, appScope } });
    if (!ad) {
      throw new RpcException({
        statusCode: 404,
        message: `Classified ad ${id} not found`,
      });
    }
    if (
      ad.communityId &&
      !(await this.canReadCommunity(
        ad.communityId,
        requestingUserId,
        appScope,
        ad.userId
      ))
    ) {
      throw new RpcException({
        statusCode: 404,
        message: `Classified ad ${id} not found`,
      });
    }
    return ad;
  }

  async findIdsByUser(userId: string, appScope: string): Promise<string[]> {
    this.requireAppScope(appScope);
    const ads = await this.repo.find({
      select: { id: true },
      where: { userId, appScope },
    });
    return ads.map((ad) => ad.id);
  }

  async findByCommunity(
    communityId: string,
    appScope: string,
    requestingUserId?: string
  ): Promise<ClassifiedAdEntity[]> {
    this.requireAppScope(appScope);
    if (
      !(await this.canReadCommunity(communityId, requestingUserId, appScope))
    ) {
      return [];
    }
    return this.repo.find({
      where: {
        communityId,
        appScope,
        status: 'active',
      },
      order: { isFeatured: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByProfile(
    profileId: string,
    appScope: string,
    requestingUserId?: string
  ): Promise<ClassifiedAdEntity[]> {
    this.requireAppScope(appScope);
    const ads = await this.repo.find({
      where: { profileId, appScope },
      order: { createdAt: 'DESC' },
    });
    return this.filterReadableAds(ads, requestingUserId, appScope);
  }

  async search(
    dto: SearchClassifiedsDto,
    requestingUserId?: string
  ): Promise<ClassifiedAdEntity[]> {
    const appScope = this.requireAppScope(dto.appScope);
    const qb = this.repo.createQueryBuilder('ad');
    qb.where('ad.status = :status', { status: 'active' });

    if (dto.communityId) {
      qb.andWhere('ad.communityId = :communityId', {
        communityId: dto.communityId,
      });
    }
    qb.andWhere('ad.appScope = :appScope', { appScope });
    if (dto.query) {
      qb.andWhere('(ad.title ILIKE :query OR ad.description ILIKE :query)', {
        query: `%${dto.query}%`,
      });
    }
    if (dto.category) {
      qb.andWhere('ad.category = :category', { category: dto.category });
    }
    if (dto.minPrice !== undefined) {
      qb.andWhere('ad.price >= :minPrice', { minPrice: dto.minPrice });
    }
    if (dto.maxPrice !== undefined) {
      qb.andWhere('ad.price <= :maxPrice', { maxPrice: dto.maxPrice });
    }

    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('ad.isFeatured', 'DESC').addOrderBy('ad.createdAt', 'DESC');

    return this.filterReadableAds(
      await qb.getMany(),
      requestingUserId,
      appScope
    );
  }

  async update(
    id: string,
    dto: UpdateClassifiedAdDto,
    profileId: string,
    appScope: string
  ): Promise<ClassifiedAdEntity> {
    this.assertAllowedFields(dto, this.updateFields);
    const ad = await this.findScopedAd(id, appScope);
    if (ad.profileId !== profileId) {
      throw new RpcException({
        statusCode: 403,
        message: 'Forbidden: not the owner of this classified ad',
      });
    }
    Object.assign(ad, dto);
    return this.repo.save(ad);
  }

  async remove(
    id: string,
    profileId: string,
    appScope: string
  ): Promise<ClassifiedAdEntity> {
    const ad = await this.findScopedAd(id, appScope);
    if (ad.profileId !== profileId) {
      throw new RpcException({
        statusCode: 403,
        message: 'Forbidden: not the owner of this classified ad',
      });
    }
    ad.status = 'removed';
    return this.repo.save(ad);
  }

  async markSold(
    id: string,
    profileId: string,
    appScope: string
  ): Promise<ClassifiedAdEntity> {
    const ad = await this.findScopedAd(id, appScope);
    if (ad.profileId !== profileId) {
      throw new RpcException({
        statusCode: 403,
        message: 'Forbidden: not the owner of this classified ad',
      });
    }
    ad.status = 'sold';
    return this.repo.save(ad);
  }

  async feature(
    id: string,
    profileId: string,
    durationDays: number,
    appScope: string
  ): Promise<ClassifiedAdEntity> {
    const ad = await this.findScopedAd(id, appScope);
    if (ad.profileId !== profileId) {
      throw new RpcException({
        statusCode: 403,
        message: 'Forbidden: not the owner of this classified ad',
      });
    }
    ad.isFeatured = true;
    const until = new Date();
    until.setDate(until.getDate() + durationDays);
    ad.featuredUntil = until;
    return this.repo.save(ad);
  }

  async unfeature(
    id: string,
    profileId: string,
    appScope: string
  ): Promise<ClassifiedAdEntity> {
    const ad = await this.findScopedAd(id, appScope);
    if (ad.profileId !== profileId) {
      throw new RpcException({
        statusCode: 403,
        message: 'Forbidden: not the owner of this classified ad',
      });
    }
    ad.isFeatured = false;
    ad.featuredUntil = null;
    return this.repo.save(ad);
  }

  private requireAppScope(appScope?: string): string {
    if (!appScope?.trim()) {
      throw new RpcException({
        statusCode: 400,
        message: 'Application scope is required',
      });
    }
    return appScope;
  }

  private assertAllowedFields(dto: object, allowedFields: Set<string>): void {
    const unsupported = Object.keys(dto).filter(
      (field) => !allowedFields.has(field)
    );
    if (unsupported.length) {
      throw new RpcException({
        statusCode: 400,
        message: `Unsupported classified field(s): ${unsupported.join(', ')}`,
      });
    }
  }

  private async findScopedAd(
    id: string,
    appScope: string
  ): Promise<ClassifiedAdEntity> {
    this.requireAppScope(appScope);
    const ad = await this.repo.findOne({ where: { id, appScope } });
    if (!ad) {
      throw new RpcException({
        statusCode: 404,
        message: `Classified ad ${id} not found`,
      });
    }
    return ad;
  }

  private async assertCommunityPostingAllowed(
    communityId: string,
    userId: string,
    appScope?: string
  ): Promise<void> {
    if (!this.socialClient || !appScope || !userId) {
      throw new RpcException({
        statusCode: 503,
        message: 'Community membership could not be verified',
      });
    }
    try {
      const [community, isMember] = await Promise.all([
        firstValueFrom(
          this.socialClient
            .send<{ id: string; appScope?: string }>(
              { cmd: CommunityCommands.FIND },
              { id: communityId }
            )
            .pipe(timeout({ first: 5000 }))
        ),
        firstValueFrom(
          this.socialClient
            .send<boolean>(
              { cmd: 'IS_COMMUNITY_MEMBER' },
              { communityId, userId }
            )
            .pipe(timeout({ first: 5000 }))
        ),
      ]);
      if (!community || community.appScope !== appScope) {
        throw new RpcException({
          statusCode: 404,
          message: 'Community not found in this app',
        });
      }
      if (isMember !== true) {
        throw new RpcException({
          statusCode: 403,
          message:
            'Approved community membership is required to post a classified',
        });
      }
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error('Classified community membership lookup failed', error);
      throw new RpcException({
        statusCode: 503,
        message: 'Community membership could not be verified',
      });
    }
  }

  private async canReadCommunity(
    communityId: string,
    requestingUserId: string | undefined,
    appScope: string,
    listingOwnerUserId?: string
  ): Promise<boolean> {
    if (!this.socialClient) {
      throw new RpcException({
        statusCode: 503,
        message: 'Community visibility could not be verified',
      });
    }
    try {
      const community = await firstValueFrom(
        this.socialClient
          .send<{ id: string; appScope?: string; isPrivate?: boolean }>(
            { cmd: CommunityCommands.FIND },
            { id: communityId }
          )
          .pipe(timeout({ first: 5000 }))
      );
      if (!community || community.appScope !== appScope) return false;
      if (!community.isPrivate) return true;
      if (!requestingUserId) return false;
      if (listingOwnerUserId === requestingUserId) return true;
      return (
        (await firstValueFrom(
          this.socialClient
            .send<boolean>(
              { cmd: 'IS_COMMUNITY_MEMBER' },
              { communityId, userId: requestingUserId }
            )
            .pipe(timeout({ first: 5000 }))
        )) === true
      );
    } catch (error) {
      if (error instanceof RpcException) throw error;
      this.logger.error('Classified community visibility lookup failed', error);
      throw new RpcException({
        statusCode: 503,
        message: 'Community visibility could not be verified',
      });
    }
  }

  private async filterReadableAds(
    ads: ClassifiedAdEntity[],
    requestingUserId: string | undefined,
    appScope: string
  ): Promise<ClassifiedAdEntity[]> {
    const communityIds = [
      ...new Set(ads.flatMap((ad) => (ad.communityId ? [ad.communityId] : []))),
    ];
    const readable = new Set<string>();
    const ownerReadable = new Set<string>();
    await Promise.all(
      communityIds.map(async (communityId) => {
        if (
          await this.canReadCommunity(communityId, requestingUserId, appScope)
        ) {
          readable.add(communityId);
          return;
        }
        const hasOwnedAd = ads.some(
          (ad) =>
            ad.communityId === communityId && ad.userId === requestingUserId
        );
        if (
          hasOwnedAd &&
          requestingUserId &&
          (await this.canReadCommunity(
            communityId,
            requestingUserId,
            appScope,
            requestingUserId
          ))
        ) {
          ownerReadable.add(communityId);
        }
      })
    );
    return ads.filter(
      (ad) =>
        !ad.communityId ||
        readable.has(ad.communityId) ||
        (ad.userId === requestingUserId && ownerReadable.has(ad.communityId))
    );
  }
}
