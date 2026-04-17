import { Controller, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger('BlogComponentController');
  constructor(
    private readonly blogComponentService: BlogComponentService
  ) {
    this.logger.log('BlogComponentController initialized');
  }

  @MessagePattern({ cmd: BlogComponentCommands.CREATE })
  async createBlogComponent(
    @Payload() createComponentDto: CreateBlogComponentDto
  ): Promise<BlogComponentDto> {
    this.logger.log(`CREATE component postId=${createComponentDto.blogPostId} instanceId=${createComponentDto.instanceId}`);
    try {
      const res = await this.blogComponentService.create(createComponentDto);
      this.logger.log(`CREATED component id=${res.id}`);
      return res;
    } catch (e) {
      this.logger.error(`CREATE failed: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: BlogComponentCommands.FIND_BY_POST })
  async getComponentsForPost(
    @Payload('postId') postId: string
  ): Promise<BlogComponentDto[]> {
    this.logger.log(`FIND_BY_POST postId=${postId}`);
    try {
      const comps = await this.blogComponentService.findByPostId(postId);
      this.logger.log(`FIND_BY_POST found=${comps.length}`);
      return comps;
    } catch (e) {
      this.logger.error(`FIND_BY_POST failed: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: BlogComponentCommands.FIND })
  async findOneBlogComponent(
    @Payload('id') id: string
  ): Promise<BlogComponentDto> {
    this.logger.log(`FIND id=${id}`);
    try {
      const comp = await this.blogComponentService.findOne(id);
      this.logger.log(`FIND found=${!!comp}`);
      return comp;
    } catch (e) {
      this.logger.error(`FIND failed: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: BlogComponentCommands.UPDATE })
  async updateBlogComponent(
    @Payload() data: { id: string; dto: UpdateBlogComponentDto }
  ): Promise<BlogComponentDto> {
    this.logger.log(`UPDATE id=${data.id}`);
    try {
      const res = await this.blogComponentService.update(data.id, data.dto);
      this.logger.log(`UPDATED id=${res.id}`);
      return res;
    } catch (e) {
      this.logger.error(`UPDATE failed id=${data.id}: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: BlogComponentCommands.DELETE })
  async deleteBlogComponent(@Payload('id') id: string): Promise<void> {
    this.logger.log(`DELETE id=${id}`);
    try {
      const res = await this.blogComponentService.remove(id);
      this.logger.log(`DELETED id=${id}`);
      return res;
    } catch (e) {
      this.logger.error(`DELETE failed id=${id}: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: BlogComponentCommands.DELETE_BY_POST })
  async deleteComponentsByPost(@Payload('postId') postId: string): Promise<void> {
    this.logger.log(`DELETE_BY_POST postId=${postId}`);
    try {
      const res = await this.blogComponentService.removeByPostId(postId);
      this.logger.log(`DELETED_BY_POST postId=${postId}`);
      return res;
    } catch (e) {
      this.logger.error(`DELETE_BY_POST failed postId=${postId}: ${e?.message || e}`);
      throw e;
    }
  }

  @MessagePattern({ cmd: BlogComponentCommands.FIND_BY_QUERY })
  async findComponentsByQuery(
    @Payload() query: BlogComponentQueryDto
  ): Promise<BlogComponentDto[]> {
    this.logger.log(`FIND_BY_QUERY keys=${Object.keys(query || {}).join(',')}`);
    try {
      const comps = await this.blogComponentService.findByQuery(query);
      this.logger.log(`FIND_BY_QUERY found=${comps.length}`);
      return comps;
    } catch (e) {
      this.logger.error(`FIND_BY_QUERY failed: ${e?.message || e}`);
      throw e;
    }
  }
}