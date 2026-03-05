import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ActivityCommands,
  SavedItemCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../../auth/auth.guard';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

export interface CreateActivityDto {
  profileId: string;
  type: 'post' | 'comment' | 'like' | 'share' | 'follow' | 'mention';
  description: string;
  resourceId?: string;
  resourceType?: string;
}

export interface ActivityDto {
  id: string;
  profileId: string;
  type: string;
  description: string;
  resourceId?: string;
  resourceType?: string;
  createdAt: Date;
}

export interface SaveItemDto {
  itemType: 'post' | 'comment';
  itemId: string;
  itemTitle?: string;
}

export interface SavedItemDto {
  id: string;
  profileId: string;
  itemType: string;
  itemId: string;
  itemTitle?: string;
  savedAt: Date;
}

@UseGuards(AuthGuard)
@ApiTags('activity')
@Controller('activity')
export class ActivityController {
  private readonly logger = new Logger(ActivityController.name);

  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE)
    private readonly socialClient: ClientProxy
  ) {}

  @Get(':profileId')
  @ApiOperation({ summary: 'Get all activity for a profile' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({
    status: 200,
    description: 'The activities have been successfully retrieved.',
  })
  async getActivity(
    @Param('profileId') profileId: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ): Promise<ActivityDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: ActivityCommands.FIND_BY_PROFILE },
        {
          profileId,
          type,
          limit: limit ? Number(limit) : 50,
          offset: offset ? Number(offset) : 0,
        }
      )
    );
  }

  @Get(':profileId/saved')
  @ApiOperation({ summary: 'Get all saved items for a profile' })
  @ApiResponse({
    status: 200,
    description: 'The saved items have been successfully retrieved.',
  })
  async getSavedItems(
    @Param('profileId') profileId: string
  ): Promise<SavedItemDto[]> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: SavedItemCommands.FIND_SAVED },
        { profileId }
      )
    );
  }

  @Post(':profileId/saved')
  @ApiOperation({ summary: 'Save an item' })
  @ApiResponse({
    status: 201,
    description: 'The item has been successfully saved.',
  })
  async saveItem(
    @Param('profileId') profileId: string,
    @Body() saveItemDto: SaveItemDto
  ): Promise<SavedItemDto> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: SavedItemCommands.SAVE },
        {
          profileId,
          itemType: saveItemDto.itemType,
          itemId: saveItemDto.itemId,
          itemTitle: saveItemDto.itemTitle,
        }
      )
    );
  }

  @Delete(':profileId/saved/:itemId')
  @ApiOperation({ summary: 'Unsave an item' })
  @ApiResponse({
    status: 200,
    description: 'The item has been successfully unsaved.',
  })
  async unsaveItem(
    @Param('profileId') profileId: string,
    @Param('itemId') itemId: string
  ): Promise<{ success: boolean }> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: SavedItemCommands.UNSAVE },
        { profileId, itemId }
      )
    );
  }

  @Get(':profileId/saved/:itemId')
  @ApiOperation({ summary: 'Check if an item is saved' })
  @ApiResponse({
    status: 200,
    description: 'Whether the item is saved.',
  })
  async isItemSaved(
    @Param('profileId') profileId: string,
    @Param('itemId') itemId: string
  ): Promise<{ saved: boolean }> {
    return await firstValueFrom(
      this.socialClient.send(
        { cmd: SavedItemCommands.IS_SAVED },
        { profileId, itemId }
      )
    );
  }
}
