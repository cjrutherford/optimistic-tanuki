import { Module } from '@nestjs/common';
import { BriefingService } from './briefing.service';
import { CollateModule } from '../collate/collate.module';
import { StoriesModule } from '../stories/stories.module';

@Module({
  imports: [CollateModule, StoriesModule],
  providers: [BriefingService],
  exports: [BriefingService],
})
export class BriefingModule {}
