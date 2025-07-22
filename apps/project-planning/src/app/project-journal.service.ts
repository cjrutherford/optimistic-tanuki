import { CreateProjectJournalDto, UpdateProjectJournalDto } from '@optimistic-tanuki/models';

import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectJournalService {
  create(createProjectJournalDto: CreateProjectJournalDto) {
    return 'This action adds a new projectJournal';
  }

  findAll() {
    return `This action returns all projectJournal`;
  }

  findOne(id: number) {
    return `This action returns a #${id} projectJournal`;
  }

  update(id: number, updateProjectJournalDto: UpdateProjectJournalDto) {
    return `This action updates a #${id} projectJournal`;
  }

  remove(id: number) {
    return `This action removes a #${id} projectJournal`;
  }
}
