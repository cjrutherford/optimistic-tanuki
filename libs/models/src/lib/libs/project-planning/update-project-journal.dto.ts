import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectJournalDto } from './create-project-journal.dto';

export class UpdateProjectJournalDto extends PartialType(CreateProjectJournalDto) {
  id: string;
}
