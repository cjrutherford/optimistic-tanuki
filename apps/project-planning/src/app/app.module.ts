import { Change } from './entities/change.entity';
import { ChangeController } from './change/change.controller';
import { ChangeService } from './change/change.service';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { Module } from '@nestjs/common';
import { Project } from './entities/project.entity';
import { ProjectController } from './project/project.controller';
import { ProjectJournal } from './entities/project-journal.entity';
import { ProjectJournalController } from './project-journal/project-journal.controller';
import { ProjectJournalService } from './project-journal/project-journal.service';
import { ProjectService } from './project/project.service';
import { Risk } from './entities/risk.entity';
import { RiskController } from './risk/risk.controller';
import { RiskService } from './risk/risk.service';
import { Task } from './entities/task.entity';
import { TaskController } from './task/task.controller';
import { TaskService } from './task/task.service';
import { Timer } from './entities/timer.entity';
import { TimerController } from './timer/timer.controller';
import { TimerService } from './timer/timer.service';
import { TaskTimeEntry } from './entities/task-time-entry.entity';
import { TaskTimeEntryController } from './task-time-entry/task-time-entry.controller';
import { TaskTimeEntryService } from './task-time-entry/task-time-entry.service';
import { TaskTag } from './entities/task-tag.entity';
import { TaskTagController } from './task-tag/task-tag.controller';
import { TaskTagService } from './task-tag/task-tag.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { loadConfig } from './config';
import loadDatabase from './loadDatabase';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    LoggerModule,
    DatabaseModule.register({
      name: 'project_planning',
      factory: loadDatabase,
    }),
  ],
  controllers: [
    ChangeController,
    ProjectController,
    ProjectJournalController,
    RiskController,
    TaskController,
    TimerController,
    TaskTimeEntryController,
    TaskTagController,
    AnalyticsController,
  ],
  providers: [
    ChangeService,
    ProjectService,
    ProjectJournalService,
    RiskService,
    TaskService,
    TimerService,
    TaskTimeEntryService,
    TaskTagService,
    AnalyticsService,
    {
      provide: getRepositoryToken(Project),
      useFactory: (connection: DataSource) => connection.getRepository(Project),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ProjectJournal),
      useFactory: (connection: DataSource) =>
        connection.getRepository(ProjectJournal),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Task),
      useFactory: (connection: DataSource) => connection.getRepository(Task),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Risk),
      useFactory: (connection: DataSource) => connection.getRepository(Risk),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Change),
      useFactory: (connection: DataSource) => connection.getRepository(Change),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Timer),
      useFactory: (connection: DataSource) => connection.getRepository(Timer),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(TaskTimeEntry),
      useFactory: (connection: DataSource) =>
        connection.getRepository(TaskTimeEntry),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },
    {
      provide: getRepositoryToken(TaskTag),
      useFactory: (connection: DataSource) =>
        connection.getRepository(TaskTag),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },
  ],
})
export class AppModule {}
