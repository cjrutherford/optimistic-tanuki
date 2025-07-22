import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectJournalService } from './project-journal.service';
import { CreateProjectJournalDto, UpdateProjectJournalDto } from '@optimistic-tanuki/models';

@Controller()
export class ProjectJournalController {
  constructor(private readonly projectJournalService: ProjectJournalService) {}

  @MessagePattern('createProjectJournal')
  create(@Payload() createProjectJournalDto: CreateProjectJournalDto) {
    return this.projectJournalService.create(createProjectJournalDto);
  }

  @MessagePattern('findAllProjectJournal')
  findAll() {
    return this.projectJournalService.findAll();
  }

  @MessagePattern('findOneProjectJournal')
  findOne(@Payload() id: number) {
    return this.projectJournalService.findOne(id);
  }

  @MessagePattern('updateProjectJournal')
  update(@Payload() updateProjectJournalDto: UpdateProjectJournalDto) {
    return this.projectJournalService.update(
      updateProjectJournalDto.id,
      updateProjectJournalDto
    );
  }

  @MessagePattern('removeProjectJournal')
  remove(@Payload() id: number) {
    return this.projectJournalService.remove(id);
  }
}
