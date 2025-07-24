import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectJournalService } from './project-journal.service';
import { CreateProjectJournalDto, QueryProjectJournalDto, UpdateProjectJournalDto } from '@optimistic-tanuki/models';
import { ProjectJournalCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ProjectJournalController {
  constructor(private readonly projectJournalService: ProjectJournalService) {}

  @MessagePattern({ cmd: ProjectJournalCommands.CREATE })
  async create(@Payload() createProjectJournalDto: CreateProjectJournalDto) {
    return await this.projectJournalService.create(createProjectJournalDto);
  }

  @MessagePattern({ cmd: ProjectJournalCommands.FIND_ALL })
  async findAll(@Payload() query: QueryProjectJournalDto) {
    return await this.projectJournalService.findAll(query);
  }

  @MessagePattern({ cmd: ProjectJournalCommands.FIND_ONE })
  async findOne(@Payload() id: string) {
    return await this.projectJournalService.findOne(id);
  }

  @MessagePattern({ cmd: ProjectJournalCommands.UPDATE })
  async update(@Payload() updateProjectJournalDto: UpdateProjectJournalDto) {
    return await this.projectJournalService.update(
      updateProjectJournalDto.id,
      updateProjectJournalDto
    );
  }

  @MessagePattern({ cmd: ProjectJournalCommands.REMOVE })
  async remove(@Payload() id: string) {
    return await this.projectJournalService.remove(id);
  }
}
