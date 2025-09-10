import { Test, TestingModule } from '@nestjs/testing';
import { ProjectJournalController } from './project-journal.controller';
import { ProjectJournalService } from './project-journal.service';

describe('ProjectJournalController', () => {
  let controller: ProjectJournalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectJournalController],
      providers: [ProjectJournalService],
    }).compile();

    controller = module.get<ProjectJournalController>(ProjectJournalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
