import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ImagesService, ImageInfo } from './images.service';

@ApiTags('images')
@Controller()
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get('api/deployment/images')
  @ApiOperation({ summary: 'Get image freshness information' })
  @ApiResponse({ status: 200, description: 'Image information returned' })
  getImages(): ImageInfo[] {
    return this.imagesService.getImages();
  }

  @Get('api/deployment/images/refresh')
  @ApiOperation({ summary: 'Force refresh image registry check' })
  @ApiResponse({ status: 200, description: 'Image information refreshed' })
  refreshImages(): ImageInfo[] {
    return this.imagesService.refreshImages();
  }

  @Post('api/deployment/images/rollout')
  @ApiOperation({ summary: 'Trigger rollout using specified tag' })
  @ApiResponse({ status: 200, description: 'Rollout triggered' })
  async rollout(@Body('tag') tag: string) {
    return { success: true, message: `Rollout triggered with tag ${tag}` };
  }
}
