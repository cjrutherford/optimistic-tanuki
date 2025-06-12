import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { DataSource } from 'typeorm';
import loadConfig from '../config';
import { Goal } from '../goals/entities/goal.entity';
import { GoalsController } from '../goals/goals.controller';
import { Profile } from '../profiles/entities/profile.entity';
import { ProfilesController } from '../profiles/profiles.controller';
import { Project } from '../projects/entities/project.entity';
import { ProjectsController } from '../projects/projects.controller';
import { Timeline } from '../timelines/entities/timeline.entity';
import { TimelinesController } from '../timelines/timelines.controller';
import { GoalService } from './goal.service';
import loadDatabase from './loadDatabase';
import { ProfileService } from './profile.service';
import { ProjectService } from './project.service';
import { TimelineService } from './timeline.service';

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
    GoalsController,
    ProjectsController,
    TimelinesController,
  ],
  providers: [
    GoalService,
    ProfileService,
    ProjectService,
    TimelineService,
    {
      provide: getRepositoryToken(Profile),
      useFactory: (ds: DataSource) => ds.getRepository(Profile),
      inject: ['PROFILE_CONNECTION'],
    },{
      provide: getRepositoryToken(Project),
      useFactory: (ds: DataSource) => ds.getRepository(Project),
      inject: ['PROFILE_CONNECTION'],
    },{
      provide: getRepositoryToken(Goal),
      useFactory: (ds: DataSource) => ds.getRepository(Goal),
      inject: ['PROFILE_CONNECTION'],
    },{
      provide: getRepositoryToken(Timeline),
      useFactory: (ds: DataSource) => ds.getRepository(Timeline),
      inject: ['PROFILE_CONNECTION'],
    }
  ],
})
export class AppModule {}
