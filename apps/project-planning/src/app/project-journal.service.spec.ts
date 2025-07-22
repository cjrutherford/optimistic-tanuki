import { Test, TestingModule } from '@nestjs/testing';
import { ProjectJournalService } from './project-journal.service';

describe('ProjectJournalService', () => {
  let service: ProjectJournalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectJournalService],
    }).compile();

    service = module.get<ProjectJournalService>(ProjectJournalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
