import { Test, TestingModule } from '@nestjs/testing';
import { ProjectPlanningController } from './project-planning.controller';

describe('ProjectPlanningController', () => {
  let controller: ProjectPlanningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectPlanningController],
    }).compile();

    controller = module.get<ProjectPlanningController>(
      ProjectPlanningController
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
