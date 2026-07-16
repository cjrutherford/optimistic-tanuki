import { Test, TestingModule } from '@nestjs/testing';
import { ProjectJournalController } from './project-journal.controller';
import { ProjectJournalService } from './project-journal.service';

describe('ProjectJournalController', () => {
  let controller: ProjectJournalController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectJournalController],
      providers: [{ provide: ProjectJournalService, useValue: service }],
    }).compile();

    controller = module.get<ProjectJournalController>(ProjectJournalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes requestingUserId to findAll separately from the query', async () => {
    await controller.findAll({
      content: 'x',
      requestingUserId: 'profile-1',
    } as never);
    expect(service.findAll).toHaveBeenCalledWith({ content: 'x' }, 'profile-1');
  });

  it('passes requestingUserId to findOne', async () => {
    await controller.findOne('j1', 'profile-1');
    expect(service.findOne).toHaveBeenCalledWith('j1', 'profile-1');
  });

  it('passes requestingUserId to remove', async () => {
    await controller.remove('j1', 'profile-1');
    expect(service.remove).toHaveBeenCalledWith('j1', 'profile-1');
  });
});
