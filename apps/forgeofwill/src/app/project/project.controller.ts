import { Controller, Post, Body, Param } from '@nestjs/common';
import { ProjectService } from './project.service';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post(':id/invite')
  inviteMember(
    @Param('id') projectId: string,
    @Body('email') email: string,
    @Body('createdBy') createdBy: string
  ) {
    return this.projectService.inviteMember(projectId, email, createdBy);
  }
}
