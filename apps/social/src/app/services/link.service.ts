import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Link } from '../../entities/link.entity';
import { Repository, FindOneOptions, FindManyOptions } from 'typeorm';
import { CreateLinkDto, UpdateLinkDto } from '@optimistic-tanuki/models';
import { Post } from '../../entities/post.entity';
import validator from 'validator';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class LinkService {
  constructor(
    @Inject(getRepositoryToken(Link))
    private readonly linkRepo: Repository<Link>
  ) {}

  async create(
    createLinkDto: CreateLinkDto,
    actor: { accountId: string; profileId: string }
  ): Promise<Link> {
    if (
      !actor ||
      typeof actor.accountId !== 'string' ||
      typeof actor.profileId !== 'string' ||
      !validator.isUUID(actor.accountId, 4) ||
      !validator.isUUID(actor.profileId, 4)
    )
      throw new RpcException({
        statusCode: 403,
        message: 'Invalid link actor',
      });
    if (
      !createLinkDto ||
      typeof createLinkDto.postId !== 'string' ||
      !validator.isUUID(createLinkDto.postId, 4) ||
      typeof createLinkDto.url !== 'string' ||
      createLinkDto.url.length > 2048
    )
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid link input',
      });
    let url: URL;
    try {
      url = new URL(createLinkDto.url);
    } catch {
      throw new RpcException({ statusCode: 400, message: 'Invalid link URL' });
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      createLinkDto.url.length > 2048
    )
      throw new RpcException({ statusCode: 400, message: 'Invalid link URL' });
    return this.linkRepo.manager.transaction(async (manager) => {
      const posts = manager.getRepository(Post);
      const post = await posts.findOne({
        where: {
          id: createLinkDto.postId.toLowerCase(),
          userId: actor.accountId.toLowerCase(),
          profileId: actor.profileId.toLowerCase(),
        },
        relations: { links: true },
      });
      if (!post)
        throw new RpcException({
          statusCode: 403,
          message: 'Post not found or not owned by actor',
        });
      const link = await manager
        .getRepository(Link)
        .save(
          manager
            .getRepository(Link)
            .create({ url: url.toString(), appScope: post.appScope })
        );
      await posts
        .createQueryBuilder()
        .relation(Post, 'links')
        .of(post)
        .add(link);
      return link;
    });
  }

  async findAll(options?: FindManyOptions<Link>): Promise<Link[]> {
    return await this.linkRepo.find(options);
  }

  async findOne(id: number, options?: FindOneOptions<Link>): Promise<Link> {
    return await this.linkRepo.findOne({ where: { id }, ...options });
  }

  async update(id: number, _updateLinkDto: UpdateLinkDto): Promise<void> {
    throw new RpcException({ statusCode: 403, message: 'Links are immutable' });
  }

  async remove(id: number): Promise<void> {
    throw new RpcException({ statusCode: 403, message: 'Links are immutable' });
  }
}
