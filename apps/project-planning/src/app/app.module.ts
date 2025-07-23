import { Module } from '@nestjs/common';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProjectModule } from './project.module';
import { TaskModule } from './task.module';
import { RiskModule } from './risk.module';
import { ChangeModule } from './change.module';
import { TimerModule } from './timer.module';
import { ProjectJournalModule } from './project-journal.module';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './config';
import loadDatabase from './loadDatabase';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { DataSource } from 'typeorm';
import { ProjectJournal } from './entities/project-journal.entity';
import { Task } from './entities/task.entity';
import { Risk } from './entities/risk.entity';
import { Change } from './entities/change.entity';
import { Timer } from './entities/timer.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig]
    }),
    LoggerModule,
    DatabaseModule.register({ name: 'project-planning', factory: loadDatabase }),
    ProjectModule,
    TaskModule,
    RiskModule,
    ChangeModule,
    TimerModule,
    ProjectJournalModule,
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: getRepositoryToken(Project),
      useFactory: (connection: DataSource) => connection.getRepository(Project),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },{
      provide: getRepositoryToken(ProjectJournal),
      useFactory: (connection: DataSource) => connection.getRepository(ProjectJournal),
      inject: ['PROJECT_PLANNING_CONNECTION'], 
    },{
      provide: getRepositoryToken(Task),
      useFactory: (connection: DataSource) => connection.getRepository(Task),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },{
      provide: getRepositoryToken(Risk),
      useFactory: (connection: DataSource) => connection.getRepository(Risk),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },{
      provide: getRepositoryToken(Change),
      useFactory: (connection: DataSource) => connection.getRepository(Change),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    },{
      provide: getRepositoryToken(Timer),
      useFactory: (connection: DataSource) => connection.getRepository(Timer),
      inject: ['PROJECT_PLANNING_CONNECTION'],
    }
  ],
})
export class AppModule {}
