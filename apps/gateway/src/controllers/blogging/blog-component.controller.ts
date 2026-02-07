import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BlogComponentCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  BlogComponentQueryDto,
  CreateBlogComponentDto,
  UpdateBlogComponentDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('blog-components')
export class BlogComponentController {
  constructor(
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly blogService: ClientProxy,
    private readonly l: Logger
  ) {
    this.l.log('BlogComponentController initialized');
    console.log('BlogComponentController connecting to blogService...');
    this.blogService
      .connect()
      .then(() => {
        this.l.log('BlogComponentController connected to blogService');
      })
      .catch((e) => this.l.error('Error connecting to blogService', e));
  }

  @Post('')
  @RequirePermissions('blog.post.create')
  async createBlogComponent(
    @Body() createComponentDto: CreateBlogComponentDto,
    @User() user: UserDetails
  ) {
    try {
      this.l.log('Creating blog component for user:', user.userId);
      return await firstValueFrom(
        this.blogService.send(
          { cmd: BlogComponentCommands.CREATE },
          createComponentDto
        )
      );
    } catch (error) {
      this.l.error('Error creating blog component:', error);
      throw new HttpException(
        error?.message || 'Failed to create blog component',
        error?.status || 500
      );
    }
  }

  @Get('post/:postId')
  async getBlogComponents(@Param('postId') postId: string) {
    try {
      this.l.log('Getting blog components for post:', postId);
      return await firstValueFrom(
        this.blogService.send(
          { cmd: BlogComponentCommands.FIND_BY_POST },
          { postId }
        )
      );
    } catch (error) {
      this.l.error('Error getting blog components:', error);
      throw new HttpException(
        error?.message || 'Failed to get blog components',
        error?.status || 500
      );
    }
  }

  @Get(':id')
  async getBlogComponent(@Param('id') id: string) {
    try {
      this.l.log('Getting blog component:', id);
      return await firstValueFrom(
        this.blogService.send({ cmd: BlogComponentCommands.FIND }, { id })
      );
    } catch (error) {
      this.l.error('Error getting blog component:', error);
      throw new HttpException(
        error?.message || 'Failed to get blog component',
        error?.status || 404
      );
    }
  }

  @Put(':id')
  @RequirePermissions('blog.post.update')
  async updateBlogComponent(
    @Param('id') id: string,
    @Body() updateComponentDto: UpdateBlogComponentDto,
    @User() user: UserDetails
  ) {
    try {
      this.l.log('Updating blog component for user:', user.userId, 'id:', id);
      return await firstValueFrom(
        this.blogService.send(
          { cmd: BlogComponentCommands.UPDATE },
          { id, dto: updateComponentDto }
        )
      );
    } catch (error) {
      this.l.error('Error updating blog component:', error);
      throw new HttpException(
        error?.message || 'Failed to update blog component',
        error?.status || 500
      );
    }
  }

  @Delete(':id')
  @RequirePermissions('blog.post.delete')
  async deleteBlogComponent(
    @Param('id') id: string,
    @User() user: UserDetails
  ) {
    try {
      this.l.log('Deleting blog component for user:', user.userId, 'id:', id);
      return await firstValueFrom(
        this.blogService.send({ cmd: BlogComponentCommands.DELETE }, { id })
      );
    } catch (error) {
      this.l.error('Error deleting blog component:', error);
      throw new HttpException(
        error?.message || 'Failed to delete blog component',
        error?.status || 500
      );
    }
  }

  @Delete('post/:postId')
  @RequirePermissions('blog.post.delete')
  async deleteComponentsByPost(
    @Param('postId') postId: string,
    @User() user: UserDetails
  ) {
    try {
      this.l.log('Deleting blog components for post for user:', user.userId, 'postId:', postId);
      return await firstValueFrom(
        this.blogService.send(
          { cmd: BlogComponentCommands.DELETE_BY_POST },
          { postId }
        )
      );
    } catch (error) {
      this.l.error('Error deleting blog components for post:', error);
      throw new HttpException(
        error?.message || 'Failed to delete blog components for post',
        error?.status || 500
      );
    }
  }

  @Get('')
  async findComponentsByQuery(@Query() query: BlogComponentQueryDto) {
    try {
      this.l.log('Finding blog components by query:', query);
      return await firstValueFrom(
        this.blogService.send({ cmd: BlogComponentCommands.FIND_BY_QUERY }, query)
      );
    } catch (error) {
      this.l.error('Error finding blog components by query:', error);
      throw new HttpException(
        error?.message || 'Failed to find blog components',
        error?.status || 500
      );
    }
  }
}