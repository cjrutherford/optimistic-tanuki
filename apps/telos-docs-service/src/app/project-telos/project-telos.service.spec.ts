import { Test, TestingModule } from '@nestjs/testing';
import { ProjectTelosService } from './project-telos.service';

describe('ProjectTelosService', () => {
  let service: ProjectTelosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectTelosService],
    }).compile();

    service = module.get<ProjectTelosService>(ProjectTelosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
