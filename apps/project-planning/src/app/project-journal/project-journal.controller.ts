import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectJournalService } from './project-journal.service';
import {
  CreateProjectJournalDto,
  QueryProjectJournalDto,
  UpdateProjectJournalDto,
} from '@optimistic-tanuki/models';
import { ProjectJournalCommands } from '@optimistic-tanuki/constants';

@Controller()
export class ProjectJournalController {
  constructor(private readonly projectJournalService: ProjectJournalService) {}

  @MessagePattern({ cmd: ProjectJournalCommands.CREATE })
  async create(
    @Payload()
    createProjectJournalDto: CreateProjectJournalDto & {
      requestingUserId?: string;
    }
  ) {
    const { requestingUserId, ...dto } = createProjectJournalDto;
    return await this.projectJournalService.create(dto, requestingUserId);
  }

  @MessagePattern({ cmd: ProjectJournalCommands.FIND_ALL })
  async findAll(
    @Payload() query: QueryProjectJournalDto & { requestingUserId?: string }
  ) {
    const { requestingUserId, ...q } = query;
    return await this.projectJournalService.findAll(q, requestingUserId);
  }

  @MessagePattern({ cmd: ProjectJournalCommands.FIND_ONE })
  async findOne(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.projectJournalService.findOne(id, requestingUserId);
  }

  @MessagePattern({ cmd: ProjectJournalCommands.UPDATE })
  async update(
    @Payload()
    updateProjectJournalDto: UpdateProjectJournalDto & {
      requestingUserId?: string;
    }
  ) {
    const { requestingUserId, ...dto } = updateProjectJournalDto;
    return await this.projectJournalService.update(
      dto.id,
      dto,
      requestingUserId
    );
  }

  @MessagePattern({ cmd: ProjectJournalCommands.REMOVE })
  async remove(
    @Payload('id') id: string,
    @Payload('requestingUserId') requestingUserId?: string
  ) {
    return await this.projectJournalService.remove(id, requestingUserId);
  }
}
