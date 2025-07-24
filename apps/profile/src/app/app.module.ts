import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { Module } from '@nestjs/common';
import { Profile } from '../profiles/entities/profile.entity';
import { ProfileService } from './profile.service';
import { ProfilesController } from '../profiles/profiles.controller';
import { Timeline } from '../timelines/entities/timeline.entity';
import { TimelineService } from './timeline.service';
import { TimelinesController } from '../timelines/timelines.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
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
    {
      provide: getRepositoryToken(Profile),
      useFactory: (ds: DataSource) => ds.getRepository(Profile),
      inject: ['PROFILE_CONNECTION'],
    },{
      provide: getRepositoryToken(Timeline),
      useFactory: (ds: DataSource) => ds.getRepository(Timeline),
      inject: ['PROFILE_CONNECTION'],
    }
  ],
})
export class AppModule {}
