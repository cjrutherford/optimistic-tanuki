import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BlogComponentCommands } from '@optimistic-tanuki/constants';
import { BlogComponentService } from '../services';
import {
  CreateBlogComponentDto,
  UpdateBlogComponentDto,
  BlogComponentQueryDto,
  BlogComponentDto,
} from '@optimistic-tanuki/models';

@Controller('blog-component')
export class BlogComponentController {
  constructor(
    private readonly blogComponentService: BlogComponentService
  ) {
    console.log('BlogComponentController initialized');
  }

  @MessagePattern({ cmd: BlogComponentCommands.CREATE })
  async createBlogComponent(
    @Payload() createComponentDto: CreateBlogComponentDto
  ): Promise<BlogComponentDto> {
    return await this.blogComponentService.create(createComponentDto);
  }

  @MessagePattern({ cmd: BlogComponentCommands.FIND_BY_POST })
  async getComponentsForPost(
    @Payload('postId') postId: string
  ): Promise<BlogComponentDto[]> {
    return await this.blogComponentService.findByPostId(postId);
  }

  @MessagePattern({ cmd: BlogComponentCommands.FIND })
  async findOneBlogComponent(
    @Payload('id') id: string
  ): Promise<BlogComponentDto> {
    return await this.blogComponentService.findOne(id);
  }

  @MessagePattern({ cmd: BlogComponentCommands.UPDATE })
  async updateBlogComponent(
    @Payload() data: { id: string; dto: UpdateBlogComponentDto }
  ): Promise<BlogComponentDto> {
    return await this.blogComponentService.update(data.id, data.dto);
  }

  @MessagePattern({ cmd: BlogComponentCommands.DELETE })
  async deleteBlogComponent(@Payload('id') id: string): Promise<void> {
    return await this.blogComponentService.remove(id);
  }

  @MessagePattern({ cmd: BlogComponentCommands.DELETE_BY_POST })
  async deleteComponentsByPost(@Payload('postId') postId: string): Promise<void> {
    return await this.blogComponentService.removeByPostId(postId);
  }

  @MessagePattern({ cmd: BlogComponentCommands.FIND_BY_QUERY })
  async findComponentsByQuery(
    @Payload() query: BlogComponentQueryDto
  ): Promise<BlogComponentDto[]> {
    return await this.blogComponentService.findByQuery(query);
  }
}