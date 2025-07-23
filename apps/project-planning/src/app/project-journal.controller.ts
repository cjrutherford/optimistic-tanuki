import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectJournalService } from './project-journal.service';
import { CreateProjectJournalDto, UpdateProjectJournalDto } from '@optimistic-tanuki/models';
import { ProjectJournalCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ProjectJournalController {
  constructor(private readonly projectJournalService: ProjectJournalService) {}

  @MessagePattern(ProjectJournalCommands.CREATE)
  create(@Payload() createProjectJournalDto: CreateProjectJournalDto) {
    return this.projectJournalService.create(createProjectJournalDto);
  }

  @MessagePattern(ProjectJournalCommands.FIND_ALL)
  findAll() {
    return this.projectJournalService.findAll();
  }

  @MessagePattern(ProjectJournalCommands.FIND_ONE)
  findOne(@Payload() id: number) {
    return this.projectJournalService.findOne(id);
  }

  @MessagePattern(ProjectJournalCommands.UPDATE)
  update(@Payload() updateProjectJournalDto: UpdateProjectJournalDto) {
    return this.projectJournalService.update(
      updateProjectJournalDto.id,
      updateProjectJournalDto
    );
  }

  @MessagePattern(ProjectJournalCommands.REMOVE)
  remove(@Payload() id: number) {
    return this.projectJournalService.remove(id);
  }
}
