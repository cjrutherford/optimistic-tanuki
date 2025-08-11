import { Test, TestingModule } from '@nestjs/testing';
import { ProjectTelosController } from './project-telos.controller';

describe('ProjectTelosController', () => {
  let controller: ProjectTelosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectTelosController],
    }).compile();

    controller = module.get<ProjectTelosController>(ProjectTelosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
