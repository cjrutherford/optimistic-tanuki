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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BlogPostCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  BlogPostQueryDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('post')
export class PostController {
  constructor(
    @Inject(ServiceTokens.BLOG_SERVICE)
    private readonly postService: ClientProxy,
    private readonly l: Logger
  ) {
    this.l.log('PostController initialized');
    console.log('PostController connecting to postService...');
    this.postService
      .connect()
      .then(() => {
        this.l.log('PostController connected to postService');
      })
      .catch((e) => this.l.error('Error connecting to postService', e));
  }

  @Post()
  @RequirePermissions('blog.post.create')
  async createPost(@Body() createPost: CreateBlogPostDto) {
    try {
      const post = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.CREATE }, createPost)
      );
      this.l.log('Post created successfully');
      return post;
    } catch (error) {
      this.l.error('Error creating post', error);
      throw new HttpException(
        'Failed to create post: [' + error.message + ']',
        500
      );
    }
  }

  @Post('/find')
  // @RequirePermissions('blog.post.read')
  async findAllPosts(@Body() query: BlogPostQueryDto) {
    try {
      const posts = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.FIND_ALL }, query)
      );
      this.l.log('Posts retrieved successfully');
      return posts;
    } catch (error) {
      this.l.error('Error retrieving posts', error);
      throw new HttpException(
        'Failed to retrieve posts: [' + error.message + ']',
        500
      );
    }
  }

  @Get('/:id')
  // @RequirePermissions('blog.post.read', 'public')
  async getPost(@Param('id') id: string) {
    try {
      const post = await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.FIND }, id)
      );
      if (!post) {
        this.l.error(`Post ${id} not found`);
        throw new HttpException('Post not found', 404);
      }
      this.l.log(`Post ${id} retrieved successfully`);
      return post;
    } catch (error) {
      this.l.error(`Error retrieving post ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve post: [' + error.message + ']',
        500
      );
    }
  }

  @Patch('/:id')
  @RequirePermissions('blog.post.update')
  async updatePost(
    @Param('id') id: string,
    @Body() updateData: UpdateBlogPostDto
  ) {
    try {
      const updatedPost = await firstValueFrom(
        this.postService.send(
          { cmd: BlogPostCommands.UPDATE },
          { id, updatePostDto: updateData }
        )
      );
      if (!updatedPost) {
        throw new HttpException('Post not found', 404);
      }
      this.l.log(`Post ${id} updated successfully`);
      return updatedPost;
    } catch (error) {
      this.l.error(`Error updating post ${id}`, error);
      if (error.status === 404) {
        throw error;
      }
      throw new HttpException(
        'Failed to update post: [' + error.message + ']',
        500
      );
    }
  }

  @Delete('/:id')
  @RequirePermissions('blog.post.delete')
  async deletePost(@Param('id') id: string) {
    try {
      await firstValueFrom(
        this.postService.send({ cmd: BlogPostCommands.DELETE }, id)
      );
      this.l.log(`Post ${id} deleted successfully`);
      return { message: 'Post deleted successfully' };
    } catch (error) {
      this.l.error(`Error deleting post ${id}`, error);
      throw new HttpException(
        'Failed to delete post: [' + error.message + ']',
        500
      );
    }
  }
}
