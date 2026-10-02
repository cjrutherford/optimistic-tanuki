import { Module } from '@nestjs/common';
import { StoryDevelopmentService } from './story-development.service';

@Module({
  providers: [StoryDevelopmentService],
  exports: [StoryDevelopmentService],
})
export class StoriesModule {}
