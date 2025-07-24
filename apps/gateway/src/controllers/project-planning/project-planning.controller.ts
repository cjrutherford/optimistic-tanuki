import { Controller, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ServiceTokens } from '@optimistic-tanuki/constants';

@Controller('project-planning')
export class ProjectPlanningController {
    constructor(@Inject(ServiceTokens.PROJECT_PLANNING_SERVICE) private readonly projectPlanningService: ClientProxy) {}

    
}
