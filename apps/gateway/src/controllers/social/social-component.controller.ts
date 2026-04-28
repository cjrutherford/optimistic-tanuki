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
import { ServiceTokens, SocialComponentCommands } from '@optimistic-tanuki/constants';
import {
  CreateSocialComponentDto,
  UpdateSocialComponentDto,
  SocialComponentQueryDto,
} from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('social-components')
export class SocialComponentController {
  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialService: ClientProxy,
    private readonly l: Logger
  ) {
    this.l.log('SocialComponentController initialized');
    console.log('SocialComponentController connecting to socialService...');
    this.socialService
      .connect()
      .then(() => {
        this.l.log('SocialComponentController connected to socialService');
      })
      .catch((e) => this.l.error('Error connecting to socialService', e));
  }

  @Post('')
  @RequirePermissions('social.post.create')
  async createSocialComponent(
    @Body() createComponentDto: CreateSocialComponentDto,
    @User() user: UserDetails
  ) {
    try {
      this.l.log('Creating social component for user:', user.userId);
      return await firstValueFrom(
        this.socialService.send(
          { cmd: SocialComponentCommands.CREATE },
          createComponentDto
        )
      );
    } catch (error) {
      this.l.error('Error creating social component:', error);
      throw new HttpException(
        error?.message || 'Failed to create social component',
        error?.status || 500
      );
    }
  }

  @Get('post/:postId')
  @Public()
  async getSocialComponents(@Param('postId') postId: string) {
    try {
      this.l.log('Getting social components for post:', postId);
      return await firstValueFrom(
        this.socialService.send(
          { cmd: SocialComponentCommands.FIND_BY_POST },
          { postId }
        )
      );
    } catch (error) {
      this.l.error('Error getting social components:', error);
      throw new HttpException(
        error?.message || 'Failed to get social components',
        error?.status || 500
      );
    }
  }

  @Get(':id')
  @Public()
  async getSocialComponent(@Param('id') id: string) {
    try {
      this.l.log('Getting social component:', id);
      return await firstValueFrom(
        this.socialService.send({ cmd: SocialComponentCommands.FIND }, { id })
      );
    } catch (error) {
      this.l.error('Error getting social component:', error);
      throw new HttpException(
        error?.message || 'Failed to get social component',
        error?.status || 404
      );
    }
  }

  @Put(':id')
  @RequirePermissions('social:post:update')
  async updateSocialComponent(
    @Param('id') id: string,
    @Body() updateComponentDto: UpdateSocialComponentDto,
    @User() user: UserDetails
  ) {
    try {
      this.l.log('Updating social component for user:', user.userId, 'id:', id);
      return await firstValueFrom(
        this.socialService.send(
          { cmd: SocialComponentCommands.UPDATE },
          { id, dto: updateComponentDto }
        )
      );
    } catch (error) {
      this.l.error('Error updating social component:', error);
      throw new HttpException(
        error?.message || 'Failed to update social component',
        error?.status || 500
      );
    }
  }

  @Delete(':id')
  @RequirePermissions('social:post:delete')
  async deleteSocialComponent(
    @Param('id') id: string,
    @User() user: UserDetails
  ) {
    try {
      this.l.log('Deleting social component for user:', user.userId, 'id:', id);
      return await firstValueFrom(
        this.socialService.send({ cmd: SocialComponentCommands.DELETE }, { id })
      );
    } catch (error) {
      this.l.error('Error deleting social component:', error);
      throw new HttpException(
        error?.message || 'Failed to delete social component',
        error?.status || 500
      );
    }
  }

  @Delete('post/:postId')
  @RequirePermissions('social:post:delete')
  async deleteComponentsByPost(
    @Param('postId') postId: string,
    @User() user: UserDetails
  ) {
    try {
      this.l.log('Deleting social components for post for user:', user.userId, 'postId:', postId);
      return await firstValueFrom(
        this.socialService.send(
          { cmd: SocialComponentCommands.DELETE_BY_POST },
          { postId }
        )
      );
    } catch (error) {
      this.l.error('Error deleting social components for post:', error);
      throw new HttpException(
        error?.message || 'Failed to delete social components for post',
        error?.status || 500
      );
    }
  }

  @Get('')
  @Public()
  async findComponentsByQuery(@Query() query: SocialComponentQueryDto) {
    try {
      this.l.log('Finding social components by query:', query);
      return await firstValueFrom(
        this.socialService.send({ cmd: SocialComponentCommands.FIND_BY_QUERY }, query)
      );
    } catch (error) {
      this.l.error('Error finding social components by query:', error);
      throw new HttpException(
        error?.message || 'Failed to find social components',
        error?.status || 500
      );
    }
  }
}
