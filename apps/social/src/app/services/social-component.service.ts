import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SocialComponent } from '../../entities/social-component.entity';
import { Post } from '../../entities/post.entity';
import { Repository } from 'typeorm';
import {
  CreateSocialComponentDto,
  UpdateSocialComponentDto,
  SocialComponentQueryDto,
  SocialComponentDto,
} from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class SocialComponentService {
  constructor(
    @Inject(getRepositoryToken(SocialComponent))
    private readonly socialComponentRepository: Repository<SocialComponent>,
    @Inject(getRepositoryToken(Post))
    private readonly postRepository: Repository<Post>
  ) {
    console.log('SocialComponentService initialized');
  }

  async create(createComponentDto: CreateSocialComponentDto): Promise<SocialComponentDto> {
    try {
      // Validate that the post exists
      const postExists = await this.postRepository.findOne({
        where: { id: createComponentDto.postId }
      });

      if (!postExists) {
        throw new NotFoundException('Social post not found');
      }

      // Check for duplicate instance IDs within the same post
      const existingComponent = await this.socialComponentRepository.findOne({
        where: {
          postId: createComponentDto.postId,
          instanceId: createComponentDto.instanceId
        }
      });

      if (existingComponent) {
        throw new BadRequestException('Component instance ID already exists for this post');
      }

      const component = this.socialComponentRepository.create(createComponentDto);
      const savedComponent = await this.socialComponentRepository.save(component);
      return this.mapToDto(savedComponent);
    } catch (error) {
      console.error('Error creating social component:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new RpcException({
        message: 'Failed to create social component',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async findByPostId(postId: string): Promise<SocialComponentDto[]> {
    try {
      const components = await this.socialComponentRepository.find({
        where: { postId },
        order: { position: 'ASC', createdAt: 'ASC' }
      });
      return components.map(component => this.mapToDto(component));
    } catch (error) {
      console.error('Error finding social components:', error);
      throw new RpcException({
        message: 'Failed to fetch social components',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async findOne(id: string): Promise<SocialComponentDto> {
    try {
      const component = await this.socialComponentRepository.findOne({
        where: { id }
      });

      if (!component) {
        throw new NotFoundException('Social component not found');
      }

      return this.mapToDto(component);
    } catch (error) {
      console.error('Error finding social component:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new RpcException({
        message: 'Failed to fetch social component',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async update(id: string, updateComponentDto: UpdateSocialComponentDto): Promise<SocialComponentDto> {
    try {
      const component = await this.socialComponentRepository.findOne({
        where: { id }
      });

      if (!component) {
        throw new NotFoundException('Social component not found');
      }

      // Merge the update data
      Object.assign(component, updateComponentDto);
      
      const savedComponent = await this.socialComponentRepository.save(component);
      return this.mapToDto(savedComponent);
    } catch (error) {
      console.error('Error updating social component:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new RpcException({
        message: 'Failed to update social component',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const component = await this.socialComponentRepository.findOne({
        where: { id }
      });

      if (!component) {
        throw new NotFoundException('Social component not found');
      }

      await this.socialComponentRepository.remove(component);
    } catch (error) {
      console.error('Error removing social component:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new RpcException({
        message: 'Failed to remove social component',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async removeByPostId(postId: string): Promise<void> {
    try {
      await this.socialComponentRepository.delete({ postId });
    } catch (error) {
      console.error('Error removing social components for post:', error);
      throw new RpcException({
        message: 'Failed to remove social components for post',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async findByQuery(query: SocialComponentQueryDto): Promise<SocialComponentDto[]> {
    try {
      const whereConditions: any = {};

      if (query.id) whereConditions.id = query.id;
      if (query.postId) whereConditions.postId = query.postId;
      if (query.instanceId) whereConditions.instanceId = query.instanceId;
      if (query.componentType) whereConditions.componentType = query.componentType;

      const components = await this.socialComponentRepository.find({
        where: whereConditions,
        order: { position: 'ASC', createdAt: 'ASC' }
      });

      return components.map(component => this.mapToDto(component));
    } catch (error) {
      console.error('Error finding social components by query:', error);
      throw new RpcException({
        message: 'Failed to fetch social components',
        details: error?.message || 'Unknown error'
      });
    }
  }

  private mapToDto(component: SocialComponent): SocialComponentDto {
    return {
      id: component.id,
      postId: component.postId,
      instanceId: component.instanceId,
      componentType: component.componentType,
      componentData: component.componentData,
      position: component.position,
      createdAt: component.createdAt,
      updatedAt: component.updatedAt,
    };
  }
}
