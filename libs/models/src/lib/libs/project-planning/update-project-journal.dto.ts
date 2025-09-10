import { CreateProjectJournalDto } from './create-project-journal.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateProjectJournalDto extends PartialType(CreateProjectJournalDto) {
  id: string;
}

export class QueryProjectJournalDto extends PartialType(CreateProjectJournalDto) {
  createdBy?: string;
  updatedBy?: string;
  createdAt?: [Date, Date];
  updatedAt?: [Date, Date];
}