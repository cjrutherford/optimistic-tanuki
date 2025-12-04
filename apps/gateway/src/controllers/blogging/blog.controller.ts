import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BlogCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  BlogQueryDto,
  CreateBlogDto,
  UpdateBlogDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { AuthGuard } from '../../auth/auth.guard';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('blog')
export class BlogController {
  constructor(
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly blogService: ClientProxy,
    private readonly l: Logger
  ) {
    this.l.log('BlogController initialized');
    console.log('BlogController connecting to blogService...');
    this.blogService
      .connect()
      .then(() => {
        this.l.log('BlogController connected to blogService');
      })
      .catch((e) => this.l.error('Error connecting to blogService', e));
  }

  @Post()
  @RequirePermissions('create:blog')
  async createBlog(@Body() createBlog: CreateBlogDto) {
    try {
      const blog = await firstValueFrom(
        this.blogService.send({ cmd: BlogCommands.CREATE }, createBlog)
      );
      this.l.log('Blog created successfully');
      return blog;
    } catch (error) {
      this.l.error('Error creating blog', error);
      throw new HttpException(
        'Failed to create blog: [' + error.message + ']',
        500
      );
    }
  }

  @Post('/find')
  // @RequirePermissions('read:blog', 'view:public')
  async findAllBlogs(@Body() query: BlogQueryDto) {
    try {
      const blogs = await firstValueFrom(
        this.blogService.send({ cmd: BlogCommands.FIND_ALL }, query)
      );
      this.l.log('Blogs retrieved successfully');
      return blogs;
    } catch (error) {
      this.l.error('Error retrieving blogs', error);
      throw new HttpException(
        'Failed to retrieve blogs: [' + error.message + ']',
        500
      );
    }
  }

  @Get('/:id')
  async getBlog(@Param('id') id: string) {
    try {
      const blog = await firstValueFrom(
        this.blogService.send({ cmd: BlogCommands.FIND }, id)
      );
      if (!blog) {
        this.l.error(`Blog ${id} not found`);
        throw new HttpException('Blog not found', 404);
      }
      this.l.log(`Blog ${id} retrieved successfully`);
      return blog;
    } catch (error) {
      this.l.error(`Error retrieving blog ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve blog: [' + error.message + ']',
        500
      );
    }
  }

  @Patch('/:id')
  async updateBlog(@Param('id') id: string, @Body() updateData: UpdateBlogDto) {
    try {
      const updatedBlog = await firstValueFrom(
        this.blogService.send(
          { cmd: BlogCommands.UPDATE },
          { id, updateBlogDto: updateData }
        )
      );
      if (!updatedBlog) {
        throw new HttpException('Blog not found', 404);
      }
      this.l.log(`Blog ${id} updated successfully`);
      return updatedBlog;
    } catch (error) {
      this.l.error(`Error updating blog ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to update blog: [' + error.message + ']',
        500
      );
    }
  }

  @Delete('/:id')
  async deleteBlog(@Param('id') id: string) {
    try {
      await firstValueFrom(
        this.blogService.send({ cmd: BlogCommands.DELETE }, id)
      );
      this.l.log(`Blog ${id} deleted successfully`);
      return { message: 'Blog deleted successfully' };
    } catch (error) {
      this.l.error(`Error deleting blog ${id}`, error);
      throw new HttpException(
        'Failed to delete blog: [' + error.message + ']',
        500
      );
    }
  }
}
