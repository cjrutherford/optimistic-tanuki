import { Test, TestingModule } from '@nestjs/testing';
import { ProjectPlanningController } from './project-planning.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';

describe('ProjectPlanningController', () => {
  let controller: ProjectPlanningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectPlanningController],
      providers: [
        {
          provide: ServiceTokens.PROJECT_PLANNING_SERVICE,
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => of(true) })
      .compile();

    controller = module.get<ProjectPlanningController>(
      ProjectPlanningController
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});