import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogComponent, Post } from '../entities';
import { Repository } from 'typeorm';
import {
  CreateBlogComponentDto,
  UpdateBlogComponentDto,
  BlogComponentQueryDto,
  BlogComponentDto,
} from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class BlogComponentService {
  constructor(
    @Inject(getRepositoryToken(BlogComponent))
    private readonly blogComponentRepository: Repository<BlogComponent>,
    @Inject(getRepositoryToken(Post))
    private readonly postRepository: Repository<Post>
  ) {
    console.log('BlogComponentService initialized');
  }

  async create(createComponentDto: CreateBlogComponentDto): Promise<BlogComponentDto> {
    try {
      // Validate that the blog post exists
      const postExists = await this.postRepository.findOne({
        where: { id: createComponentDto.blogPostId }
      });

      if (!postExists) {
        throw new NotFoundException('Blog post not found');
      }

      // Check for duplicate instance IDs within the same post
      const existingComponent = await this.blogComponentRepository.findOne({
        where: {
          blogPostId: createComponentDto.blogPostId,
          instanceId: createComponentDto.instanceId
        }
      });

      if (existingComponent) {
        throw new BadRequestException('Component instance ID already exists for this post');
      }

      const component = this.blogComponentRepository.create(createComponentDto);
      const savedComponent = await this.blogComponentRepository.save(component);
      return this.mapToDto(savedComponent);
    } catch (error) {
      console.error('Error creating blog component:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new RpcException({
        message: 'Failed to create blog component',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async findByPostId(postId: string): Promise<BlogComponentDto[]> {
    try {
      const components = await this.blogComponentRepository.find({
        where: { blogPostId: postId },
        order: { position: 'ASC', createdAt: 'ASC' }
      });
      return components.map(component => this.mapToDto(component));
    } catch (error) {
      console.error('Error finding blog components:', error);
      throw new RpcException({
        message: 'Failed to fetch blog components',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async findOne(id: string): Promise<BlogComponentDto> {
    try {
      const component = await this.blogComponentRepository.findOne({
        where: { id }
      });

      if (!component) {
        throw new NotFoundException('Blog component not found');
      }

      return this.mapToDto(component);
    } catch (error) {
      console.error('Error finding blog component:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new RpcException({
        message: 'Failed to fetch blog component',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async update(id: string, updateComponentDto: UpdateBlogComponentDto): Promise<BlogComponentDto> {
    try {
      const component = await this.blogComponentRepository.findOne({
        where: { id }
      });

      if (!component) {
        throw new NotFoundException('Blog component not found');
      }

      // Merge the update data
      Object.assign(component, updateComponentDto);
      
      const savedComponent = await this.blogComponentRepository.save(component);
      return this.mapToDto(savedComponent);
    } catch (error) {
      console.error('Error updating blog component:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new RpcException({
        message: 'Failed to update blog component',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const component = await this.blogComponentRepository.findOne({
        where: { id }
      });

      if (!component) {
        throw new NotFoundException('Blog component not found');
      }

      await this.blogComponentRepository.remove(component);
    } catch (error) {
      console.error('Error removing blog component:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new RpcException({
        message: 'Failed to remove blog component',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async removeByPostId(postId: string): Promise<void> {
    try {
      await this.blogComponentRepository.delete({ blogPostId: postId });
    } catch (error) {
      console.error('Error removing blog components for post:', error);
      throw new RpcException({
        message: 'Failed to remove blog components for post',
        details: error?.message || 'Unknown error'
      });
    }
  }

  async findByQuery(query: BlogComponentQueryDto): Promise<BlogComponentDto[]> {
    try {
      const whereConditions: any = {};

      if (query.id) whereConditions.id = query.id;
      if (query.blogPostId) whereConditions.blogPostId = query.blogPostId;
      if (query.instanceId) whereConditions.instanceId = query.instanceId;
      if (query.componentType) whereConditions.componentType = query.componentType;

      const components = await this.blogComponentRepository.find({
        where: whereConditions,
        order: { position: 'ASC', createdAt: 'ASC' }
      });

      return components.map(component => this.mapToDto(component));
    } catch (error) {
      console.error('Error finding blog components by query:', error);
      throw new RpcException({
        message: 'Failed to fetch blog components',
        details: error?.message || 'Unknown error'
      });
    }
  }

  private mapToDto(component: BlogComponent): BlogComponentDto {
    return {
      id: component.id,
      blogPostId: component.blogPostId,
      instanceId: component.instanceId,
      componentType: component.componentType,
      componentData: component.componentData,
      position: component.position,
      createdAt: component.createdAt,
      updatedAt: component.updatedAt,
    };
  }
}