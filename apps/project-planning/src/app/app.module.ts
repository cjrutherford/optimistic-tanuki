import { ChangeController } from './change/change.controller';
import { ChangeService } from './change/change.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { Module } from '@nestjs/common';
import { ProjectController } from './project/project.controller';
import { ProjectJournalController } from './project-journal/project-journal.controller';
import { ProjectJournalService } from './project-journal/project-journal.service';
import { ProjectService } from './project/project.service';
import { RiskController } from './risk/risk.controller';
import { RiskService } from './risk/risk.service';
import { TaskController } from './task/task.controller';
import { TaskService } from './task/task.service';
import { TimerController } from './timer/timer.controller';
import { TimerService } from './timer/timer.service';
import { loadConfig } from './config';
import loadDatabase from './loadDatabase';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig]
    }),
    LoggerModule,
    DatabaseModule.register({ name: 'project_planning', factory: loadDatabase }),
  ],
  controllers: [
    ChangeController,
    ProjectController,
    ProjectJournalController,
    RiskController,
    TaskController,
    TimerController
  ],
  providers: [
    ChangeService,
    ProjectService,
    ProjectJournalService,
    RiskService,
    TaskService,
    TimerService,
  ],
})
export class AppModule {}
