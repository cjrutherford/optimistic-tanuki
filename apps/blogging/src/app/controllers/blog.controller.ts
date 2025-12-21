import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BlogCommands } from '@optimistic-tanuki/constants';
import { BlogService, PostService, SitemapService } from '../services';
import {
  CreateBlogDto,
  BlogDto,
  BlogQueryDto,
  UpdateBlogDto,
} from '@optimistic-tanuki/models';

@Controller('blog')
export class BlogController {
  constructor(
    private readonly blogService: BlogService,
    private readonly postService: PostService,
    private readonly sitemapService: SitemapService
  ) {
    console.log('BlogController initialized');
  }

  @MessagePattern({ cmd: BlogCommands.CREATE })
  async createBlog(@Payload() createBlogDto: CreateBlogDto): Promise<BlogDto> {
    return await this.blogService.create(createBlogDto);
  }

  @MessagePattern({ cmd: BlogCommands.FIND_ALL })
  async findAllBlogs(@Payload() query: BlogQueryDto): Promise<BlogDto[]> {
    return await this.blogService.findAll(query);
  }

  @MessagePattern({ cmd: BlogCommands.FIND })
  async findOneBlog(@Payload() id: string): Promise<BlogDto> {
    return await this.blogService.findOne(id);
  }

  @MessagePattern({ cmd: BlogCommands.UPDATE })
  async updateBlog(
    @Payload() data: { id: string; updateBlogDto: UpdateBlogDto }
  ): Promise<BlogDto> {
    return await this.blogService.update(data.id, data.updateBlogDto);
  }

  @MessagePattern({ cmd: BlogCommands.DELETE })
  async deleteBlog(@Payload() id: string): Promise<void> {
    return await this.blogService.remove(id);
  }

  @MessagePattern({ cmd: BlogCommands.GENERATE_SITEMAP })
  async generateSitemap(@Payload() data: { baseUrl: string }): Promise<string> {
    const posts = await this.postService.findPublished();
    const blogs = await this.blogService.findAll({});
    return this.sitemapService.generateSitemap(data.baseUrl, posts, blogs);
  }
}
