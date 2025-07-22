import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProjectModule } from './project.module';
import { TaskModule } from './task.module';
import { RiskModule } from './risk.module';
import { ChangeModule } from './change.module';
import { TimerModule } from './timer.module';
import { ProjectJournalModule } from './project-journal.module';

@Module({
  imports: [
    ProjectModule,
    TaskModule,
    RiskModule,
    ChangeModule,
    TimerModule,
    ProjectJournalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
