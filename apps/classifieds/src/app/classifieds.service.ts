import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';

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

  constructor(
    @InjectRepository(ClassifiedAdEntity)
    private readonly repo: Repository<ClassifiedAdEntity>
  ) {}

  async create(
    dto: CreateClassifiedAdDto,
    profileId: string,
    userId: string,
    appScope = 'local-hub'
  ): Promise<ClassifiedAdEntity> {
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

  async findById(id: string): Promise<ClassifiedAdEntity> {
    const ad = await this.repo.findOne({ where: { id } });
    if (!ad) {
      throw new RpcException(`Classified ad ${id} not found`);
    }
    return ad;
  }

  async findByCommunity(
    communityId: string,
    appScope?: string
  ): Promise<ClassifiedAdEntity[]> {
    return this.repo.find({
      where: {
        communityId,
        ...(appScope ? { appScope } : {}),
        status: 'active',
      },
      order: { isFeatured: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByProfile(profileId: string): Promise<ClassifiedAdEntity[]> {
    return this.repo.find({
      where: { profileId },
      order: { createdAt: 'DESC' },
    });
  }

  async search(dto: SearchClassifiedsDto): Promise<ClassifiedAdEntity[]> {
    const qb = this.repo.createQueryBuilder('ad');
    qb.where('ad.status = :status', { status: 'active' });

    if (dto.communityId) {
      qb.andWhere('ad.communityId = :communityId', {
        communityId: dto.communityId,
      });
    }
    if (dto.appScope) {
      qb.andWhere('ad.appScope = :appScope', { appScope: dto.appScope });
    }
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

    return qb.getMany();
  }

  async update(
    id: string,
    dto: UpdateClassifiedAdDto,
    profileId: string
  ): Promise<ClassifiedAdEntity> {
    const ad = await this.findById(id);
    if (ad.profileId !== profileId) {
      throw new RpcException('Forbidden: not the owner of this classified ad');
    }
    Object.assign(ad, dto);
    return this.repo.save(ad);
  }

  async remove(id: string, profileId: string): Promise<void> {
    const ad = await this.findById(id);
    if (ad.profileId !== profileId) {
      throw new RpcException('Forbidden: not the owner of this classified ad');
    }
    ad.status = 'removed';
    await this.repo.save(ad);
  }

  async markSold(id: string, profileId: string): Promise<ClassifiedAdEntity> {
    const ad = await this.findById(id);
    if (ad.profileId !== profileId) {
      throw new RpcException('Forbidden: not the owner of this classified ad');
    }
    ad.status = 'sold';
    return this.repo.save(ad);
  }

  async feature(
    id: string,
    profileId: string,
    durationDays: number
  ): Promise<ClassifiedAdEntity> {
    const ad = await this.findById(id);
    ad.isFeatured = true;
    const until = new Date();
    until.setDate(until.getDate() + durationDays);
    ad.featuredUntil = until;
    return this.repo.save(ad);
  }

  async unfeature(id: string): Promise<ClassifiedAdEntity> {
    const ad = await this.findById(id);
    ad.isFeatured = false;
    ad.featuredUntil = null;
    return this.repo.save(ad);
  }
}
