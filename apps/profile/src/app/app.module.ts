import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfilesController } from '../profiles/profiles.controller';
import { TimelineService } from './timeline.service';
import { TimelinesController } from '../timelines/timelines.controller';
import loadConfig from '../config';
import loadDatabase from './loadDatabase';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'profile',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [
    ProfilesController,
    TimelinesController,
  ],
  providers: [
    ProfileService,
    TimelineService,
  ],
})
export class AppModule {}
