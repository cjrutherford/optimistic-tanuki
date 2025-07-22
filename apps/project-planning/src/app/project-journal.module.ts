import { Module } from '@nestjs/common';
import { ProjectJournalService } from './project-journal.service';
import { ProjectJournalController } from './project-journal.controller';

@Module({
  controllers: [ProjectJournalController],
  providers: [ProjectJournalService],
})
export class ProjectJournalModule {}
